import StorageMeshEngine, { DATA_CLASS, BLOB_STATUS, RS_PARAMS } from './core/storage/storageMesh.js';
import crypto from 'crypto';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ASSERTION FAILED:', message);
    process.exit(1);
  }
}

console.log('--- STARTING PHASE 2.3 EMPIRICAL TEST SUITE ---');

const mesh = new StorageMeshEngine();

// 1. Register 20 Storage Nodes with diverse placement metadata
const nodes = [];
for (let i = 0; i < 20; i++) {
  const node = {
    nodeId:       `node-${i}`,
    operatorId:   `operator-${i}`, // 20 distinct operators
    asn:          `ASN-${1000 + (i % 10)}`, // 10 ASNs, 2 per ASN
    geoRegion:    `region-${i % 10}`, // 10 regions, 2 per region
    hostProvider: `host-${i % 10}`, // 10 hosts, 2 per host
  };
  nodes.push(node);
  mesh.registerNode(node);
}
console.log('✅ Registered 20 diverse storage nodes.');

// 2. Data Classification Test
console.log('Testing Data Classification Filtering...');
try {
  mesh.encodeBlob('blob-c1-test', Buffer.from('live state'), DATA_CLASS.C1_LIVE_STATE, 100);
  assert(false, 'C1_LIVE_STATE should be rejected from storage mesh');
} catch (e) {
  console.log('  C1_LIVE_STATE correctly rejected from mesh:', e.message);
}

// 3. Ingestion & RS Erasure Coding Test
console.log('Testing Blob Ingestion & Reed-Solomon Encoding...');
const originalPayload = Buffer.alloc(1280 * 100); // 128 KB payload
for (let i = 0; i < originalPayload.length; i++) {
  originalPayload[i] = i % 256;
}

const candidateNodeIds = nodes.map(n => n.nodeId);
const result = mesh.encodeBlob('blob-1', originalPayload, DATA_CLASS.C4_HISTORICAL_BLOCKS, 1000, 0);
const assignedShards = mesh.assignShards(result.blobId, candidateNodeIds);

console.log(`  Blob encoded and placed successfully! BlobId: ${result.blobId}`);
assert(result.shards.length === 20, 'Expected 20 shards total (10 data + 10 parity)');

// Verify status
const blobStatus = mesh.getBlobStatus(result.blobId);
assert(blobStatus.status === BLOB_STATUS.DURABLE, 'Expected DURABLE status after diverse placement');
console.log(`  Blob Status: ${blobStatus.status}, Merkle Root: ${blobStatus.merkleRoot}`);

// 4. Test Diversity Enforcement
console.log('Testing Placement Diversity Enforcement...');
mesh.registerNode({
  nodeId: 'node-dup',
  operatorId: 'operator-0', // violates MAX_PER_OPERATOR = 1
  asn: 'ASN-9999',
  geoRegion: 'region-99',
  hostProvider: 'host-99',
});
const nonCompliantPlacements = result.shards.map((s, idx) => {
  const nid = idx < 2 ? 'node-dup' : `node-${idx}`;
  return mesh.knownNodes.get(nid);
});
const isCompliant = mesh.validatePlacementDiversity(nonCompliantPlacements);
assert(!isCompliant.valid, 'Placement with 2 shards on same operator ID should fail diversity check');
console.log('  Placement diversity check correctly caught operator concentration rule violation:', isCompliant.reason);

// 5. Test Reconstruction with Missing Shards
console.log('Testing Shard Reconstruction (Simulating 10 Missing Shards)...');
const blobRecord = mesh.blobs.get(result.blobId);
const survivingShards = [];
for (let idx of [0, 1, 2, 3, 4, 10, 11, 12, 13, 14]) {
  const s = blobRecord.shards[idx];
  survivingShards.push({ index: s.index, data: s.data });
}

assert(survivingShards.length === 10, 'Expected exactly 10 surviving shards');
const reconstructed = mesh.reconstructBlob(result.blobId, survivingShards);
assert(reconstructed.equals(originalPayload), 'Reconstructed payload does NOT match original payload!');
console.log('  RS reconstruction succeeded! Reconstructed payload matches original bit-for-bit with 10 shards lost.');

// 6. Test MAISS Spot Sampling & Challenge Verification
console.log('Testing Merkle Availability & Integrity Spot-Sampling (MAISS)...');
const sampleShard = blobRecord.shards[0];
const blockHeaderHash = crypto.createHash('sha256').update('block-1000-header').digest('hex');

// Generate challenge
const challenge = mesh.generateChallenge(result.blobId, 0, 1, blockHeaderHash);
console.log(`  MAISS Challenge generated: leafIndex=${challenge.leafIndex}`);

// Generate proof
const proof = mesh.generateProof(sampleShard.data, challenge);

// Verify proof
const verified = mesh.verifyProof(sampleShard.data, challenge, proof, 50); // 50ms latency
assert(verified.valid, 'Valid MAISS proof failed verification!');
console.log('  Valid MAISS spot proof verified successfully within latency cutoff.');

// Test tampered shard proof failure
const tamperedBuffer = Buffer.from(sampleShard.data);
tamperedBuffer[challenge.leafIndex * 64] ^= 0xFF; // flip byte inside challenged leaf
const tamperedProof = mesh.generateProof(tamperedBuffer, challenge);
const verifiedTampered = mesh.verifyProof(sampleShard.data, challenge, tamperedProof, 50);
assert(!verifiedTampered.valid, 'Tampered MAISS proof should have failed verification');
console.log('  Tampered MAISS proof correctly rejected:', verifiedTampered.reason);

// Test latency timeout failure
const verifiedSlow = mesh.verifyProof(sampleShard.data, challenge, proof, challenge.issuedAt + 300); // 300ms > 200ms limit
assert(!verifiedSlow.valid, 'Slow MAISS proof (>200ms) should have failed latency check');
console.log('  Out-of-bounds latency response (>200ms) correctly rejected:', verifiedSlow.reason);

// 7. Test Self-Healing Repair Trigger
console.log('Testing Self-Healing Repair System...');
// Evaluate availability with 12 active shards (< REPAIR_THRESHOLD = 14) to create repair job
mesh.evaluateAvailability(result.blobId, 12);
const repairResult = mesh.executeRepair(result.blobId, survivingShards);
mesh.assignShards(result.blobId, candidateNodeIds);

assert(repairResult !== null, 'Self-healing repair should be triggered');
assert(repairResult.repairedBlobId === result.blobId, 'Repaired blob ID should match');
assert(repairResult.newShards.length === 20, 'All 20 shards should be re-encoded');
console.log(`  Self-healing repair triggered, reconstructed, and regenerated all 20 shards.`);

const updatedBlob = mesh.blobs.get(result.blobId);
assert(updatedBlob.status === BLOB_STATUS.DURABLE, 'Blob status restored to DURABLE post-repair');
console.log('  Blob status successfully returned to DURABLE post-repair.');

// 8. Test VSU Accounting
console.log('Testing Verified Storage Unit (VSU) Accounting...');
mesh.recordVSU('node-0', 1.0);
const vsuSnap = mesh.getVSUSnapshot();
assert(vsuSnap['node-0'] === 1, 'Expected node-0 to have 1 VSU');
console.log('  VSU accounting verified.');

console.log('\n🎉 ALL PHASE 2.3 EMPIRICAL TESTS PASSED SUCCESSFULLY! 🎉');
