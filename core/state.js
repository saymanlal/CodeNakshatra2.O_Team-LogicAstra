import crypto from 'crypto';
import StateTree from './stateTree.js';

/**
 * State Engine — Phase 9: Smart Contract Platform
 *
 * Fixes from Phase 8:
 *  - Replaced require('crypto') with ES module import
 *  - Added reputation engine (getReputation, setReputation, increaseReputation, decreaseReputation)
 *  - Added event log (addEvent, getEvents, getContractEvents)
 *  - exportState() now includes events and reputation
 *  - importState() restores events and reputation
 *  - deployContract() now stores name, version, abi metadata
 */

class StateEngine {
  constructor() {
    this.balances      = new Map();
    this.nonces        = new Map();
    this.stakes        = new Map();
    this.unstaking     = new Map();
    this.publicKeys    = new Map();
    this.contracts     = new Map();
    this.contractStorage = new Map();

    // ✅ Phase 9: Reputation engine
    this.reputation    = new Map();

    // ✅ Phase 9: Event log
    this.eventLog      = [];

    // Phase 8: Merkle state tree
    this.stateTree = new StateTree();
  }

  // ─── Balance ────────────────────────────────────────────────────────────────

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
      throw new Error(`Insufficient balance for ${address}: has ${current}, needs ${amount}`);
    }
    this.balances.set(address, current - amount);
    this.updateStateTree(address);
  }

  setBalance(address, amount) {
    this.balances.set(address, amount);
    this.updateStateTree(address);
  }

  // ─── Nonce ──────────────────────────────────────────────────────────────────

  getNonce(address) {
    return this.nonces.get(address) || 0;
  }

  incrementNonce(address) {
    this.nonces.set(address, this.getNonce(address) + 1);
    this.updateStateTree(address);
  }

  setNonce(address, nonce) {
    this.nonces.set(address, nonce);
    this.updateStateTree(address);
  }

  // ─── Stake ──────────────────────────────────────────────────────────────────

  getStake(address) {
    return this.stakes.get(address) || 0;
  }

  addStake(address, amount) {
    this.stakes.set(address, this.getStake(address) + amount);
    this.updateStateTree(address);
  }

  subtractStake(address, amount) {
    this.stakes.set(address, Math.max(0, this.getStake(address) - amount));
    this.updateStateTree(address);
  }

  setStake(address, amount) {
    this.stakes.set(address, amount);
    this.updateStateTree(address);
  }

  stake(address, amount) {
    this.addStake(address, amount);
  }

  // ─── Unstaking ──────────────────────────────────────────────────────────────

  isUnstaking(address) {
    return this.unstaking.has(address);
  }

  initiateUnstake(address, unlockBlock) {
    this.unstaking.set(address, { unlockBlock, amount: this.getStake(address) });
  }

  getUnlockBlock(address) {
    return this.unstaking.get(address)?.unlockBlock || 0;
  }

  // ─── Public keys ────────────────────────────────────────────────────────────

  setPublicKey(address, publicKey) {
    this.publicKeys.set(address, publicKey);
  }

  getPublicKey(address) {
    return this.publicKeys.get(address);
  }

  // ─── Validators ─────────────────────────────────────────────────────────────

  getValidators() {
    const validators = [];
    for (const [address, stake] of this.stakes.entries()) {
      if (stake > 0) {
        validators.push({ address, stake, isActive: true, missedBlocks: 0 });
      }
    }
    return validators;
  }

  getTotalStake() {
    let total = 0;
    for (const stake of this.stakes.values()) total += stake;
    return total;
  }

  resetMissedBlocks(_address) {
    // Placeholder — extend for validator performance tracking
  }

  // ─── Reputation (Phase 9) ───────────────────────────────────────────────────

  getReputation(address) {
    return this.reputation.get(address) || 0;
  }

  setReputation(address, score) {
    this.reputation.set(address, score);
  }

  increaseReputation(address, amount = 20) {
    const current = this.getReputation(address);
    this.reputation.set(address, current + amount);
  }

  decreaseReputation(address, amount = 10) {
    const current = this.getReputation(address);
    this.reputation.set(address, Math.max(0, current - amount));
  }

  // ─── Events (Phase 9) ───────────────────────────────────────────────────────

  addEvent(event) {
    this.eventLog.push({
      ...event,
      id: crypto.createHash('sha256')
        .update(JSON.stringify(event) + Date.now())
        .digest('hex')
        .substring(0, 16)
    });
  }

  getEvents({ contractAddress, eventName, limit } = {}) {
    let results = [...this.eventLog];

    if (contractAddress) {
      results = results.filter(e => e.contract === contractAddress);
    }
    if (eventName) {
      results = results.filter(e => e.event === eventName);
    }
    if (limit) {
      results = results.slice(-limit);
    }

    return results;
  }

  getContractEvents(contractAddress) {
    return this.eventLog.filter(e => e.contract === contractAddress);
  }

  // ─── Contracts ──────────────────────────────────────────────────────────────

  /**
   * @param {string} address
   * @param {string} code
   * @param {string} creator
   * @param {object} meta - { name, version, abi, codeHash }
   */
  deployContract(address, code, creator, meta = {}) {
    // ✅ Fix: use imported crypto, not require('crypto')
    const codeHash = meta.codeHash ||
      crypto.createHash('sha256').update(code).digest('hex');

    this.contracts.set(address, {
      address,
      code,
      creator,
      // ✅ Phase 9: store metadata
      name:    meta.name    || 'UnnamedContract',
      version: meta.version || '1.0.0',
      abi:     meta.abi     || [],
      state:   {},
      createdAt: Date.now(),
      codeHash,
      blockIndex: meta.blockIndex || null
    });

    this.updateStateTree(address, codeHash);
  }

  getContract(address) {
    return this.contracts.get(address);
  }

  getContractFullState(address) {
    const contract = this.contracts.get(address);
    return contract ? contract.state : {};
  }

  getAllContracts() {
    return Array.from(this.contracts.values());
  }

  setContractState(contractAddress, key, value) {
    const contract = this.contracts.get(contractAddress);
    if (contract) {
      contract.state[key] = value;
    }

    this.stateTree.setContractStorage(contractAddress, key, value);
    const storageRoot = this.stateTree.computeStorageRoot(contractAddress);
    this.updateStateTree(contractAddress, contract?.codeHash, storageRoot);
  }

  getContractState(contractAddress, key) {
    const contract = this.contracts.get(contractAddress);
    return contract?.state?.[key];
  }

  // ─── Merkle state tree (Phase 8+) ───────────────────────────────────────────

  updateStateTree(address, contractCodeHash = null, storageRoot = null) {
    this.stateTree.setAccount(address, {
      balance: this.getBalance(address),
      nonce:   this.getNonce(address),
      stake:   this.getStake(address),
      contractCodeHash: contractCodeHash || this.contracts.get(address)?.codeHash || null,
      storageRoot: storageRoot || null
    });
  }

  computeStateRoot() {
    for (const address of this.balances.keys())  this.updateStateTree(address);
    for (const address of this.nonces.keys())    this.updateStateTree(address);
    for (const address of this.stakes.keys())    this.updateStateTree(address);
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

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  clear() {
    this.balances.clear();
    this.nonces.clear();
    this.stakes.clear();
    this.unstaking.clear();
    this.publicKeys.clear();
    this.contracts.clear();
    this.contractStorage.clear();
    this.reputation.clear();
    this.eventLog = [];
    this.stateTree.clear();
  }

  exportState() {
    return {
      balances:    Array.from(this.balances.entries()),
      nonces:      Array.from(this.nonces.entries()),
      stakes:      Array.from(this.stakes.entries()),
      unstaking:   Array.from(this.unstaking.entries()),
      publicKeys:  Array.from(this.publicKeys.entries()),
      contracts:   Array.from(this.contracts.entries()),
      contractStorage: Array.from(this.contractStorage.entries()),
      // ✅ Phase 9: include reputation and events in snapshots
      reputation:  Array.from(this.reputation.entries()),
      eventLog:    this.eventLog,
      stateTree:   this.stateTree.exportSnapshot()
    };
  }

  importState(state) {
    this.balances    = new Map(state.balances);
    this.nonces      = new Map(state.nonces);
    this.stakes      = new Map(state.stakes);
    this.unstaking   = new Map(state.unstaking);
    this.publicKeys  = new Map(state.publicKeys);
    this.contracts   = new Map(state.contracts);
    this.contractStorage = new Map(state.contractStorage || []);
    // ✅ Phase 9: restore reputation and events
    this.reputation  = new Map(state.reputation  || []);
    this.eventLog    = state.eventLog || [];
    if (state.stateTree) {
      this.stateTree.importSnapshot(state.stateTree);
    }
  }
}

export default StateEngine;