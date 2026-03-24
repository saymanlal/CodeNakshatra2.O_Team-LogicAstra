import crypto from 'crypto';

/**
 * Merkle Tree Implementation for Sayman Blockchain
 * Provides cryptographic state verification and proof generation
 */

class MerkleTree {
  constructor(leaves = []) {
    this.leaves = leaves.sort((a, b) => a.key.localeCompare(b.key)); // Deterministic ordering
    this.tree = [];
    this.root = null;
    if (this.leaves.length > 0) {
      this.buildTree();
    }
  }

  /**
   * Hash a single value
   */
  hash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash two nodes together
   */
  hashPair(left, right) {
    return this.hash(left + right);
  }

  /**
   * Build the complete Merkle tree from leaves
   */
  buildTree() {
    if (this.leaves.length === 0) {
      this.root = this.hash('');
      return;
    }

    // Level 0: Hash all leaves
    let currentLevel = this.leaves.map(leaf => ({
      hash: this.hash(JSON.stringify(leaf)),
      data: leaf
    }));

    this.tree = [currentLevel];

    // Build tree bottom-up
    while (currentLevel.length > 1) {
      const nextLevel = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1];

        if (right) {
          // Pair exists
          nextLevel.push({
            hash: this.hashPair(left.hash, right.hash),
            left: left.hash,
            right: right.hash
          });
        } else {
          // Odd number - carry forward
          nextLevel.push(left);
        }
      }

      this.tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    this.root = currentLevel[0].hash;
  }

  /**
   * Get the Merkle root
   */
  getRoot() {
    return this.root || this.hash('');
  }

  /**
   * Generate a Merkle proof for a specific key
   */
  generateProof(key) {
    if (this.leaves.length === 0) {
      return null;
    }

    // Find leaf index
    const leafIndex = this.leaves.findIndex(leaf => leaf.key === key);
    if (leafIndex === -1) {
      return null;
    }

    const proof = [];
    let currentIndex = leafIndex;

    // Traverse from leaf to root
    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevel = this.tree[level];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLevel.length) {
        proof.push({
          hash: currentLevel[siblingIndex].hash,
          position: isRightNode ? 'left' : 'right'
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[leafIndex],
      leafHash: this.tree[0][leafIndex].hash,
      proof,
      root: this.root
    };
  }

  /**
   * Verify a Merkle proof
   */
  static verifyProof(proof, root) {
    if (!proof || !proof.proof || !proof.leafHash) {
      return false;
    }

    let currentHash = proof.leafHash;

    // Traverse proof path
    for (const step of proof.proof) {
      if (step.position === 'left') {
        currentHash = crypto
          .createHash('sha256')
          .update(step.hash + currentHash)
          .digest('hex');
      } else {
        currentHash = crypto
          .createHash('sha256')
          .update(currentHash + step.hash)
          .digest('hex');
      }
    }

    return currentHash === root;
  }

  /**
   * Get tree statistics
   */
  getStats() {
    return {
      leaves: this.leaves.length,
      levels: this.tree.length,
      root: this.root
    };
  }
}

/**
 * Helper: Create Merkle tree from state accounts
 */
export function createStateTree(accounts) {
  const leaves = Object.entries(accounts).map(([address, account]) => ({
    key: address,
    balance: account.balance || 0,
    nonce: account.nonce || 0,
    stake: account.stake || 0,
    contractCodeHash: account.contractCodeHash || null,
    storageRoot: account.storageRoot || null
  }));

  return new MerkleTree(leaves);
}

/**
 * Helper: Create Merkle tree from contract storage
 */
export function createStorageTree(storage) {
  const leaves = Object.entries(storage).map(([key, value]) => ({
    key,
    value
  }));

  return new MerkleTree(leaves);
}

export default MerkleTree;
