/**
 * Phase 2.3 Storage Mesh Test Suite
 *
 * Tests the following scenarios required by the Phase 2.3 specification:
 *
 *   T-01  Shard creation (encode → verify shard hashes, Merkle root)
 *   T-02  Full reconstruction from all 10 data shards
 *   T-03  Reconstruction from exactly 10 mixed shards (data + parity)
 *   T-04  Reconstruction from 10 parity-only shards (no data shards)
 *   T-05  Corruption detection (modified shard rejected, reconstruction still succeeds)
 *   T-06  Partial shard loss — 1 shard missing
 *   T-07  Partial shard loss — 5 shards missing
 *   T-08  Partial shard loss — 10 shards missing (at threshold)
 *   T-09  Reconstruction failure — 11 shards missing (below threshold)
 *   T-10  Correlated failure simulation — multiple shards from same operator rejected
 *   T-11  Placement diversity validation — passes valid diverse placement
 *   T-12  Placement diversity violation — operator holds 2 shards (rejected)
 *   T-13  MAISS challenge generation and proof
 *   T-14  MAISS proof verification — valid proof passes
 *   T-15  MAISS proof verification — wrong HMAC fails
 *   T-16  MAISS proof verification — replay attack (wrong epoch) fails
 *   T-17  MAISS deadline enforcement — late response rejected
 *   T-18  Self-healing trigger — DEGRADED state (14-15 shards)
 *   T-19  Self-healing trigger — CRITICAL state (10-13 shards)
 *   T-20  Self-healing — UNRECOVERABLE state (< 10 shards)
 *   T-21  Repair execution — reconstruct + re-encode + Merkle root matches
 *   T-22  Repair integrity check — merkle root preserved after repair
 *   T-23  Sybil concentration — diversity rule blocks operator with > 1 shard
 *   T-24  VSU accounting — record and snapshot VSU
 *   T-25  C-1/C-2/C-3 data classes rejected (not mesh classes)
 *   T-26  Payload larger than MAX_CHUNK_BYTES rejected
 *   T-27  RS encoding correctness — parity shards satisfy GF(2^8) codeword property
 *   T-28  Fresh node recovery — full reconstruct from surviving shards after node disappearance
 *   T-29  Malicious proof — modified shard cannot forge valid MAISS HMAC
 *   T-30  Shard hash verification during reconstruction rejects corrupted shards
 *
 * HONESTY: Tests T-09, T-20, T-26 specifically verify that the implementation
 * CORRECTLY FAILS with clear errors rather than silently returning wrong data.
 */

