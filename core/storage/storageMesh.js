/**
 * SAYMAN Core Storage Mesh Engine — Phase 2.3
 *
 * Implements the SAYMAN Data Availability & Storage Mesh protocol:
 *
 *   - GF(2^8) systematic Reed-Solomon erasure coding (10 data + 10 parity shards)
 *   - Multi-dimensional shard placement diversity enforcement
 *   - Merkle Availability & Integrity Spot-Sampling (MAISS) challenge protocol
 *   - Self-healing repair trigger and state machine
 *   - Verified Storage Unit (VSU) accounting
 *   - Data class classification (C-1 through C-8)
 *
 * PRIOR ART ACKNOWLEDGMENT:
 *   Reed-Solomon coding: Reed & Solomon (1960) — existing technology [A]
 *   GF(2^8) systematic RS: klauspost/reedsolomon, Backblaze RS — existing technology [A]
 *   Merkle commitments: BitTorrent, Ethereum — existing technology [A]
 *   Distributed shard storage: Filecoin, Storj, Sia — existing technology [A]
 *   MAISS: SAYMAN combination of Merkle + HMAC + timing [B] — NOT formal PoR
 *   Pure-JS GF(2^8) RS codec: SAYMAN-specific engineering [C]
 *
 * STRICT CLAIMS:
 *   - This module does NOT provide formal Proof of Retrievability (PoR).
 *   - This module does NOT guarantee "no data loss".
 *   - Data is recoverable provided >= 10 of 20 diverse shards remain accessible.
 *   - See PHASE_2_3_DURABILITY_MODEL.md for exact probabilistic durability guarantees.
 *
 * EXTERNAL COMPONENT BOUNDARY:
 *   Wallet, SDK, dApps, Faucet, and Explorer are NOT modified.
 *   This module exposes protocol interfaces only.
 */

import crypto from 'crypto';
import MerkleTree from '../merkle.js';
import {
  gfMul, gfInv, buildCauchyMatrix, invertMatrix
} from './gf256.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DATA_CLASS = {
  C1_LIVE_STATE:        'C1_LIVE_STATE',        // consensus-critical; NOT in mesh
  C2_RECENT_HEADERS:   'C2_RECENT_HEADERS',    // consensus-critical; NOT in mesh
  C3_RECENT_BLOCKS:    'C3_RECENT_BLOCKS',     // sync via P2P; NOT in mesh
  C4_HISTORICAL_BLOCKS:'C4_HISTORICAL_BLOCKS', // primary mesh domain
  C5_STATE_SNAPSHOTS:  'C5_STATE_SNAPSHOTS',   // primary mesh domain
  C6_TX_LOGS:          'C6_TX_LOGS',           // mesh
  C7_CONTRACT_CODE:    'C7_CONTRACT_CODE',     // mesh; content-addressed
  C8_APP_DATA:         'C8_APP_DATA',          // mesh; best-effort
};

// Classes that belong in the storage mesh (C-4 through C-8)
export const MESH_CLASSES = new Set([
  DATA_CLASS.C4_HISTORICAL_BLOCKS,
  DATA_CLASS.C5_STATE_SNAPSHOTS,
  DATA_CLASS.C6_TX_LOGS,
  DATA_CLASS.C7_CONTRACT_CODE,
  DATA_CLASS.C8_APP_DATA,
]);

export const RS_PARAMS = {
  DATA_SHARDS:              10,
  PARITY_SHARDS:            10,
  TOTAL_SHARDS:             20,
  RECONSTRUCTION_THRESHOLD: 10,  // min shards to reconstruct
  AVAILABILITY_THRESHOLD:   16,  // below this: degraded alert
  REPAIR_THRESHOLD:         14,  // below this: immediate repair
  MAX_SHARD_BYTES:          128 * 1024, // 128 KiB per shard
  MAX_CHUNK_BYTES:          1280 * 1024, // 1,280 KiB per chunk (10 * 128 KiB)
};

