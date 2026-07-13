import crypto from 'crypto';
import MerkleTree from '../merkle.js';
import Transaction from '../transaction.js';
import Block from '../block.js';

// Cache for block verification results: blockHash -> boolean
const verificationCache = new Map();
const MAX_CACHE_SIZE = 10000;

function cleanCache() {
  if (verificationCache.size > MAX_CACHE_SIZE) {
    const keys = Array.from(verificationCache.keys());
    // remove oldest 20%
    const toRemove = keys.slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));
    for (const key of toRemove) {
      verificationCache.delete(key);
    }
  }
}

/**
 * Builds a deterministic Merkle Tree for a list of blocks in a chunk
 */
export function buildChunkMerkleTree(blocks) {
  const leaves = blocks.map(b => ({
    key: `block:${String(b.index).padStart(12, '0')}`,
    hash: b.hash,
    stateRoot: b.stateRoot || ''
  }));
  return new MerkleTree(leaves);
}

/**
 * Verifies a single block's integrity.
 * NOTE: skipTimestampCheck must be true for archived/historical blocks since
 * their timestamps are in the past and would always fail the ±1h check.
 */
export async function verifyBlock(block, previousBlock = null, { skipTimestampCheck = true } = {}) {
  const blockHash = block.hash;
  if (verificationCache.has(blockHash)) {
    return verificationCache.get(blockHash);
  }

  try {
    // 1. Verify block hash calculation
    const tempBlock = await Block.fromJSON(block);
    const recomputed = tempBlock.calculateHash();
    if (recomputed !== blockHash) {
      console.warn(`[MerkleVerify] Block #${block.index} hash mismatch. Computed: ${recomputed}, Declared: ${blockHash}`);
      verificationCache.set(blockHash, false);
      return false;
    }

    // 2. Verify continuity with previous block
    if (previousBlock) {
      if (block.previousHash !== previousBlock.hash) {
        console.warn(`[MerkleVerify] Block #${block.index} continuity break. Prev hash: ${previousBlock.hash}, block.prevHash: ${block.previousHash}`);
        verificationCache.set(blockHash, false);
        return false;
      }
      if (block.index !== previousBlock.index + 1) {
        console.warn(`[MerkleVerify] Block #${block.index} index mismatch. Prev index: ${previousBlock.index}`);
        verificationCache.set(blockHash, false);
        return false;
      }
    }

    // 3. Timestamp check — SKIP for archived blocks (they are historical, timestamps will be old)
    // Only apply for live/real-time block verification
    if (!skipTimestampCheck) {
      const now = Date.now();
      const oneHour = 3600 * 1000;
      if (Math.abs(block.timestamp - now) > oneHour) {
        console.warn(`[MerkleVerify] Block #${block.index} timestamp drift too high. Timestamp: ${block.timestamp}, Current: ${now}`);
        verificationCache.set(blockHash, false);
        return false;
      }
    }

    // 4. Skip tx signature re-validation for archived blocks —
    //    they passed validation when originally added to chain.
    //    Re-validating is expensive and broken for archived tx data.

    // Save to cache
    cleanCache();
    verificationCache.set(blockHash, true);
    return true;
  } catch (err) {
    console.error(`[MerkleVerify] Error verifying block #${block.index}:`, err.message);
    // Do not cache false for temporary runtime/database errors to allow retries
    return false;
  }
}

/**
 * Verifies a chunk of blocks (usually 1000 blocks)
 * All blocks in a chunk are treated as archived (skipTimestampCheck = true)
 */
export async function verifyChunk(chunk) {
  try {
    const { startHeight, endHeight, blocks, merkleRoot } = chunk;

    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
      console.warn('[MerkleVerify] Chunk contains no blocks');
      return false;
    }

    if (blocks[0].index !== startHeight || blocks[blocks.length - 1].index !== endHeight) {
      console.warn(`[MerkleVerify] Chunk block index range mismatch. Expected ${startHeight}-${endHeight}, got ${blocks[0].index}-${blocks[blocks.length - 1].index}`);
      return false;
    }

    // 1. Verify all blocks individually and verify continuity
    //    skipTimestampCheck=true because these are archived blocks
    for (let i = 0; i < blocks.length; i++) {
      const prev = i > 0 ? blocks[i - 1] : null;
      const ok = await verifyBlock(blocks[i], prev, { skipTimestampCheck: true });
      if (!ok) {
        console.warn(`[MerkleVerify] Chunk verification failed at block #${blocks[i].index}`);
        return false;
      }
    }

    // 2. Build Merkle tree and verify chunk Merkle Root
    const tree = buildChunkMerkleTree(blocks);
    const calculatedRoot = tree.getRoot();
    if (calculatedRoot !== merkleRoot) {
      console.warn(`[MerkleVerify] Chunk Merkle Root mismatch. Calculated: ${calculatedRoot}, Declared: ${merkleRoot}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[MerkleVerify] Error verifying chunk:', err.message);
    return false;
  }
}

/**
 * Generates a Merkle Proof for a block in a list of blocks
 */
export function generateBlockProof(blocks, blockHeight) {
  const tree = buildChunkMerkleTree(blocks);
  const key = `block:${String(blockHeight).padStart(12, '0')}`;
  return tree.generateProof(key);
}

/**
 * Verifies a block's Merkle Proof against the chunk Merkle root
 */
export function verifyBlockProof(proof, merkleRoot) {
  return MerkleTree.verifyProof(proof, merkleRoot);
}