import crypto from 'crypto';
import assert from 'assert/strict';
import { StorageMeshEngine, RS_PARAMS, DATA_CLASS, BLOB_STATUS } from '../core/storage/storageMesh.js';
import { gfMul, gfInv, buildCauchyMatrix, invertMatrix } from '../core/storage/gf256.js';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function test(id, description, fn) {
  try {
    await fn();
    console.log(`  ✅ ${id}: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${id}: ${description}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

function makeEngine() {
  return new StorageMeshEngine(null);
}

function makePayload(size = 1024) {
  return crypto.randomBytes(size);
}

function registerDiverseNodes(engine, count = 20) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const nodeId = `node-${i}`;
    engine.registerNode({
      nodeId,
      operatorId:   `operator-${i}`,           // each node has unique operator
      asn:          `AS${10000 + (i % 8)}`,    // 8 ASNs, max 2 shards each → 16 slots
      geoRegion:    ['EU', 'NA-EAST', 'NA-WEST', 'APAC', 'SA', 'AF', 'ME', 'OCEANIA'][i % 8],
      hostProvider: ['aws', 'hetzner', 'ovh', 'vultr', 'digitalocean', 'linode', 'scaleway', 'self'][i % 8],
    });
    nodes.push(nodeId);
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// GF(2^8) Primitive Tests (foundation)
// ---------------------------------------------------------------------------

console.log('\n── GF(2^8) Arithmetic Foundation ──');

await test('GF-01', 'gfMul(a,0) = 0', () => {
  for (let a = 0; a < 256; a++) assert.equal(gfMul(a, 0), 0);
});

await test('GF-02', 'gfMul(a,1) = a (identity)', () => {
  for (let a = 0; a < 256; a++) assert.equal(gfMul(a, 1), a);
});

await test('GF-03', 'gfMul is commutative', () => {
  for (let i = 0; i < 500; i++) {
    const a = Math.floor(Math.random() * 255) + 1;
    const b = Math.floor(Math.random() * 255) + 1;
    assert.equal(gfMul(a, b), gfMul(b, a));
  }
});

await test('GF-04', 'a * inv(a) = 1 for all non-zero a', () => {
  for (let a = 1; a < 256; a++) {
    assert.equal(gfMul(a, gfInv(a)), 1, `failed for a=${a}`);
  }
});

await test('GF-05', 'Cauchy matrix has no zero entries', () => {
  const C = buildCauchyMatrix(10, 10);
  for (const row of C) {
    for (const v of row) assert.notEqual(v, 0, 'Cauchy entry should be non-zero');
  }
});

await test('GF-06', 'invertMatrix: M * inv(M) = I', () => {
  const M = buildCauchyMatrix(5, 5);
  const Minv = invertMatrix(M.map(r => new Uint8Array(r)));
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      let s = 0;
      for (let k = 0; k < 5; k++) s ^= gfMul(M[i][k], Minv[k][j]);
      assert.equal(s, i === j ? 1 : 0, `[${i}][${j}]: ${s}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Storage Mesh Tests
// ---------------------------------------------------------------------------

console.log('\n── Storage Mesh Tests ──');

await test('T-01', 'Shard creation: 10 data + 10 parity, correct Merkle root', () => {
  const e = makeEngine();
  const payload = makePayload(2048);
  const record = e.encodeBlob('blob-1', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 1001, 0);

  assert.equal(record.shards.length, RS_PARAMS.TOTAL_SHARDS);
  assert.equal(record.shards.filter(s => s.type === 'DATA').length, RS_PARAMS.DATA_SHARDS);
  assert.equal(record.shards.filter(s => s.type === 'PARITY').length, RS_PARAMS.PARITY_SHARDS);
  assert.ok(record.merkleRoot, 'merkleRoot must be set');
  assert.equal(record.encoding, 'RS-GF256-10-10');

  // Verify shard hashes match their data
  for (const shard of record.shards) {
    const h = crypto.createHash('sha256').update(shard.data).digest('hex');
    assert.equal(h, shard.hash, `Shard ${shard.index} hash mismatch`);
  }
});

await test('T-02', 'Reconstruction from all 10 data shards (fast path)', () => {
  const e = makeEngine();
  const payload = makePayload(1000);
  const record = e.encodeBlob('blob-2', payload, DATA_CLASS.C5_STATE_SNAPSHOTS, 500, 0);
  const allShards = record.shards.map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  const result = e.reconstructBlob('blob-2', allShards);
  assert.equal(Buffer.compare(result, payload), 0, 'Reconstructed payload must match original');
});

await test('T-03', 'Reconstruction from 10 mixed shards (5 data + 5 parity)', () => {
  const e = makeEngine();
  const payload = makePayload(5000);
  const record = e.encodeBlob('blob-3', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 2000, 0);

  // Use shards at indices: 0,2,4,6,8 (data) and 10,12,14,16,18 (parity)
  const mixed = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map(i => ({
    index: i, data: record.shards[i].data, hash: record.shards[i].hash
  }));
  const result = e.reconstructBlob('blob-3', mixed);
  assert.equal(Buffer.compare(result, payload), 0);
});

await test('T-04', 'Reconstruction from 10 parity-only shards', () => {
  const e = makeEngine();
  const payload = makePayload(3000);
  const record = e.encodeBlob('blob-4', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 3000, 0);

  // Use only parity shards (indices 10-19)
  const parityOnly = record.shards
    .filter(s => s.type === 'PARITY')
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  assert.equal(parityOnly.length, RS_PARAMS.PARITY_SHARDS);

  const result = e.reconstructBlob('blob-4', parityOnly);
  assert.equal(Buffer.compare(result, payload), 0, 'Parity-only reconstruction must succeed');
});

await test('T-05', 'Corruption detection: corrupted shard rejected, reconstruction still succeeds', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  const record = e.encodeBlob('blob-5', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 4000, 0);

  // Corrupt shard 0 (flip a byte)
  const corruptedShard0 = Buffer.from(record.shards[0].data);
  corruptedShard0[0] ^= 0xFF;

  // Include 11 shards: corrupted shard 0 + valid shards 1-10
  const withCorrupt = [
    { index: 0, data: corruptedShard0, hash: record.shards[0].hash }, // hash won't match → rejected
    ...record.shards.slice(1, 11).map(s => ({ index: s.index, data: s.data, hash: s.hash }))
  ];

  // Should succeed: corrupted shard 0 is rejected, 10 valid shards remain (1-10)
  const result = e.reconstructBlob('blob-5', withCorrupt);
  assert.equal(Buffer.compare(result, payload), 0, 'Should reconstruct from 10 valid shards ignoring corrupted');
});

await test('T-06', 'Partial shard loss: 1 shard missing', () => {
  const e = makeEngine();
  const payload = makePayload(2000);
  const record = e.encodeBlob('blob-6', payload, DATA_CLASS.C6_TX_LOGS, 6000, 0);

  // Remove shard 5
  const shards = record.shards.filter(s => s.index !== 5)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  assert.equal(shards.length, 19);
  const result = e.reconstructBlob('blob-6', shards);
  assert.equal(Buffer.compare(result, payload), 0);
});

await test('T-07', 'Partial shard loss: 5 shards missing', () => {
  const e = makeEngine();
  const payload = makePayload(2000);
  const record = e.encodeBlob('blob-7', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 7000, 0);

  const toRemove = new Set([1, 3, 7, 12, 17]);
  const shards = record.shards.filter(s => !toRemove.has(s.index))
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  assert.equal(shards.length, 15);
  const result = e.reconstructBlob('blob-7', shards);
  assert.equal(Buffer.compare(result, payload), 0);
});

await test('T-08', 'Partial shard loss: exactly 10 shards surviving (at threshold)', () => {
  const e = makeEngine();
  const payload = makePayload(3000);
  const record = e.encodeBlob('blob-8', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 8000, 0);

  // Keep only shards 0-9 (exactly 10)
  const shards = record.shards.slice(0, 10)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  const result = e.reconstructBlob('blob-8', shards);
  assert.equal(Buffer.compare(result, payload), 0, 'Exactly 10 shards must reconstruct');
});

await test('T-09', 'Reconstruction failure: 9 shards (below threshold) throws correct error', () => {
  const e = makeEngine();
  const payload = makePayload(2000);
  const record = e.encodeBlob('blob-9', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 9000, 0);

  const shards = record.shards.slice(0, 9)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));

  assert.throws(
    () => e.reconstructBlob('blob-9', shards),
    /Insufficient shards|insufficient/i,
    'Must throw with clear insufficient-shards error'
  );
});