export const PLACEMENT_LIMITS = {
  MAX_PER_OPERATOR: 1,
  MAX_PER_ASN:      2,
  MAX_PER_REGION:   2,
  MAX_PER_HOST:     2,
};

export const MAISS_PARAMS = {
  LEAF_SIZE_BYTES:    64,   // 64 bytes per leaf for challenge sampling
  DEADLINE_MS:        200,  // 200ms response deadline
  FAIL_STRIKE_LIMIT:  3,    // consecutive failures before shard eviction
};

export const BLOB_STATUS = {
  DURABILITY_PENDING: 'DURABILITY_PENDING', // insufficient diverse nodes
  DURABLE:            'DURABLE',            // >= AVAILABILITY_THRESHOLD shards confirmed
  DEGRADED:           'DEGRADED',           // between REPAIR_THRESHOLD and AVAILABILITY_THRESHOLD
  CRITICAL:           'CRITICAL',           // between RECONSTRUCTION_THRESHOLD and REPAIR_THRESHOLD
  UNRECOVERABLE:      'UNRECOVERABLE',      // below RECONSTRUCTION_THRESHOLD
};

// ---------------------------------------------------------------------------
// GF(2^8) Reed-Solomon Codec
// ---------------------------------------------------------------------------

/**
 * RSCodec wraps GF(2^8) Cauchy-matrix encoding/decoding.
 * Encoding is systematic: data shards are unchanged; parity shards are appended.
 */
class RSCodec {
  constructor(dataShards = RS_PARAMS.DATA_SHARDS, parityShards = RS_PARAMS.PARITY_SHARDS) {
    this.n = dataShards;
    this.m = parityShards;
    // Cauchy matrix: (m x n) — encodes n data shards into m parity shards
    this.encodingMatrix = buildCauchyMatrix(this.m, this.n);
  }

  /**
   * Encode: compute m parity shards from n data shards.
   * Each parity shard P_i = SUM_j( C[i][j] * D_j ) over GF(2^8), byte-by-byte.
   *
   * @param {Buffer[]} dataShards - array of n Buffers of equal length
   * @returns {Buffer[]} array of m parity shard Buffers
   */
  encode(dataShards) {
    if (dataShards.length !== this.n) {
      throw new Error(`encode: expected ${this.n} data shards, got ${dataShards.length}`);
    }
    const shardLen = dataShards[0].length;
    const parityShards = [];

    for (let i = 0; i < this.m; i++) {
      const parity = Buffer.alloc(shardLen);
      for (let j = 0; j < this.n; j++) {
        const coeff = this.encodingMatrix[i][j];
        const dataShard = dataShards[j];
        for (let b = 0; b < shardLen; b++) {
          // GF(2^8) addition is XOR; multiplication via gfMul
          parity[b] ^= gfMul(coeff, dataShard[b]);
        }
      }
      parityShards.push(parity);
    }
    return parityShards;
  }

  /**
   * Reconstruct all n data shards from any >= n available shards
   * (data or parity, any combination).
   *
   * @param {Array<{index:number, data:Buffer}|null>} shards
   *   Array of length (n+m). Null entries = missing. Must have >= n non-null.
   * @returns {Buffer[]} Reconstructed n data shards
   */
  reconstruct(shards) {
    const total = this.n + this.m;
    if (shards.length !== total) {
      throw new Error(`reconstruct: expected ${total} shard slots, got ${shards.length}`);
    }

    // If all data shards are present, return them directly
    const dataMissing = shards.slice(0, this.n).some(s => s === null);
    if (!dataMissing) {
      return shards.slice(0, this.n).map(s => s.data);
    }

    // Find which shards are available
    const available = [];
    for (let i = 0; i < total; i++) {
      if (shards[i] !== null) available.push(i);
    }
    if (available.length < this.n) {
      throw new Error(`Insufficient shards: ${available.length} < ${this.n}`);
    }

    // Build the full (n+m) x n generator matrix (systematic + Cauchy parity rows)
    // Row i: for i < n -> identity row i; for i >= n -> Cauchy row (i-n)
    const fullMatrix = [];
    for (let i = 0; i < this.n; i++) {
      const row = new Uint8Array(this.n);
      row[i] = 1;
      fullMatrix.push(row);
    }
    for (let i = 0; i < this.m; i++) {
      fullMatrix.push(new Uint8Array(this.encodingMatrix[i]));
    }

    // Select n rows corresponding to available shards (take first n available)
    const selectedIndices = available.slice(0, this.n);
    const subMatrix = selectedIndices.map(i => new Uint8Array(fullMatrix[i]));

    // Invert the selected sub-matrix
    const invMatrix = invertMatrix(subMatrix);

    // Reconstruct: data[j] = SUM_k( invMatrix[j][k] * availableShard[k] )
    const shardLen = shards[selectedIndices[0]].data.length;
    const reconstructed = Array.from({ length: this.n }, () => Buffer.alloc(shardLen));

    for (let j = 0; j < this.n; j++) {
      for (let k = 0; k < this.n; k++) {
        const coeff = invMatrix[j][k];
        if (coeff === 0) continue;
        const src = shards[selectedIndices[k]].data;
        const dst = reconstructed[j];
        for (let b = 0; b < shardLen; b++) {
          dst[b] ^= gfMul(coeff, src[b]);
        }
      }
    }

    return reconstructed;
  }
}

