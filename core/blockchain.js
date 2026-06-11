import crypto from 'crypto';
import elliptic from 'elliptic';
import Block from './block.js';
import Transaction, { TX_TYPES } from './transaction.js';
import StateEngine from './state.js';
import ProofOfStake from './pos.js';
import ContractEngine from './contracts.js';
import GasCalculator from './gas.js';
import { Level } from 'level';
import fs from 'fs';
import path from 'path';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

/**
 * Blockchain — Phase 9: Smart Contract Platform
 *
 * New in Phase 9:
 *  - applyTransaction() handles REPORT_CREATE, REPORT_VERIFY, REPORT_RESOLVE, REPUTATION_UPDATE
 *  - createBlock() dispatches contract payload correctly (name/version/abi)
 *  - getEvents() / getContractEvents() public API
 *  - getReputation() public API
 *  - getContractRegistry() — list all deployed contracts with metadata
 *  - addTransaction() validates new tx types
 *
 * Fix (Phase 9.1):
 *  - pendingNonces Map tracks mempool-level nonces separately from confirmed state
 *    so sequential txs in the same block (e.g. deploying 3 contracts at once) work correctly.
 *    Every real L1 (Ethereum, Solana, Cosmos) does this. Without it, only the first tx
 *    per block per address is accepted because confirmed nonce hasn't updated yet.
 */

class Blockchain {
  constructor(config, dbPath = null) {
    this.config      = config;
    this.chainId     = config.chainId;
    this.networkName = config.networkName;
    this.chain       = [];
    this.mempool     = [];
    this.state       = new StateEngine();
    this.pos         = new ProofOfStake(this.state, config);
    this.gas         = new GasCalculator(config);
    this.contracts   = new ContractEngine(this.state, this.gas);

    const finalDbPath = dbPath || `./data/${config.chainId}`;
    this.db = new Level(finalDbPath, { valueEncoding: 'json' });

    this.snapshotInterval = 100;
    this.snapshotDir      = `./data/snapshots/${config.chainId}`;
    this.ensureSnapshotDir();

    this.isProducing    = false;
    this.mempoolLimit   = 1000;
    this.addressTxCount = new Map();
    this.lastCleanup    = Date.now();

    // ─── Phase 9.1 fix: mempool-level pending nonce tracking ────────────────
    // Tracks (confirmedNonce + queued mempool txs) per address so that multiple
    // txs submitted before the next block are accepted with sequential nonces.
    // Reset to empty after every block is mined (confirmed nonces take over).
    this.pendingNonces = new Map();
    // ────────────────────────────────────────────────────────────────────────

    // ✅ Phase 9: in-memory report index for fast queries
    this.reportIndex = new Map();
  }

