import MerkleTree, { createStateTree, createStorageTree } from './merkle.js';

/**
 * State Tree Manager
 * Manages Merkle-based state with cryptographic verification
 */

class StateTree {
  constructor() {
    this.accounts = {}; // address -> account data
    this.contractStorage = {}; // contractAddress -> { key -> value }
    this.tree = null;
    this.stateRoot = null;
  }

  /**
   * Set account data
   */
  setAccount(address, data) {
    this.accounts[address] = {
      balance: data.balance || 0,
      nonce: data.nonce || 0,
      stake: data.stake || 0,
      contractCodeHash: data.contractCodeHash || null,
      storageRoot: data.storageRoot || null,
      ...data
    };
  }

  /**
   * Get account data
   */
  getAccount(address) {
    return this.accounts[address] || {
      balance: 0,
      nonce: 0,
      stake: 0,
      contractCodeHash: null,
      storageRoot: null
    };
  }

  /**
   * Set contract storage
   */
  setContractStorage(contractAddress, key, value) {
    if (!this.contractStorage[contractAddress]) {
      this.contractStorage[contractAddress] = {};
    }
    this.contractStorage[contractAddress][key] = value;
  }

  /**
   * Get contract storage
   */
  getContractStorage(contractAddress, key) {
    return this.contractStorage[contractAddress]?.[key] || null;
  }

  /**
   * Get all contract storage
   */
  getAllContractStorage(contractAddress) {
    return this.contractStorage[contractAddress] || {};
  }

  /**
   * Compute storage root for a contract
   */
  computeStorageRoot(contractAddress) {
    const storage = this.contractStorage[contractAddress];
    if (!storage || Object.keys(storage).length === 0) {
      return null;
    }

    const storageTree = createStorageTree(storage);
    return storageTree.getRoot();
  }

  /**
   * Update all contract storage roots
   */
  updateContractStorageRoots() {
    for (const contractAddress of Object.keys(this.contractStorage)) {
      const storageRoot = this.computeStorageRoot(contractAddress);
      if (this.accounts[contractAddress]) {
        this.accounts[contractAddress].storageRoot = storageRoot;
      }
    }
  }

  /**
   * Compute global state root
   */
  computeStateRoot() {
    // Update all contract storage roots first
    this.updateContractStorageRoots();

    // Create Merkle tree from accounts
    this.tree = createStateTree(this.accounts);
    this.stateRoot = this.tree.getRoot();
    return this.stateRoot;
  }

  /**
   * Generate proof for an account
   */
  generateProof(address) {
    if (!this.tree) {
      this.computeStateRoot();
    }
    return this.tree.generateProof(address);
  }

  /**
   * Verify a proof
   */
  verifyProof(proof, root) {
    return MerkleTree.verifyProof(proof, root);
  }

  /**
   * Get all accounts
   */
  getAllAccounts() {
    return { ...this.accounts };
  }

  /**
   * Clear state
   */
  clear() {
    this.accounts = {};
    this.contractStorage = {};
    this.tree = null;
    this.stateRoot = null;
  }

  /**
   * Export state snapshot
   */
  exportSnapshot() {
    return {
      accounts: { ...this.accounts },
      contractStorage: JSON.parse(JSON.stringify(this.contractStorage)),
      stateRoot: this.stateRoot
    };
  }

  /**
   * Import state snapshot
   */
  importSnapshot(snapshot) {
    this.accounts = { ...snapshot.accounts };
    this.contractStorage = JSON.parse(JSON.stringify(snapshot.contractStorage));
    this.stateRoot = snapshot.stateRoot;
    this.tree = null; // Will be rebuilt on next computeStateRoot
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      accounts: Object.keys(this.accounts).length,
      contracts: Object.keys(this.contractStorage).length,
      stateRoot: this.stateRoot
    };
  }
}

export default StateTree;