// Singleton codec for default RS_PARAMS
const DEFAULT_CODEC = new RSCodec(RS_PARAMS.DATA_SHARDS, RS_PARAMS.PARITY_SHARDS);

// ---------------------------------------------------------------------------
// StorageMeshEngine
// ---------------------------------------------------------------------------

export class StorageMeshEngine {
  /**
   * @param {object|null} blockchain - optional blockchain reference for epoch queries
   */
  constructor(blockchain = null) {
    this.blockchain = blockchain;

    /** @type {Map<string, BlobRecord>} blobId -> blob record */
    this.blobs = new Map();

    /** @type {Map<string, RepairJob>} blobId -> active repair job */
    this.repairJobs = new Map();

    /** @type {Map<string, NodeMeta>} nodeId -> node metadata for diversity */
    this.knownNodes = new Map();

    /** @type {Map<string, Map<string,ChallengeRecord>>} blobId -> (shardKey -> record) */
    this.challengeRecords = new Map();

    /** @type {Map<string, number>} nodeId -> VSU count for current epoch */
    this.vsuLedger = new Map();

    this._codec = DEFAULT_CODEC;
  }

  // -------------------------------------------------------------------------
  // Node Registry
  // -------------------------------------------------------------------------

  /**
   * Register a storage node with its diversity metadata.
   * operatorId, asn, geoRegion, hostProvider are self-declared (known limitation).
   *
   * @param {object} meta
   */
  registerNode(meta) {
    const required = ['nodeId', 'operatorId', 'asn', 'geoRegion', 'hostProvider'];
    for (const f of required) {
      if (!meta[f]) throw new Error(`registerNode: missing field '${f}'`);
    }
    this.knownNodes.set(meta.nodeId, { ...meta, registeredAt: Date.now() });
  }

  // -------------------------------------------------------------------------
  // Encode (Chunk → 20 Shards)
  // -------------------------------------------------------------------------

