import StateTree from './stateTree.js';

/**
 * State Engine with Merkle Tree Integration
 * Phase 8: Cryptographically verifiable state
 */

class StateEngine {
  constructor() {
    this.balances = new Map();
    this.nonces = new Map();
    this.stakes = new Map();
    this.unstaking = new Map();
    this.publicKeys = new Map();
    this.contracts = new Map();
    this.contractStorage = new Map();
    
    // Phase 8: Merkle state tree
    this.stateTree = new StateTree();
  }

  // Balance operations
  getBalance(address) {
    return this.balances.get(address) || 0;
  }

  addBalance(address, amount) {
    const current = this.getBalance(address);
    this.balances.set(address, current + amount);
    this.updateStateTree(address);
  }

  subtractBalance(address, amount) {
    const current = this.getBalance(address);
    if (current < amount) {
      throw new Error(`Insufficient balance for ${address}`);
    }
    this.balances.set(address, current - amount);
    this.updateStateTree(address);
  }

  setBalance(address, amount) {
    this.balances.set(address, amount);
    this.updateStateTree(address);
  }

  // Nonce operations
  getNonce(address) {
    return this.nonces.get(address) || 0;
  }

  incrementNonce(address) {
    const current = this.getNonce(address);
    this.nonces.set(address, current + 1);
    this.updateStateTree(address);
  }

  setNonce(address, nonce) {
    this.nonces.set(address, nonce);
    this.updateStateTree(address);
  }

  // Stake operations
  getStake(address) {
    return this.stakes.get(address) || 0;
  }

  addStake(address, amount) {
    const current = this.getStake(address);
    this.stakes.set(address, current + amount);
    this.updateStateTree(address);
  }

  subtractStake(address, amount) {
    const current = this.getStake(address);
    this.stakes.set(address, Math.max(0, current - amount));
    this.updateStateTree(address);
  }

  setStake(address, amount) {
    this.stakes.set(address, amount);
    this.updateStateTree(address);
  }

  stake(address, amount) {
    this.addStake(address, amount);
  }

  // Unstaking operations
  isUnstaking(address) {
    return this.unstaking.has(address);
  }

  initiateUnstake(address, unlockBlock) {
    this.unstaking.set(address, { unlockBlock, amount: this.getStake(address) });
  }

  getUnlockBlock(address) {
    return this.unstaking.get(address)?.unlockBlock || 0;
  }

  // Public key operations
  setPublicKey(address, publicKey) {
    this.publicKeys.set(address, publicKey);
  }

  getPublicKey(address) {
    return this.publicKeys.get(address);
  }

  // Validator operations
  getValidators() {
    const validators = [];
    for (const [address, stake] of this.stakes.entries()) {
      if (stake > 0) {
        validators.push({
          address,
          stake,
          isActive: true,
          missedBlocks: 0
        });
      }
    }
    return validators;
  }

  getTotalStake() {
    let total = 0;
    for (const stake of this.stakes.values()) {
      total += stake;
    }
    return total;
  }

  resetMissedBlocks(address) {
    // Placeholder for validator performance tracking
  }

  // Contract operations
  deployContract(address, code, creator) {
    const contractCodeHash = require('crypto')
      .createHash('sha256')
      .update(code)
      .digest('hex');

    this.contracts.set(address, {
      address,
      code,
      creator,
      state: {},
      createdAt: Date.now(),
      codeHash: contractCodeHash
    });

    this.updateStateTree(address, contractCodeHash);
  }

  getContract(address) {
    return this.contracts.get(address);
  }

  getAllContracts() {
    return Array.from(this.contracts.values());
  }

  setContractState(contractAddress, key, value) {
    const contract = this.contracts.get(contractAddress);
    if (contract) {
      contract.state[key] = value;
    }

    // Update storage tree
    this.stateTree.setContractStorage(contractAddress, key, value);
    
    // Update state tree with new storage root
    const storageRoot = this.stateTree.computeStorageRoot(contractAddress);
    this.updateStateTree(contractAddress, contract?.codeHash, storageRoot);
  }

  getContractState(contractAddress, key) {
    const contract = this.contracts.get(contractAddress);
    return contract?.state?.[key];
  }

  // Phase 8: State tree operations
  updateStateTree(address, contractCodeHash = null, storageRoot = null) {
    this.stateTree.setAccount(address, {
      balance: this.getBalance(address),
      nonce: this.getNonce(address),
      stake: this.getStake(address),
      contractCodeHash: contractCodeHash || this.contracts.get(address)?.codeHash || null,
      storageRoot: storageRoot || null
    });
  }

  computeStateRoot() {
    // Update all accounts in state tree
    for (const address of this.balances.keys()) {
      this.updateStateTree(address);
    }
    for (const address of this.nonces.keys()) {
      this.updateStateTree(address);
    }
    for (const address of this.stakes.keys()) {
      this.updateStateTree(address);
    }
    for (const [address, contract] of this.contracts.entries()) {
      const storageRoot = this.stateTree.computeStorageRoot(address);
      this.updateStateTree(address, contract.codeHash, storageRoot);
    }

    return this.stateTree.computeStateRoot();
  }

  generateProof(address) {
    return this.stateTree.generateProof(address);
  }

  verifyProof(proof, root) {
    return this.stateTree.verifyProof(proof, root);
  }

  // Clear state
  clear() {
    this.balances.clear();
    this.nonces.clear();
    this.stakes.clear();
    this.unstaking.clear();
    this.publicKeys.clear();
    this.contracts.clear();
    this.contractStorage.clear();
    this.stateTree.clear();
  }

  // Export/Import for snapshots
  exportState() {
    return {
      balances: Array.from(this.balances.entries()),
      nonces: Array.from(this.nonces.entries()),
      stakes: Array.from(this.stakes.entries()),
      unstaking: Array.from(this.unstaking.entries()),
      publicKeys: Array.from(this.publicKeys.entries()),
      contracts: Array.from(this.contracts.entries()),
      stateTree: this.stateTree.exportSnapshot()
    };
  }

  importState(state) {
    this.balances = new Map(state.balances);
    this.nonces = new Map(state.nonces);
    this.stakes = new Map(state.stakes);
    this.unstaking = new Map(state.unstaking);
    this.publicKeys = new Map(state.publicKeys);
    this.contracts = new Map(state.contracts);
    if (state.stateTree) {
      this.stateTree.importSnapshot(state.stateTree);
    }
  }
}

export default StateEngine;