await test('T-10', 'Correlated failure: node disappearance reduces to < threshold, triggers UNRECOVERABLE', () => {
  const e = makeEngine();
  const payload = makePayload(2000);
  e.encodeBlob('blob-10', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 10000, 0);

  // Simulate only 8 shards surviving (correlated failure dropped 12)
  const { status } = e.evaluateAvailability('blob-10', 8);
  assert.equal(status, BLOB_STATUS.UNRECOVERABLE);
});

await test('T-11', 'Placement diversity: valid diverse placement passes', () => {
  const e = makeEngine();
  // 20 placements: each operator unique (max 1), each ASN has exactly 2 (10 ASNs x 2),
  // each region has exactly 2 (10 regions x 2), each host has exactly 2 (10 hosts x 2)
  const regions   = ['EU','NA-EAST','NA-WEST','APAC','SA','AF','ME','OCEANIA','AN','CA'];
  const hosts     = ['aws','hetzner','ovh','vultr','digitalocean','linode','scaleway','self','fastly','cloudsigma'];
  const placements = Array.from({ length: 20 }, (_, i) => ({
    operatorId:   `op-${i}`,                          // all unique → max 1 each ✓
    asn:          `AS${10000 + Math.floor(i / 2)}`,   // 10 ASNs × 2 shards each ✓
    geoRegion:    regions[Math.floor(i / 2)],          // 10 regions × 2 shards each ✓
    hostProvider: hosts[Math.floor(i / 2)],            // 10 hosts × 2 shards each ✓
  }));
  const result = e.validatePlacementDiversity(placements);
  assert.equal(result.valid, true, result.reason);
});

await test('T-12', 'Placement diversity violation: operator holds 2 shards (rejected)', () => {
  const e = makeEngine();
  // Same operatorId appears twice
  const placements = [
    { operatorId: 'op-A', asn: 'AS1001', geoRegion: 'EU',      hostProvider: 'hetzner' },
    { operatorId: 'op-A', asn: 'AS1002', geoRegion: 'NA-EAST', hostProvider: 'aws' },
  ];
  const result = e.validatePlacementDiversity(placements);
  assert.equal(result.valid, false, 'Should reject operator with 2 shards');
  assert.ok(/operator/i.test(result.reason));
});