  /**
   * Encode a payload into 10 data + 10 parity shards using GF(2^8) RS.
   * Returns a BlobRecord ready for distributed placement.
   *
   * HONEST LIMITATION: This encodes and stores shards in memory.
   * Actual distribution across diverse nodes is a separate network operation.
   *
   * @param {string} blobId
   * @param {Buffer|string} rawPayload
   * @param {string} payloadType - DATA_CLASS constant
   * @param {number} blockHeight
   * @param {number} chunkIndex
   * @returns {BlobRecord}
   */
  encodeBlob(blobId, rawPayload, payloadType = DATA_CLASS.C8_APP_DATA, blockHeight = 0, chunkIndex = 0) {
    if (!MESH_CLASSES.has(payloadType)) {
      throw new Error(
        `Data class ${payloadType} is not a storage mesh class. ` +
        `C1-C3 are replicated via P2P consensus, not the storage mesh.`
      );
    }

    const buffer = Buffer.isBuffer(rawPayload) ? rawPayload : Buffer.from(rawPayload);
    if (buffer.length > RS_PARAMS.MAX_CHUNK_BYTES) {
      throw new Error(
        `Payload too large (${buffer.length} bytes). Max is ${RS_PARAMS.MAX_CHUNK_BYTES} bytes per chunk. ` +
        `Split into multiple chunks before encoding.`
      );
    }

    const n = RS_PARAMS.DATA_SHARDS;
    const originalSize = buffer.length;
    const shardSize = Math.ceil(originalSize / n);

    // Pad payload to exactly n * shardSize
    const paddedBuffer = Buffer.alloc(n * shardSize);
    buffer.copy(paddedBuffer);

    // Split into n data shards
    const dataShards = [];
    for (let i = 0; i < n; i++) {
      dataShards.push(paddedBuffer.slice(i * shardSize, (i + 1) * shardSize));
    }

    // Compute m parity shards via GF(2^8) RS
    const parityShards = this._codec.encode(dataShards);

    // Hash all 20 shards
    const allShards = [...dataShards, ...parityShards];
    const shardRecords = allShards.map((data, index) => ({
      index,
      type:     index < n ? 'DATA' : 'PARITY',
      data:     data,
      hash:     crypto.createHash('sha256').update(data).digest('hex'),
      nodeId:   null,  // set during placement
      placedAt: null,
    }));

    // Build Merkle tree over shard hashes
    const leaves = shardRecords.map(s => ({ key: `shard:${s.index}`, hash: s.hash }));
    const merkleTree = new MerkleTree(leaves);
    const merkleRoot = merkleTree.getRoot();

    const record = {
      blobId,
      payloadType,
      blockHeight,
      chunkIndex,
      originalSize,
      shardSize,
      encoding:   'RS-GF256-10-10',
      merkleRoot,
      shards:     shardRecords,
      status:     BLOB_STATUS.DURABILITY_PENDING,
      createdAt:  Date.now(),
      _merkleTree: merkleTree,
    };

    this.blobs.set(blobId, record);
    return record;
  }

  // -------------------------------------------------------------------------
  // Reconstruct (Any >= 10 Shards → Original Payload)
  // -------------------------------------------------------------------------

  /**
   * Reconstruct the original payload from any >= 10 available shards.
   * Verifies each shard's SHA-256 hash before using it in reconstruction.
   *
   * @param {string} blobId
   * @param {Array<{index:number, data:Buffer, hash:string}>} availableShards
   * @returns {Buffer} the original payload (trimmed to originalSize)
   * @throws if fewer than 10 valid shards, or if blob is not registered
   */
  reconstructBlob(blobId, availableShards) {
    const record = this.blobs.get(blobId);
    if (!record) throw new Error(`Unknown blobId: ${blobId}`);

    if (!availableShards || availableShards.length < RS_PARAMS.RECONSTRUCTION_THRESHOLD) {
      throw new Error(
        `Insufficient shards: ${availableShards?.length ?? 0} < ` +
        `${RS_PARAMS.RECONSTRUCTION_THRESHOLD} (reconstruction threshold). ` +
        `Data cannot be reconstructed from mesh alone.`
      );
    }

    const total = RS_PARAMS.TOTAL_SHARDS;
    const shardLen = record.shardSize;

    // Build full shard array; validate each shard's hash before use
    const shardSlots = new Array(total).fill(null);
    for (const s of availableShards) {
      if (s.index < 0 || s.index >= total) continue;
      const computedHash = crypto.createHash('sha256').update(s.data).digest('hex');
      if (computedHash !== record.shards[s.index].hash) {
        console.warn(`⚠️ [StorageMesh] Shard ${s.index} of ${blobId} failed hash verification — discarding`);
        continue;  // reject corrupted shard; do not use in reconstruction
      }
      if (s.data.length !== shardLen) {
        console.warn(`⚠️ [StorageMesh] Shard ${s.index} has wrong length — discarding`);
        continue;
      }
      shardSlots[s.index] = { index: s.index, data: s.data };
    }

    const validCount = shardSlots.filter(s => s !== null).length;
    if (validCount < RS_PARAMS.RECONSTRUCTION_THRESHOLD) {
      throw new Error(
        `Only ${validCount} valid shards after hash verification. ` +
        `${RS_PARAMS.RECONSTRUCTION_THRESHOLD} required. Some shards are corrupted.`
      );
    }

    // Reconstruct via GF(2^8) RS decoding
    const dataShards = this._codec.reconstruct(shardSlots);

    // Concatenate data shards and trim to original size
    const reconstructed = Buffer.concat(dataShards);
    return reconstructed.slice(0, record.originalSize);
  }