  ensureSnapshotDir() {
    if (!fs.existsSync('./data/snapshots')) {
      fs.mkdirSync('./data/snapshots', { recursive: true });
    }
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  async initialize() {
    console.log('🔄 Initializing blockchain...');

    try {
      const snapshot = await this.loadLatestSnapshot();

      if (snapshot) {
        console.log(`📸 Loading from snapshot at block ${snapshot.blockHeight}...`);
        this.state.importState(snapshot.state);

        const savedChain = await this.db.get('chain');
        if (savedChain && savedChain.length > snapshot.blockHeight) {
          for (let i = 0; i <= snapshot.blockHeight; i++) {
            this.chain.push(await Block.fromJSON(savedChain[i]));
          }
          for (let i = snapshot.blockHeight + 1; i < savedChain.length; i++) {
            const block = await Block.fromJSON(savedChain[i]);
            this.chain.push(block);
            this.applyBlock(block);
            this._verifyStateRoot(block);
          }
          console.log(`✅ Loaded ${savedChain.length} blocks (${savedChain.length - snapshot.blockHeight} replayed)`);
        }
      } else {
        const savedChain = await this.db.get('chain').catch(() => null);

        if (savedChain && savedChain.length > 0) {
          console.log(`📚 Loading existing blockchain (${savedChain.length} blocks)...`);
          for (const blockData of savedChain) {
            this.chain.push(await Block.fromJSON(blockData));
          }
          console.log('🔄 Rebuilding state from blockchain...');
          await this.replayState();
        } else {
          this.createGenesisBlock();
        }
      }

      console.log('✅ Blockchain initialization complete');
      console.log(`📊 Height: ${this.chain.length} | StateRoot: ${this.state.computeStateRoot().substring(0, 12)}...`);

    } catch (error) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        this.createGenesisBlock();
      } else {
        throw error;
      }
    }
  }

  _verifyStateRoot(block) {
    const computedRoot = this.state.computeStateRoot();
    if (block.stateRoot && block.stateRoot !== computedRoot) {
      throw new Error(`State root mismatch at block ${block.index}. Expected: ${block.stateRoot}, Got: ${computedRoot}`);
    }
  }

  // ─── Genesis ────────────────────────────────────────────────────────────────

  createGenesisBlock() {
    console.log('🌱 Creating genesis block...');
    const genesisConfig = this.config.genesis;
    const allocations   = genesisConfig.allocations || {};

    const faucetSeed    = 'sayman-faucet-seed-2024';
    const faucetHash    = crypto.createHash('sha256').update(faucetSeed).digest('hex');
    const faucetKP      = ec.keyFromPrivate(faucetHash);
    const faucetPub     = faucetKP.getPublic('hex');
    const faucetAddress = crypto.createHash('sha256').update(faucetPub).digest('hex').substring(0, 40);

    this.state.setPublicKey(faucetAddress, faucetPub);

    Object.entries(allocations).forEach(([key, amount]) => {
      let address;
      if (key === 'faucet1') {
        address = faucetAddress;
        this.state.addBalance(address, amount);
        console.log(`✓ Faucet: ${address.substring(0, 8)}... (${amount} SAYM)`);
      } else if (key === 'validator1') {
        const seed  = 'genesis-validator-' + this.chainId;
        const kp    = ec.keyFromPrivate(crypto.createHash('sha256').update(seed).digest('hex'));
        const pub   = kp.getPublic('hex');
        address     = crypto.createHash('sha256').update(pub).digest('hex').substring(0, 40);
        this.state.addBalance(address, amount * 2);
        this.state.stake(address, amount);
        this.pos.addValidator(address, amount);
        console.log(`✓ Validator: ${address.substring(0, 8)}... (Stake: ${amount})`);
      } else {
        const kp  = ec.keyFromPrivate(crypto.createHash('sha256').update(`genesis-${key}-${this.chainId}`).digest('hex'));
        address   = crypto.createHash('sha256').update(kp.getPublic('hex')).digest('hex').substring(0, 40);
        this.state.addBalance(address, amount);
        console.log(`✓ ${key}: ${address.substring(0, 8)}... (${amount} SAYM)`);
      }
    });

    const genesis     = new Block(0, genesisConfig.timestamp, [], '0', 'genesis-validator', 0);
    genesis.stateRoot = this.state.computeStateRoot();
    genesis.hash      = genesis.calculateHash();

    this.chain.push(genesis);
    this.saveBlock(genesis);
    console.log(`✅ Genesis block | StateRoot: ${genesis.stateRoot.substring(0, 12)}...`);
    return genesis;
  }

  // ─── Block production ───────────────────────────────────────────────────────

  async createBlock() {
    if (this.isProducing) return null;
    this.isProducing = true;

    try {
      const lastBlock  = this.getLastBlock();
      const validator  = this.pos.selectValidator(lastBlock.hash);

      if (!validator) {
        this.isProducing = false;
        return null;
      }

      const transactions = [];
      let blockGasUsed   = 0;

      for (const tx of this.mempool) {
        try {
          const gasTracker = this.gas.trackExecution();

          if (tx.type === TX_TYPES.CONTRACT_DEPLOY) {
            // ✅ Phase 9: pass full payload (name, version, abi, code)
            const payload = tx.data.code
              ? { name: tx.data.name, version: tx.data.version, abi: tx.data.abi, code: tx.data.code }
              : tx.data.contractPayload;
            this.contracts.deploy(tx.data.from, payload, tx.timestamp, gasTracker);

          } else if (tx.type === TX_TYPES.CONTRACT_CALL) {
            this.contracts.call(
              tx.data.from,
              tx.data.contractAddress,
              tx.data.method,
              tx.data.args,
              gasTracker,
              tx.gasLimit
            );

          } else if (tx.type === TX_TYPES.REPORT_CREATE) {
            // ✅ Phase 9: index report for fast queries
            gasTracker.gasUsed += this.gas.costs.transfer || 1000;
            this.reportIndex.set(tx.id, {
              txId:         tx.id,
              reporter:     tx.data.from,
              category:     tx.data.category,
              severity:     tx.data.severity,
              location:     tx.data.location,
              evidenceHash: tx.data.evidenceHash,
              description:  tx.data.description,
              status:       'OPEN',
              createdAt:    tx.timestamp
            });

          } else if (tx.type === TX_TYPES.REPORT_VERIFY) {
            gasTracker.gasUsed += this.gas.costs.transfer || 1000;
            const report = this.reportIndex.get(tx.data.reportId);
            if (report) {
              report.verified      = true;
              report.confidence    = tx.data.confidence;
              report.verifiedBy    = tx.data.verifier;
              report.verifiedAt    = Date.now();
              report.aiCategory    = tx.data.aiCategory;
            }
            // Reward reporter reputation if valid
            if (tx.data.isValid) {
              const repTx = Transaction.updateReputation(
                this.reportIndex.get(tx.data.reportId)?.reporter,
                20,
                'Valid report verified'
              );
              transactions.push(repTx);
            }

          } else if (tx.type === TX_TYPES.REPORT_RESOLVE) {
            gasTracker.gasUsed += this.gas.costs.transfer || 1000;
            const report = this.reportIndex.get(tx.data.reportId);
            if (report) {
              report.status     = tx.data.resolution;
              report.resolvedBy = tx.data.authority;
              report.resolvedAt = tx.data.resolvedAt;
              report.note       = tx.data.note;
            }

          } else {
            gasTracker.gasUsed = this.gas.calculateTransactionGas(tx);
          }

          if (blockGasUsed + gasTracker.gasUsed > this.gas.limits.maxGasPerBlock) continue;

          tx.gasUsed = gasTracker.gasUsed;
          transactions.push(tx);
          blockGasUsed += gasTracker.gasUsed;

          const gasFee = tx.gasUsed * tx.gasPrice;
          if (gasFee > 0) {
            transactions.push(Transaction.createRewardFee(validator, gasFee));
          }

        } catch (error) {
          console.log(`⚠ Transaction ${tx.id.substring(0, 8)} failed: ${error.message}`);
        }
      }

      // ─── Phase 9.1: clear mempool AND pending nonces together ─────────────
      // pendingNonces must reset here — confirmed nonces (from applyBlock below)
      // are now the source of truth for the next round of txs.
      this.mempool = [];
      this.pendingNonces.clear();
      // ──────────────────────────────────────────────────────────────────────

      transactions.push(Transaction.createReward(validator, this.config.blockReward));

      for (const slash of this.pos.checkSlashing(this.config)) {
        transactions.push(Transaction.createSlash(slash.validator, slash.amount, slash.reason));
      }

      const block = new Block(
        this.chain.length,
        Date.now(),
        transactions,
        lastBlock.hash,
        validator,
        0
      );
      block.chainId  = this.chainId;
      block.gasUsed  = blockGasUsed;

      this.applyBlock(block);
      block.stateRoot = this.state.computeStateRoot();
      block.hash      = block.calculateHash();

      this.chain.push(block);
      this.state.resetMissedBlocks(validator);
      await this.saveChain();

      if (block.index % this.snapshotInterval === 0 && block.index > 0) {
        await this.saveSnapshot(block.index);
      }

      console.log(`✅ Block #${block.index} | Validator: ${validator.substring(0, 8)}... | Txs: ${block.transactions.length} | Gas: ${blockGasUsed} | Root: ${block.stateRoot.substring(0, 8)}...`);

      this.isProducing = false;
      return block;

    } catch (error) {
      console.error('Error creating block:', error);
      this.isProducing = false;
      return null;
    }
  }

  // ─── applyTransaction ───────────────────────────────────────────────────────

  applyBlock(block) {
    for (const tx of block.transactions) {
      this.applyTransaction(tx, block.index);
    }
  }

  applyTransaction(tx, blockIndex) {
    try {
      const userTxTypes = new Set([
        TX_TYPES.TRANSFER, TX_TYPES.STAKE, TX_TYPES.UNSTAKE,
        TX_TYPES.CONTRACT_DEPLOY, TX_TYPES.CONTRACT_CALL, TX_TYPES.CONTRACT_UPGRADE,
        TX_TYPES.REPORT_CREATE, TX_TYPES.REPORT_VERIFY, TX_TYPES.REPORT_RESOLVE
      ]);

      if (userTxTypes.has(tx.type)) {
        this.state.incrementNonce(tx.data.from);
      }

      const gasCost = (tx.gasUsed || 0) * (tx.gasPrice || 0);

      switch (tx.type) {
        case TX_TYPES.GENESIS:
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case TX_TYPES.TRANSFER:
          this.state.subtractBalance(tx.data.from, tx.data.amount + gasCost);
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case TX_TYPES.STAKE:
          this.state.subtractBalance(tx.data.from, tx.data.amount + gasCost);
          this.state.addStake(tx.data.from, tx.data.amount);
          this.state.resetMissedBlocks(tx.data.from);
          break;

        case TX_TYPES.UNSTAKE:
          this.state.subtractBalance(tx.data.from, gasCost);
          this.state.setStake(tx.data.from, 0);
          this.state.initiateUnstake(tx.data.from, blockIndex + this.config.unstakeDelay);
          break;

        case TX_TYPES.REWARD:
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case TX_TYPES.REWARD_FEE:
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case TX_TYPES.CONTRACT_DEPLOY:
          this.state.subtractBalance(tx.data.from, gasCost);
          break;

        case TX_TYPES.CONTRACT_CALL:
          this.state.subtractBalance(tx.data.from, gasCost);
          break;

        case TX_TYPES.CONTRACT_UPGRADE:
          this.state.subtractBalance(tx.data.from, gasCost);
          break;

        // ✅ Phase 9: native report tx types
        case TX_TYPES.REPORT_CREATE:
          if (gasCost > 0) this.state.subtractBalance(tx.data.from, gasCost);
          break;

        case TX_TYPES.REPORT_VERIFY:
          if (gasCost > 0) this.state.subtractBalance(tx.data.verifier || tx.data.from, gasCost);
          break;

        case TX_TYPES.REPORT_RESOLVE:
          if (gasCost > 0) this.state.subtractBalance(tx.data.authority || tx.data.from, gasCost);
          break;

        // ✅ Phase 9: reputation update (no gas, no signature)
        case TX_TYPES.REPUTATION_UPDATE:
          if (tx.data.address && tx.data.delta !== undefined) {
            if (tx.data.delta > 0) {
              this.state.increaseReputation(tx.data.address, tx.data.delta);
            } else {
              this.state.decreaseReputation(tx.data.address, Math.abs(tx.data.delta));
            }
          }
          break;

        case TX_TYPES.SLASH:
          this.state.subtractStake(tx.data.validator, tx.data.amount);
          this.state.resetMissedBlocks(tx.data.validator);
          break;
      }
    } catch (error) {
      console.error(`Error applying transaction ${tx.id}: ${error.message}`);
    }
  }

  // ─── Mempool ────────────────────────────────────────────────────────────────

  addTransaction(tx, publicKey) {
    if (this.mempool.length >= this.mempoolLimit) {
      throw new Error('Mempool full. Try again later.');
    }

    this.cleanupRateLimit();
    const addressCount = this.addressTxCount.get(tx.data.from) || 0;
    if (addressCount >= 10) {
      throw new Error('Rate limit exceeded. Please wait.');
    }

    if (tx.data.from) {
      this.state.setPublicKey(tx.data.from, publicKey);
    }

    if (!tx.isValid(this.state.publicKeys)) {
      throw new Error('Invalid transaction signature');
    }

    // ─── Phase 9.1: pending nonce tracking ──────────────────────────────────
    // confirmedNonce = what is committed on-chain (state after last block).
    // pendingNonce   = confirmedNonce + number of txs already queued in mempool
    //                  from this address this round.
    // expectedNonce  = the next slot to fill (whichever is higher wins, so a
    //                  fresh address with nothing pending still gets 0).
    //
    // Why: the second and third tx in a batch arrive BEFORE the block is mined,
    // so state.getNonce() still returns 0 for all three. Without pendingNonces
    // the node rejects nonce=1 and nonce=2 with "Expected: 0".
    const confirmedNonce = this.state.getNonce(tx.data.from);
    const pendingNonce   = this.pendingNonces.get(tx.data.from) ?? confirmedNonce;
    const expectedNonce  = Math.max(confirmedNonce, pendingNonce);

    if (tx.nonce !== expectedNonce) {
      throw new Error(`Invalid nonce. Expected: ${expectedNonce}, Got: ${tx.nonce}`);
    }

    // Advance the pending cursor so the next tx from this address uses nonce+1
    this.pendingNonces.set(tx.data.from, expectedNonce + 1);
    // ────────────────────────────────────────────────────────────────────────

    this.gas.validateGasParams(tx);

    const minGas = this.gas.calculateTransactionGas(tx);
    if (tx.gasLimit < minGas) {
      throw new Error(`Gas limit too low. Minimum: ${minGas}`);
    }

    const maxGasCost = tx.gasLimit * tx.gasPrice;

    switch (tx.type) {
      case TX_TYPES.TRANSFER:
        if (this.state.getBalance(tx.data.from) < (tx.data.amount + maxGasCost)) {
          throw new Error('Insufficient balance for transfer + gas');
        }
        break;

      case TX_TYPES.STAKE:
        if (this.state.getBalance(tx.data.from) < (tx.data.amount + maxGasCost)) {
          throw new Error('Insufficient balance for staking + gas');
        }
        if (tx.data.amount < this.config.minStake) {
          throw new Error(`Minimum stake is ${this.config.minStake} SAYM`);
        }
        break;

      case TX_TYPES.UNSTAKE:
        if (this.state.getBalance(tx.data.from) < maxGasCost) {
          throw new Error('Insufficient balance for gas');
        }
        if (this.state.getStake(tx.data.from) === 0) {
          throw new Error('No stake to unstake');
        }
        if (this.state.isUnstaking(tx.data.from)) {
          throw new Error('Already unstaking');
        }
        break;

      case TX_TYPES.CONTRACT_DEPLOY:
      case TX_TYPES.CONTRACT_CALL:
      case TX_TYPES.CONTRACT_UPGRADE:
      case TX_TYPES.REPORT_CREATE:
      case TX_TYPES.REPORT_VERIFY:
      case TX_TYPES.REPORT_RESOLVE:
        if (this.state.getBalance(tx.data.from) < maxGasCost) {
          throw new Error('Insufficient balance for gas');
        }
        break;
    }

    this.mempool.push(tx);
    this.addressTxCount.set(tx.data.from, addressCount + 1);
  }

  cleanupRateLimit() {
    const now = Date.now();
    if (now - this.lastCleanup > 60000) {
      this.addressTxCount.clear();
      this.lastCleanup = now;
    }
  }

  // ─── Phase 9: Query APIs ─────────────────────────────────────────────────────

  /**
   * Get all emitted contract events, optionally filtered.
   */
  getEvents({ contractAddress, eventName, limit } = {}) {
    return this.state.getEvents({ contractAddress, eventName, limit });
  }

  getContractEvents(contractAddress) {
    return this.state.getContractEvents(contractAddress);
  }

  /**
   * Get reputation score for an address.
   */
  getReputation(address) {
    return this.state.getReputation(address);
  }

  /**
   * Get all deployed contracts with their metadata (contract registry).
   */
  getContractRegistry() {
    return this.contracts.getAllContracts().map(c => ({
      address:   c.address,
      name:      c.name    || 'Unknown',
      version:   c.version || '1.0.0',
      abi:       c.abi     || [],
      codeHash:  c.codeHash,
      creator:   c.creator,
      createdAt: c.createdAt
    }));
  }

  /**
   * Get all civic reports from native tx index.
   */
  getReports({ category, status, limit } = {}) {
    let results = Array.from(this.reportIndex.values());
    if (category) results = results.filter(r => r.category === category);
    if (status)   results = results.filter(r => r.status === status);
    if (limit)    results = results.slice(-limit);
    return results;
  }

  getReport(reportId) {
    return this.reportIndex.get(reportId) || null;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  saveBlock(_block) {
    this.saveChain();
  }

  async saveChain() {
    const chainData = this.chain.map(block => block.toJSON());
    await this.db.put('chain', chainData);
  }

  async replayState() {
    this.state.clear();
    for (const block of this.chain) {
      this.applyBlock(block);
      this._verifyStateRoot(block);
    }
  }

  async saveSnapshot(blockHeight) {
    try {
      const snapshot = {
        blockHeight,
        timestamp: Date.now(),
        state:     this.state.exportState(),
        stateRoot: this.state.computeStateRoot()
      };

      const snapshotPath = path.join(this.snapshotDir, `snapshot-${blockHeight}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
      console.log(`📸 Snapshot saved at block ${blockHeight}`);
      this.cleanOldSnapshots();
    } catch (error) {
      console.error('Error saving snapshot:', error);
    }
  }

  async loadLatestSnapshot() {
    try {
      const files = fs.readdirSync(this.snapshotDir);
      const snapshots = files
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .map(f => ({ file: f, height: parseInt(f.match(/snapshot-(\d+)\.json/)[1]) }))
        .sort((a, b) => b.height - a.height);

      if (!snapshots.length) return null;

      const snapshotPath = path.join(this.snapshotDir, snapshots[0].file);
      return JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    } catch {
      return null;
    }
  }

  cleanOldSnapshots() {
    try {
      const files = fs.readdirSync(this.snapshotDir);
      const snapshots = files
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .map(f => ({ file: f, height: parseInt(f.match(/snapshot-(\d+)\.json/)[1]) }))
        .sort((a, b) => b.height - a.height);

      snapshots.slice(3).forEach(s => {
        fs.unlinkSync(path.join(this.snapshotDir, s.file));
        console.log(`🗑️  Deleted old snapshot: ${s.file}`);
      });
    } catch (error) {
      console.error('Error cleaning snapshots:', error);
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  getStats() {
    const validatorCount = this.pos?.validators?.size || 0;
    const contractCount  = this.contracts?.contracts instanceof Map ? this.contracts.contracts.size : 0;
    const totalStake     = this.pos?.validators
      ? Array.from(this.pos.validators.values()).reduce((sum, v) => sum + v.stake, 0)
      : 0;

    return {
      network:    this.networkName,
      chainId:    this.chainId,
      blocks:     this.chain.length,
      mempool:    this.mempool.length,
      validators: validatorCount,
      totalStake,
      contracts:  contractCount,
      reports:    this.reportIndex.size,        // ✅ Phase 9
      stateRoot:  this.state.computeStateRoot()
    };
  }

  async close() {
    await this.db.close();
  }
}

export default Blockchain;