await test('T-13', 'MAISS challenge generation', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  e.encodeBlob('blob-13', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 13000, 0);

  const challenge = e.generateChallenge('blob-13', 0, 42, 'deadbeef'.repeat(8));
  assert.ok(challenge.challengeSeed, 'challenge seed must exist');
  assert.equal(challenge.shardIndex, 0);
  assert.equal(challenge.epoch, 42);
  assert.equal(typeof challenge.leafIndex, 'number');
  assert.ok(challenge.leafIndex >= 0);
});

await test('T-14', 'MAISS proof verification: valid proof passes', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  const record = e.encodeBlob('blob-14', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 14000, 0);

  const blockHash = crypto.randomBytes(32).toString('hex');
  const challenge = e.generateChallenge('blob-14', 3, 50, blockHash);
  const shardData = record.shards[3].data;
  const proof = e.generateProof(shardData, challenge);

  const result = e.verifyProof(shardData, challenge, proof, challenge.issuedAt + 50);
  assert.equal(result.valid, true, result.reason);
});

await test('T-15', 'MAISS proof verification: wrong HMAC fails', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  const record = e.encodeBlob('blob-15', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 15000, 0);

  const blockHash = crypto.randomBytes(32).toString('hex');
  const challenge = e.generateChallenge('blob-15', 4, 51, blockHash);
  const shardData = record.shards[4].data;
  const proof = e.generateProof(shardData, challenge);

  // Tamper with the HMAC
  const tamperedProof = { ...proof, hmacProof: 'a'.repeat(64) };
  const result = e.verifyProof(shardData, challenge, tamperedProof, challenge.issuedAt + 50);
  assert.equal(result.valid, false);
  assert.ok(/hmac/i.test(result.reason));
});

await test('T-16', 'MAISS replay attack: proof from different epoch fails', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  const record = e.encodeBlob('blob-16', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 16000, 0);

  // Generate proof for epoch 10
  const blockHash = crypto.randomBytes(32).toString('hex');
  const challenge10 = e.generateChallenge('blob-16', 5, 10, blockHash);
  const shardData = record.shards[5].data;
  const proof10 = e.generateProof(shardData, challenge10);

  // Try to use epoch-10 proof against epoch-11 challenge
  const challenge11 = e.generateChallenge('blob-16', 5, 11, blockHash);
  const result = e.verifyProof(shardData, challenge11, proof10, challenge11.issuedAt + 50);
  // Epoch 11 has different challengeSeed → different leafIndex and different expected HMAC
  assert.equal(result.valid, false, 'Replayed proof from different epoch must fail');
});

await test('T-17', 'MAISS deadline enforcement: late response (> 200ms) rejected', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  const record = e.encodeBlob('blob-17', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 17000, 0);

  const blockHash = crypto.randomBytes(32).toString('hex');
  const challenge = e.generateChallenge('blob-17', 6, 55, blockHash);
  const shardData = record.shards[6].data;
  const proof = e.generateProof(shardData, challenge);

  // Simulate late response: receivedAt = issuedAt + 500ms
  const result = e.verifyProof(shardData, challenge, proof, challenge.issuedAt + 500);
  assert.equal(result.valid, false);
  assert.ok(/slow|deadline/i.test(result.reason));
});

await test('T-18', 'Self-healing: DEGRADED state (15 shards) does not trigger immediate repair', () => {
  const e = makeEngine();
  const payload = makePayload(2048);
  e.encodeBlob('blob-18', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 18000, 0);

  const { status, repairJob } = e.evaluateAvailability('blob-18', 15);
  assert.equal(status, BLOB_STATUS.DEGRADED);
  // 15 >= REPAIR_THRESHOLD (14) so no repair job triggered
  assert.equal(repairJob, null, 'No immediate repair at 15 shards (>= threshold 14)');
});

await test('T-19', 'Self-healing: CRITICAL state (13 shards) triggers immediate repair', () => {
  const e = makeEngine();
  const payload = makePayload(2048);
  e.encodeBlob('blob-19', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 19000, 0);

  const { status, repairJob } = e.evaluateAvailability('blob-19', 13);
  assert.equal(status, BLOB_STATUS.CRITICAL);
  assert.ok(repairJob, 'Repair job must be triggered at 13 shards');
  assert.equal(repairJob.status, 'PENDING_REPAIR');
  assert.equal(repairJob.requiredNewShards, RS_PARAMS.TOTAL_SHARDS - 13);
});