  // -------------------------------------------------------------------------
  // Placement Diversity
  // -------------------------------------------------------------------------

  /**
   * Validate that shard placement satisfies the Multi-Dimensional Diversity Rule.
   * Returns { valid, reason }.
   *
   * Rule:
   *   max 1 shard per operatorId
   *   max 2 shards per ASN
   *   max 2 shards per geoRegion
   *   max 2 shards per hostProvider
   *
   * @param {Array<{operatorId, asn, geoRegion, hostProvider}>} placements
   * @returns {{ valid: boolean, reason: string }}
   */
  validatePlacementDiversity(placements) {
    const counts = {
      operator: new Map(),
      asn:      new Map(),
      region:   new Map(),
      host:     new Map(),
    };

    for (const p of placements) {
      const check = (map, key, limit, label) => {
        if (!key) return null;
        const c = (map.get(key) || 0) + 1;
        map.set(key, c);
        if (c > limit) return { valid: false, reason: `${label} '${key}' holds ${c} shards (limit: ${limit})` };
        return null;
      };

      const violations = [
        check(counts.operator, p.operatorId, PLACEMENT_LIMITS.MAX_PER_OPERATOR, 'Operator'),
        check(counts.asn,      p.asn,        PLACEMENT_LIMITS.MAX_PER_ASN,      'ASN'),
        check(counts.region,   p.geoRegion,  PLACEMENT_LIMITS.MAX_PER_REGION,   'GeoRegion'),
        check(counts.host,     p.hostProvider, PLACEMENT_LIMITS.MAX_PER_HOST,   'HostProvider'),
      ].filter(Boolean);

      if (violations.length > 0) return violations[0];
    }

    return { valid: true, reason: 'All diversity constraints satisfied' };
  }

  /**
   * Assign shards to nodes, enforcing diversity constraints.
   * Returns the assignment map or throws if insufficient diverse nodes available.
   *
   * @param {string} blobId
   * @param {string[]} candidateNodeIds - ordered by preference
   * @returns {Map<number, string>} shardIndex -> nodeId
   */
  assignShards(blobId, candidateNodeIds) {
    const record = this.blobs.get(blobId);
    if (!record) throw new Error(`Unknown blobId: ${blobId}`);

    const total = RS_PARAMS.TOTAL_SHARDS;
    const assignment = new Map(); // shardIndex -> nodeId
    const usedPlacements = [];

    for (let shardIdx = 0; shardIdx < total; shardIdx++) {
      let assigned = false;
      for (const nodeId of candidateNodeIds) {
        if ([...assignment.values()].includes(nodeId)) continue; // one shard per node
        const nodeMeta = this.knownNodes.get(nodeId);
        if (!nodeMeta) continue;

        const trial = [...usedPlacements, nodeMeta];
        const check = this.validatePlacementDiversity(trial);
        if (check.valid) {
          assignment.set(shardIdx, nodeId);
          usedPlacements.push(nodeMeta);
          record.shards[shardIdx].nodeId = nodeId;
          record.shards[shardIdx].placedAt = Date.now();
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        record.status = BLOB_STATUS.DURABILITY_PENDING;
        throw new Error(
          `Cannot assign shard ${shardIdx}: no candidate node satisfies diversity constraints. ` +
          `Blob marked DURABILITY_PENDING. Add more diverse nodes to the network.`
        );
      }
    }

    record.status = BLOB_STATUS.DURABLE; // provisionally — pending MAISS confirmation
    return assignment;
  }

  // -------------------------------------------------------------------------
  // MAISS Challenge Protocol
  // -------------------------------------------------------------------------

  /**
   * Generate a MAISS challenge for a specific shard.
   *
   * Challenge seed = SHA-256(blockHash || epochStr || shardIndex)
   * Leaf index = parseInt(challengeSeed[0:8], 16) mod leafCount
   *
   * The blockHash must be a finalized block hash (post-consensus entropy).
   * This prevents grinding: the node cannot predict future challenge seeds.
   *
   * CLASSIFICATION: This is MAISS (Merkle Availability & Integrity Spot-Sampling),
   * NOT formal Proof of Retrievability (PoR). See PHASE_2_3_STORAGE_SECURITY_MODEL.md.
   *
   * @param {string} blobId
   * @param {number} shardIndex
   * @param {number} epoch
   * @param {string} blockHash - finalized block hash providing post-consensus entropy
   * @returns {{ blobId, shardIndex, epoch, blockHash, challengeSeed, leafIndex, issuedAt }}
   */
  generateChallenge(blobId, shardIndex, epoch, blockHash) {
    const record = this.blobs.get(blobId);
    if (!record) throw new Error(`Unknown blobId: ${blobId}`);
    if (shardIndex < 0 || shardIndex >= RS_PARAMS.TOTAL_SHARDS) {
      throw new Error(`Invalid shardIndex: ${shardIndex}`);
    }

    const challengeSeed = crypto
      .createHash('sha256')
      .update(`${blockHash}:${epoch}:${shardIndex}`)
      .digest('hex');

    const shardData = record.shards[shardIndex].data;
    const leafCount = Math.floor(shardData.length / MAISS_PARAMS.LEAF_SIZE_BYTES);
    if (leafCount < 1) throw new Error('Shard too small for MAISS challenge');

    const leafIndex = parseInt(challengeSeed.slice(0, 8), 16) % leafCount;

    return {
      blobId,
      shardIndex,
      epoch,
      blockHash,
      challengeSeed,
      leafIndex,
      issuedAt: Date.now(),
    };
  }

  /**
   * Generate a MAISS proof response. Called by the storage node being challenged.
   *
   * Proof = HMAC-SHA256(rawLeafBytes, challengeSeed)
   * Node must hold raw shard bytes to compute this correctly.
   *
   * @param {Buffer} shardData - raw shard bytes held by storage node
   * @param {object} challenge
   * @returns {{ leafIndex, leafHash, hmacProof, respondedAt }}
   */
  generateProof(shardData, challenge) {
    const { challengeSeed, leafIndex } = challenge;
    const leafStart = leafIndex * MAISS_PARAMS.LEAF_SIZE_BYTES;
    const rawLeaf = shardData.slice(leafStart, leafStart + MAISS_PARAMS.LEAF_SIZE_BYTES);

    const leafHash = crypto.createHash('sha256').update(rawLeaf).digest('hex');
    const hmacProof = crypto.createHmac('sha256', challengeSeed).update(rawLeaf).digest('hex');

    return {
      leafIndex,
      leafHash,
      hmacProof,
      respondedAt: Date.now(),
    };
  }

  /**
   * Verify a MAISS proof response. Called by the challenger.
   *
   * The challenger must hold the raw shard data to verify.
   * In a real deployment the challenger is a full node or validator
   * that has retrieved the shard independently for verification.
   *
   * @param {Buffer} shardData - challenger's copy of shard bytes
   * @param {object} challenge
   * @param {object} proof
   * @param {number} receivedAt - wall-clock time proof was received
   * @returns {{ valid: boolean, reason: string }}
   */
  verifyProof(shardData, challenge, proof, receivedAt) {
    const { challengeSeed, leafIndex: expectedLeaf, issuedAt } = challenge;

    // 1. Deadline check
    const elapsed = receivedAt - issuedAt;
    if (elapsed > MAISS_PARAMS.DEADLINE_MS) {
      return { valid: false, reason: `Response too slow: ${elapsed}ms > ${MAISS_PARAMS.DEADLINE_MS}ms deadline` };
    }

    // 2. Leaf index must match
    if (proof.leafIndex !== expectedLeaf) {
      return { valid: false, reason: `Leaf index mismatch: got ${proof.leafIndex}, expected ${expectedLeaf}` };
    }

    // 3. Recompute HMAC from challenger's shard copy
    const leafStart = expectedLeaf * MAISS_PARAMS.LEAF_SIZE_BYTES;
    const rawLeaf = shardData.slice(leafStart, leafStart + MAISS_PARAMS.LEAF_SIZE_BYTES);
    const expectedHmac = crypto.createHmac('sha256', challengeSeed).update(rawLeaf).digest('hex');

    if (expectedHmac !== proof.hmacProof) {
      return { valid: false, reason: 'HMAC mismatch: proof does not match shard content' };
    }

    return { valid: true, reason: 'MAISS proof verified' };
  }

  // -------------------------------------------------------------------------
  // Availability Monitoring & Self-Healing
  // -------------------------------------------------------------------------

  /**
   * Evaluate the current redundancy state of a blob and determine
   * what action (if any) is required.
   *
   * @param {string} blobId
   * @param {number} activeShardCount - number of shards currently confirmed online
   * @returns {{ status: string, repairJob: object|null }}
   */
  evaluateAvailability(blobId, activeShardCount) {
    const record = this.blobs.get(blobId);
    if (!record) throw new Error(`Unknown blobId: ${blobId}`);

    let status;
    if (activeShardCount >= RS_PARAMS.AVAILABILITY_THRESHOLD) {
      status = BLOB_STATUS.DURABLE;
    } else if (activeShardCount >= RS_PARAMS.REPAIR_THRESHOLD) {
      status = BLOB_STATUS.DEGRADED;
    } else if (activeShardCount >= RS_PARAMS.RECONSTRUCTION_THRESHOLD) {
      status = BLOB_STATUS.CRITICAL;
    } else {
      status = BLOB_STATUS.UNRECOVERABLE;
    }

    record.status = status;
    record.lastChecked = Date.now();
    record.lastActiveShardCount = activeShardCount;

    let repairJob = null;

    if (activeShardCount < RS_PARAMS.REPAIR_THRESHOLD && status !== BLOB_STATUS.UNRECOVERABLE) {
      // Trigger self-healing repair
      repairJob = {
        blobId,
        triggeredAt:      Date.now(),
        activeShards:     activeShardCount,
        targetShards:     RS_PARAMS.TOTAL_SHARDS,
        requiredNewShards: RS_PARAMS.TOTAL_SHARDS - activeShardCount,
        status:           'PENDING_REPAIR',
        urgency:          activeShardCount < 7 ? 'EMERGENCY' : 'HIGH',
      };
      this.repairJobs.set(blobId, repairJob);

      console.warn(
        `⚠️ [StorageMesh] Self-healing triggered for '${blobId}': ` +
        `${activeShardCount} < ${RS_PARAMS.REPAIR_THRESHOLD} shards active. ` +
        `Urgency: ${repairJob.urgency}`
      );
    }

    if (status === BLOB_STATUS.UNRECOVERABLE) {
      console.error(
        `🚨 [StorageMesh] UNRECOVERABLE: blob '${blobId}' has only ${activeShardCount} shards. ` +
        `Cannot reconstruct from mesh alone. Archival fallback required.`
      );
    }

    return { status, repairJob };
  }

  /**
   * Execute the repair process:
   * 1. Gather surviving shards
   * 2. Verify their hashes
   * 3. Reconstruct via RS decoding
   * 4. Re-encode all 20 shards
   * 5. Return new shards for re-distribution
   *
   * The actual network upload to new nodes is the caller's responsibility.
   *
   * @param {string} blobId
   * @param {Array<{index, data, hash}>} survivingShards - shards successfully fetched
   * @returns {{ newShards: Array<ShardRecord>, repairedBlobId: string }}
   */
  executeRepair(blobId, survivingShards) {
    const record = this.blobs.get(blobId);
    if (!record) throw new Error(`Unknown blobId: ${blobId}`);

    if (survivingShards.length < RS_PARAMS.RECONSTRUCTION_THRESHOLD) {
      throw new Error(
        `Cannot repair ${blobId}: only ${survivingShards.length} shards available. ` +
        `Minimum ${RS_PARAMS.RECONSTRUCTION_THRESHOLD} required. Data may be permanently lost.`
      );
    }

    // Reconstruct original payload
    const payload = this.reconstructBlob(blobId, survivingShards);

    // Re-encode from scratch to produce all 20 fresh shards
    const repairedRecord = this.encodeBlob(
      blobId,
      payload,
      record.payloadType,
      record.blockHeight,
      record.chunkIndex
    );

    // Sanity: verify merkle root matches original (content identity check)
    if (repairedRecord.merkleRoot !== record.merkleRoot) {
      throw new Error(
        `Repair integrity failure: merkle root mismatch after re-encoding. ` +
        `Original: ${record.merkleRoot}. Repaired: ${repairedRecord.merkleRoot}`
      );
    }

    const repairJob = this.repairJobs.get(blobId);
    if (repairJob) {
      repairJob.status = 'REPAIRED';
      repairJob.repairedAt = Date.now();
    }

    console.log(`✅ [StorageMesh] Repair complete for '${blobId}': all 20 shards re-encoded`);
    return { newShards: repairedRecord.shards, repairedBlobId: blobId };
  }

  // -------------------------------------------------------------------------
  // VSU Accounting
  // -------------------------------------------------------------------------

  /**
   * Record a successful MAISS challenge pass for a node in the current epoch.
   * Increments the node's Verified Storage Unit (VSU) count.
   *
   * VSU is the basis for storage incentive calculation (see PHASE_2_3_INCENTIVE_MODEL.md).
   * This does NOT distribute rewards — rewards require a separate economic layer.
   *
   * @param {string} nodeId
   * @param {number} qualityMultiplier - e.g. 1.1 for fast response, 0.7 for slow
   */
  recordVSU(nodeId, qualityMultiplier = 1.0) {
    const current = this.vsuLedger.get(nodeId) || 0;
    this.vsuLedger.set(nodeId, current + qualityMultiplier);
  }

  /**
   * Get VSU snapshot for all nodes in current epoch.
   * @returns {Object} { [nodeId]: vsuCount }
   */
  getVSUSnapshot() {
    const snap = {};
    for (const [nodeId, vsu] of this.vsuLedger) {
      snap[nodeId] = vsu;
    }
    return snap;
  }

  /**
   * Reset VSU ledger at epoch boundary.
   */
  resetEpochVSU() {
    this.vsuLedger.clear();
  }

  // -------------------------------------------------------------------------
  // Query Helpers
  // -------------------------------------------------------------------------

  /**
   * Get blob record (without raw shard data — safe for API exposure).
   * @param {string} blobId
   * @returns {object|null}
   */
  getBlobStatus(blobId) {
    const record = this.blobs.get(blobId);
    if (!record) return null;
    return {
      blobId:           record.blobId,
      payloadType:      record.payloadType,
      blockHeight:      record.blockHeight,
      chunkIndex:       record.chunkIndex,
      originalSize:     record.originalSize,
      encoding:         record.encoding,
      merkleRoot:       record.merkleRoot,
      status:           record.status,
      createdAt:        record.createdAt,
      lastChecked:      record.lastChecked || null,
      lastActiveShards: record.lastActiveShardCount || null,
      shards:           record.shards.map(s => ({
        index:    s.index,
        type:     s.type,
        hash:     s.hash,
        nodeId:   s.nodeId,
        placedAt: s.placedAt,
      })),
    };
  }

  /**
   * Get active repair jobs.
   * @returns {object[]}
   */
  getRepairJobs() {
    return [...this.repairJobs.values()];
  }
}

export default StorageMeshEngine;