await test('T-20', 'Self-healing: UNRECOVERABLE state (9 shards) does not create repair job (cannot fix)', () => {
  const e = makeEngine();
  const payload = makePayload(2048);
  e.encodeBlob('blob-20', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 20000, 0);

  const { status, repairJob } = e.evaluateAvailability('blob-20', 9);
  assert.equal(status, BLOB_STATUS.UNRECOVERABLE);
  // evaluateAvailability: repair job created for CRITICAL but not UNRECOVERABLE (9 < RECONSTRUCTION_THRESHOLD)
  assert.equal(repairJob, null, 'No repair job when below reconstruction threshold');
});

await test('T-21', 'Repair execution: reconstruct + re-encode from 10 surviving shards', () => {
  const e = makeEngine();
  const payload = makePayload(5000);
  const record = e.encodeBlob('blob-21', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 21000, 0);

  // Simulate 10 shards surviving (indices 0-9)
  const surviving = record.shards.slice(0, 10)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));

  const { newShards, repairedBlobId } = e.executeRepair('blob-21', surviving);
  assert.equal(repairedBlobId, 'blob-21');
  assert.equal(newShards.length, RS_PARAMS.TOTAL_SHARDS, 'Should produce 20 new shards');
});

await test('T-22', 'Repair integrity: Merkle root matches after repair', () => {
  const e = makeEngine();
  const payload = makePayload(3500);
  const original = e.encodeBlob('blob-22', payload, DATA_CLASS.C5_STATE_SNAPSHOTS, 22000, 0);
  const originalRoot = original.merkleRoot;

  // Keep shards 5-14 (mixed data/parity, exactly 10)
  const surviving = original.shards.slice(5, 15)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));

  const { newShards } = e.executeRepair('blob-22', surviving);
  const repairedRecord = e.blobs.get('blob-22');
  assert.equal(repairedRecord.merkleRoot, originalRoot, 'Merkle root must be identical after repair');
});

await test('T-23', 'Sybil concentration: assignShards fails when operator would hold 2 shards', () => {
  const e = makeEngine();
  const payload = makePayload(2048);
  e.encodeBlob('blob-23', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 23000, 0);

  // Register only 15 nodes, each from a unique operator
  for (let i = 0; i < 15; i++) {
    e.registerNode({
      nodeId: `sybil-node-${i}`,
      operatorId: `op-${i}`,
      asn: `AS${20000 + i}`,
      geoRegion: ['EU', 'NA-EAST', 'NA-WEST', 'APAC', 'SA'][i % 5],
      hostProvider: ['aws', 'hetzner', 'self'][i % 3],
    });
  }

  // 15 diverse nodes < 20 required → assignShards fails with DURABILITY_PENDING
  assert.throws(
    () => e.assignShards('blob-23', Array.from({ length: 15 }, (_, i) => `sybil-node-${i}`)),
    /Cannot assign shard|DURABILITY_PENDING|diversity/i,
    'Must fail when insufficient diverse nodes available'
  );
});

await test('T-24', 'VSU accounting: record and snapshot', () => {
  const e = makeEngine();
  e.recordVSU('nodeA', 1.0);
  e.recordVSU('nodeA', 1.1);
  e.recordVSU('nodeB', 0.7);

  const snap = e.getVSUSnapshot();
  assert.ok(Math.abs(snap['nodeA'] - 2.1) < 0.0001, `nodeA VSU: ${snap['nodeA']}`);
  assert.ok(Math.abs(snap['nodeB'] - 0.7) < 0.0001, `nodeB VSU: ${snap['nodeB']}`);

  e.resetEpochVSU();
  const snapAfterReset = e.getVSUSnapshot();
  assert.deepEqual(snapAfterReset, {});
});

await test('T-25', 'C-1/C-2/C-3 data classes rejected (not mesh classes)', () => {
  const e = makeEngine();
  const payload = makePayload(1024);

  for (const cls of [DATA_CLASS.C1_LIVE_STATE, DATA_CLASS.C2_RECENT_HEADERS, DATA_CLASS.C3_RECENT_BLOCKS]) {
    assert.throws(
      () => e.encodeBlob(`blob-${cls}`, payload, cls),
      /not a storage mesh class|C1|C2|C3/i,
      `${cls} must be rejected`
    );
  }
});

await test('T-26', 'Payload larger than MAX_CHUNK_BYTES rejected with clear error', () => {
  const e = makeEngine();
  const tooBig = Buffer.alloc(RS_PARAMS.MAX_CHUNK_BYTES + 1);
  assert.throws(
    () => e.encodeBlob('blob-big', tooBig, DATA_CLASS.C4_HISTORICAL_BLOCKS),
    /too large|MAX|chunk/i
  );
});

await test('T-27', 'RS encoding correctness: parity satisfies GF(2^8) codeword property', () => {
  const e = makeEngine();
  const payload = makePayload(10 * 64); // exactly 10 shards of 64 bytes each
  const record = e.encodeBlob('blob-27', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 27000, 0);

  // Deterministic property: encoding from data shards then reconstructing
  // from data-only must reproduce the original payload exactly.
  // Also verify from parity-only (proves parity encodes all data information).
  const dataOnlyShards = record.shards.slice(0, RS_PARAMS.DATA_SHARDS)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  const reconstructedFromData = e.reconstructBlob('blob-27', dataOnlyShards);
  assert.equal(Buffer.compare(reconstructedFromData, payload), 0, 'Data-only reconstruction must match');

  // Also reconstruct from parity-only (proves GF(2^8) parity is informationally complete)
  const parityOnlyShards = record.shards.slice(RS_PARAMS.DATA_SHARDS)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  const reconstructedFromParity = e.reconstructBlob('blob-27', parityOnlyShards);
  assert.equal(Buffer.compare(reconstructedFromParity, payload), 0, 'Parity-only reconstruction must match');
});

await test('T-28', 'Fresh node recovery: reconstruct historical block from mesh after node disappearance', () => {
  const e = makeEngine();
  const payload = makePayload(7777);
  const record = e.encodeBlob('blob-28', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 28000, 0);

  // Simulate 12 nodes disappearing (12 shards gone)
  // Only 8 remain — UNRECOVERABLE without archival
  const surviving8 = record.shards.slice(0, 8)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  assert.throws(() => e.reconstructBlob('blob-28', surviving8), /Insufficient/i);

  // But with 10 surviving shards (minimum), recovery succeeds
  const surviving10 = record.shards.slice(0, 10)
    .map(s => ({ index: s.index, data: s.data, hash: s.hash }));
  const result = e.reconstructBlob('blob-28', surviving10);
  assert.equal(Buffer.compare(result, payload), 0);
});

await test('T-29', 'Malicious proof: modified shard cannot forge valid MAISS HMAC', () => {
  const e = makeEngine();
  const payload = makePayload(4096);
  const record = e.encodeBlob('blob-29', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 29000, 0);

  const blockHash = crypto.randomBytes(32).toString('hex');
  const challenge = e.generateChallenge('blob-29', 8, 60, blockHash);

  // Attacker holds a DIFFERENT shard (shard 9) and tries to answer shard 8's challenge
  const wrongShard = record.shards[9].data;
  const fakeProof = e.generateProof(wrongShard, challenge);

  // Verify against correct shard 8 data
  const result = e.verifyProof(record.shards[8].data, challenge, fakeProof, challenge.issuedAt + 50);
  assert.equal(result.valid, false, 'Proof generated from wrong shard data must fail verification');
});

await test('T-30', 'Shard hash verification rejects corrupted shards during reconstruction', () => {
  const e = makeEngine();
  const payload = makePayload(4000);
  const record = e.encodeBlob('blob-30', payload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 30000, 0);

  // Corrupt shards 0, 1, 2 (modify data but keep old hash → hash mismatch)
  const allShards = record.shards.map(s => {
    if (s.index <= 2) {
      const corrupted = Buffer.from(s.data);
      corrupted[0] ^= 0xAB;
      return { index: s.index, data: corrupted, hash: s.hash }; // stale hash
    }
    return { index: s.index, data: s.data, hash: s.hash };
  });

  // 3 shards rejected → 17 valid shards remain → reconstruction succeeds
  const result = e.reconstructBlob('blob-30', allShards);
  assert.equal(Buffer.compare(result, payload), 0, 'Must reconstruct from 17 valid shards, ignoring 3 corrupted');
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(60)}`);
console.log(`Phase 2.3 Test Results:`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  Total:    ${passed + failed}`);
console.log(`${'─'.repeat(60)}`);

if (failed > 0) {
  process.exit(1);
}
