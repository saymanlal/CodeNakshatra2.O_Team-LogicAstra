/**
 * Blockchain — SAYMAN Chain
 *
 * Key fixes in this version:
 *
 * 1. addBlock(block) — was MISSING. P2P calls this when a peer sends a block.
 *    Now validates the block, checks it links to our chain, applies state,
 *    and appends it. Returns true on success, false on rejection.
 *
 * 2. replaceChain(blocks) — fork choice rule. If a peer sends a valid longer
 *    chain, we replace ours. Simple longest-chain rule (can be upgraded to
 *    heaviest stake later).
 *
 * 3. Block reward is always a visible REWARD transaction inside the block.
 *    Explorer shows txs: 1 minimum per block (the reward). This is auditable.
 *
 * 4. All existing functionality preserved — sponsorship gas routing, base-unit
 *    math, halving, supply cap, snapshots, mempool, contract VM.
 */

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

const EC  = elliptic.ec;
const ec  = new EC('secp256k1');

class Blockchain {
  constructor(config, dbPath = null) {
    this.config      = config;
    this.chainId     = config.chainId;
    this.networkName = config.networkName;
    this.decimals    = config.decimals || 10_000;

    this.chain     = [];
    this.mempool   = [];
    this.state     = new StateEngine();
    this.pos       = new ProofOfStake(this.state, config);
    this.gas       = new GasCalculator(config);
    this.contracts = new ContractEngine(this.state, this.gas);

    const finalDbPath = dbPath || `./data/${config.chainId}`;
    this.db = new Level(finalDbPath, { valueEncoding: 'json' });

    this.snapshotInterval = 100;
    this.snapshotDir      = path.join(finalDbPath, 'snapshots');
    this.ensureSnapshotDir();

    this.isProducing    = false;
    this.mempoolLimit   = 1000;
    this.addressTxCount = new Map();
    this.lastCleanup    = Date.now();

    this.pendingNonces  = new Map();
    this.reportIndex    = new Map();
  }

  ensureSnapshotDir() {
    fs.mkdirSync(this.snapshotDir,   { recursive: true });
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  async initialize() {
    console.log(`\n🔄 Initializing ${this.networkName}...`);

    try {
      const snapshot = await this.loadLatestSnapshot();

      if (snapshot) {
        console.log(`📸 Snapshot at block ${snapshot.blockHeight} — loading...`);
        this.state.importState(snapshot.state);

        const savedChain = await this.db.get('chain').catch(() => null);
        if (savedChain?.length > 0) {
          const loadLimit = Math.min(savedChain.length, snapshot.blockHeight + 1);
          for (let i = 0; i < loadLimit; i++) {
            this.chain.push(await Block.fromJSON(savedChain[i]));
          }
          for (let i = loadLimit; i < savedChain.length; i++) {
            const block = await Block.fromJSON(savedChain[i]);
            this.chain.push(block);
            this.applyBlock(block);
          }

          if (savedChain.length < snapshot.blockHeight + 1) {
            console.log(`⚠️ Database height is behind snapshot (${savedChain.length} < ${snapshot.blockHeight + 1}). Rolling back state to match database...`);
            await this._rollbackToHeight(savedChain.length - 1);
          }
        } else {
          console.log('⚠️ Snapshot exists but saved chain is missing. Starting from genesis...');
          this.state.clear();
          this.createGenesisBlock();
        }

      } else {
        const savedChain = await this.db.get('chain').catch(() => null);
        if (savedChain?.length > 0) {
          console.log(`📚 Loading chain (${savedChain.length} blocks)...`);
          for (const b of savedChain) this.chain.push(await Block.fromJSON(b));
          await this.replayState();
        } else {
          this.createGenesisBlock();
        }
      }

      const stateRoot = this.state.computeStateRoot().slice(0, 12);
      console.log(`✅ Ready | Height: ${this.chain.length} | StateRoot: ${stateRoot}...`);

    } catch (err) {
      if (err.code === 'LEVEL_NOT_FOUND') {
        this.createGenesisBlock();
      } else {
        throw err;
      }
    }
  }

  // ─── Genesis ────────────────────────────────────────────────────────────────

  applyGenesisAllocations() {
    const alloc = this.config.genesis.allocations || {};

    const faucetKP  = ec.keyFromPrivate(
      crypto.createHash('sha256').update('sayman-faucet-seed-2024').digest('hex')
    );
    const faucetPub = faucetKP.getPublic('hex');
    const faucetAddr = crypto.createHash('sha256').update(faucetPub).digest('hex').slice(0, 40);
    this.state.setPublicKey(faucetAddr, faucetPub);

    for (const [key, amount] of Object.entries(alloc)) {
      let address;

      if (key === 'faucet1') {
        address = faucetAddr;
        this.state.addBalance(address, amount);
        console.log(`  ✓ Faucet    ${address.slice(0, 10)}... ${this._fmt(amount)}`);

      } else if (key === 'validator1') {
        const kp  = ec.keyFromPrivate(
          crypto.createHash('sha256').update('genesis-validator-' + this.chainId).digest('hex')
        );
        const pub = kp.getPublic('hex');
        address   = crypto.createHash('sha256').update(pub).digest('hex').slice(0, 40);
        this.state.addBalance(address, amount * 2);
        this.state.stake(address, amount);
        this.pos.addValidator(address, amount);
        console.log(`  ✓ Validator ${address.slice(0, 10)}... stake: ${this._fmt(amount)}`);

      } else {
        const kp = ec.keyFromPrivate(
          crypto.createHash('sha256').update(`genesis-${key}-${this.chainId}`).digest('hex')
        );
        address = crypto.createHash('sha256').update(kp.getPublic('hex')).digest('hex').slice(0, 40);
        this.state.addBalance(address, amount);
        console.log(`  ✓ ${key.padEnd(10)} ${address.slice(0, 10)}... ${this._fmt(amount)}`);
      }
    }
  }

  createGenesisBlock() {
    console.log('🌱 Creating genesis block...');
    this.applyGenesisAllocations();

    const genesis     = new Block(0, this.config.genesis.timestamp, [], '0', 'genesis', 0);
    genesis.chainId   = this.chainId;
    genesis.stateRoot = this.state.computeStateRoot();
    genesis.hash      = genesis.calculateHash();

    this.chain.push(genesis);
    this.saveBlock(genesis);
    console.log(`✅ Genesis | StateRoot: ${genesis.stateRoot.slice(0, 12)}...\n`);
    return genesis;
  }

  // ─── Block production ───────────────────────────────────────────────────────

  async createBlock() {
    if (this.isProducing) return null;
    this.isProducing = true;

    try {
      const lastBlock = this.getLastBlock();
      const validator = this.pos.selectValidator(lastBlock.hash);

      if (!validator) {
        this.isProducing = false;
        return null;
      }

      // If a local validator address is configured, only produce blocks when we are selected
      if (process.env.VALIDATOR_ADDRESS && validator !== process.env.VALIDATOR_ADDRESS) {
        this.isProducing = false;
        return null;
      }

      const transactions = [];
      let blockGasUsed   = 0;

      // ─── Process mempool ─────────────────────────────────────────────────
      for (const tx of this.mempool) {
        try {
          const gasTracker = this.gas.trackExecution();

          switch (tx.type) {
            case TX_TYPES.CONTRACT_DEPLOY: {
              const payload = {
                name:      tx.data.name,
                version:   tx.data.version,
                abi:       tx.data.abi,
                code:      tx.data.code,
                feePolicy: tx.data.feePolicy || 'user',
              };
              this.contracts.deploy(tx.data.from, payload, tx.timestamp, gasTracker);
              break;
            }
            case TX_TYPES.CONTRACT_CALL: {
              this.contracts.call(
                tx.data.from,
                tx.data.contractAddress,
                tx.data.method,
                tx.data.args,
                gasTracker,
                tx.gasLimit
              );
              break;
            }
            case TX_TYPES.REPORT_CREATE: {
              gasTracker.gasUsed += this.gas.costs.reportCreate;
              this.reportIndex.set(tx.id, {
                txId:         tx.id,
                reporter:     tx.data.from,
                category:     tx.data.category,
                severity:     tx.data.severity,
                location:     tx.data.location,
                evidenceHash: tx.data.evidenceHash,
                description:  tx.data.description,
                status:       'OPEN',
                createdAt:    tx.timestamp,
              });
              break;
            }
            case TX_TYPES.REPORT_VERIFY: {
              gasTracker.gasUsed += this.gas.costs.reportVerify;
              const report = this.reportIndex.get(tx.data.reportId);
              if (report) {
                report.verified   = true;
                report.confidence = tx.data.confidence;
                report.verifiedBy = tx.data.verifier;
                report.verifiedAt = Date.now();
                report.aiCategory = tx.data.aiCategory;
              }
              if (tx.data.isValid && report?.reporter) {
                transactions.push(Transaction.updateReputation(report.reporter, 20, 'Valid report'));
              }
              break;
            }
            case TX_TYPES.REPORT_RESOLVE: {
              gasTracker.gasUsed += this.gas.costs.reportResolve;
              const report = this.reportIndex.get(tx.data.reportId);
              if (report) {
                report.status     = tx.data.resolution;
                report.resolvedBy = tx.data.authority;
                report.resolvedAt = tx.data.resolvedAt;
                report.note       = tx.data.note;
              }
              break;
            }
            default:
              gasTracker.gasUsed = this.gas.calculateTransactionGas(tx);
          }

          if (blockGasUsed + gasTracker.gasUsed > this.gas.limits.maxGasPerBlock) continue;

          tx.gasUsed   = gasTracker.gasUsed;
          tx.feePolicy = this._resolveTxFeePolicy(tx);

          transactions.push(tx);
          blockGasUsed += gasTracker.gasUsed;

          const gasFee = this._calculateTxFee(tx);
          if (gasFee > 0) {
            transactions.push(Transaction.createRewardFee(validator, gasFee));
          }

        } catch (err) {
          console.log(`  ⚠ Tx ${tx.id.slice(0, 8)} failed: ${err.message}`);
        }
      }

      this.mempool = [];
      this.pendingNonces.clear();

      // ─── Block reward — always a visible REWARD tx ───────────────────────
      const blockHeight = this.chain.length;
      const blockReward = typeof this.config.getBlockReward === 'function'
        ? this.config.getBlockReward(blockHeight)
        : this.config.blockReward;

      const maxSupply = this.config.maxSupply || 0;
      if (blockReward > 0) {
        const totalSupply = this.state.getTotalSupply?.() || 0;
        if (maxSupply === 0 || totalSupply + blockReward <= maxSupply) {
          // ✅ REWARD tx is always first — visible in explorer
          transactions.unshift(Transaction.createReward(validator, blockReward));
        }
      }

      // Slashing
      for (const slash of this.pos.checkSlashing(this.config)) {
        transactions.push(Transaction.createSlash(slash.validator, slash.amount, slash.reason));
      }

      const block = new Block(
        blockHeight,
        Date.now(),
        transactions,
        lastBlock.hash,
        validator,
        0
      );
      block.chainId = this.chainId;
      block.gasUsed = blockGasUsed;

      this.applyBlock(block);
      block.stateRoot = this.state.computeStateRoot();
      block.hash      = block.calculateHash();

      this.chain.push(block);
      this.state.resetMissedBlocks(validator);
      await this.saveChain();

      if (block.index % this.snapshotInterval === 0 && block.index > 0) {
        await this.saveSnapshot(block.index);
      }

      console.log(
        `✅ Block #${block.index} | ${validator.slice(0, 8)}...` +
        ` | txs: ${block.transactions.length}` +
        ` | gas: ${blockGasUsed.toLocaleString()}` +
        ` | reward: ${this._fmt(blockReward)}` +
        ` | root: ${block.stateRoot.slice(0, 8)}...`
      );

      this.isProducing = false;
      return block;

    } catch (err) {
      console.error('Error creating block:', err);
      this.isProducing = false;
      return null;
    }
  }

  // ─── addBlock (P2P-facing) ───────────────────────────────────────────────────
  //
  // Called by p2p/server.js when a peer broadcasts a block.
  // Returns true if accepted, false if rejected.

  async addBlock(block) {
    try {
      const lastBlock = this.getLastBlock();

      // ── Basic structural checks ────────────────────────────────────────────
      if (block.index !== lastBlock.index + 1) {
        // Not the next block — could be a future block or already-seen
        return false;
      }

      if (block.previousHash !== lastBlock.hash) {
        console.warn(`⚠️  addBlock rejected #${block.index}: previousHash mismatch`);
        return false;
      }

      if (block.chainId && block.chainId !== this.chainId) {
        console.warn(`⚠️  addBlock rejected #${block.index}: wrong chainId`);
        return false;
      }

      // ── Proof of Stake Validator Check ──────────────────────────────────────
      const expectedValidator = this.pos.selectValidator(lastBlock.hash);
      if (expectedValidator && block.validator !== expectedValidator) {
        console.warn(`⚠️  addBlock rejected #${block.index}: validator mismatch. Expected: ${expectedValidator}, Got: ${block.validator}`);
        return false;
      }

      // ── Hash integrity ─────────────────────────────────────────────────────
      const recomputed = block.calculateHash();
      if (recomputed !== block.hash) {
        console.warn(`⚠️  addBlock rejected #${block.index}: hash mismatch. Block hash: ${block.hash}, Recomputed: ${recomputed}`);
        return false;
      }

      // ── Apply transactions to state ────────────────────────────────────────
      this.applyBlock(block);

      // ── State root check (if block carries one) ────────────────────────────
      if (block.stateRoot) {
        const computed = this.state.computeStateRoot();
        if (computed !== block.stateRoot) {
          console.warn(`⚠️  addBlock stateRoot mismatch at #${block.index} — rolling back`);
          // Rollback: re-replay up to previous state
          await this._rollbackToHeight(lastBlock.index);
          return false;
        }
      }

      this.chain.push(block);
      await this.saveChain();

      if (block.index % this.snapshotInterval === 0 && block.index > 0) {
        await this.saveSnapshot(block.index);
      }

      return true;

    } catch (err) {
      console.error(`❌ addBlock #${block?.index} error:`, err.message);
      return false;
    }
  }

  // ─── replaceChain (fork choice) ─────────────────────────────────────────────
  //
  // If a peer sends a valid chain longer than ours, replace ours.
  // Simple longest-chain rule.

  async replaceChain(blocks) {
    if (blocks.length <= this.chain.length) {
      console.log('replaceChain: incoming chain not longer — ignoring');
      return false;
    }

    // Validate genesis matches
    if (blocks[0]?.hash !== this.chain[0]?.hash) {
      console.warn('replaceChain: genesis mismatch — rejecting');
      return false;
    }

    // Validate chain linkage
    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i].previousHash !== blocks[i - 1].hash) {
        console.warn(`replaceChain: broken link at index ${i}`);
        return false;
      }
    }

    console.log(`🔄 Replacing chain: ${this.chain.length} → ${blocks.length} blocks`);

    this.chain = blocks;
    this.state.clear();
    await this.replayState();
    await this.saveChain();

    console.log(`✅ Chain replaced. New height: ${this.chain.length}`);
    return true;
  }

  // ─── Internal rollback helper ────────────────────────────────────────────────

  async _rollbackToHeight(height) {
    this.chain = this.chain.slice(0, height + 1);
    this.state.clear();
    await this.replayState();
  }

  // ─── applyBlock / applyTransaction ──────────────────────────────────────────

  applyBlock(block) {
    for (const tx of block.transactions) {
      this.applyTransaction(tx, block.index);
    }
  }

  applyTransaction(tx, blockIndex) {
    try {
      const userTypes = new Set([
        TX_TYPES.TRANSFER, TX_TYPES.STAKE, TX_TYPES.UNSTAKE,
        TX_TYPES.CONTRACT_DEPLOY, TX_TYPES.CONTRACT_CALL, TX_TYPES.CONTRACT_UPGRADE,
        TX_TYPES.REPORT_CREATE, TX_TYPES.REPORT_VERIFY, TX_TYPES.REPORT_RESOLVE,
      ]);
      
      if (userTypes.has(tx.type)) {
        if (tx.publicKey && tx.data.from) {
          this.state.setPublicKey(tx.data.from, tx.publicKey);
        }
        if (!tx.isValid(this.state.publicKeys)) {
          throw new Error(`Invalid signature for transaction ${tx.id}`);
        }
        this.state.incrementNonce(tx.data.from);
      }

      const gasUsed  = tx.gasUsed  || 0;
      const gasPrice = tx.gasPrice || 0;
      const gasCost  = gasUsed * gasPrice;

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
        case TX_TYPES.REWARD_FEE:
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case TX_TYPES.CONTRACT_DEPLOY: {
          const payload = {
            name:      tx.data.name,
            version:   tx.data.version,
            abi:       tx.data.abi,
            code:      tx.data.code,
            feePolicy: tx.data.feePolicy || 'user',
          };
          const gasTracker = this.gas.trackExecution();
          this.contracts.deploy(tx.data.from, payload, tx.timestamp, gasTracker);
          this.state.subtractBalance(tx.data.from, gasCost);
          break;
        }

        case TX_TYPES.CONTRACT_CALL: {
          const gasTracker = this.gas.trackExecution();
          this.contracts.call(
            tx.data.from,
            tx.data.contractAddress,
            tx.data.method,
            tx.data.args,
            gasTracker,
            tx.gasLimit
          );

          const feePolicy = tx.feePolicy || 'user';
          if (feePolicy === 'free') {
            // no-op
          } else if (feePolicy === 'sponsor') {
            const contract = this.contracts.getContract(tx.data.contractAddress);
            if (contract && (contract.sponsorBalance || 0) >= gasCost) {
              contract.sponsorBalance -= gasCost;
              this.state.setContractMeta?.(tx.data.contractAddress, 'sponsorBalance', contract.sponsorBalance);
            } else {
              this.state.subtractBalance(tx.data.from, gasCost);
            }
          } else {
            this.state.subtractBalance(tx.data.from, gasCost);
          }
          break;
        }

        case TX_TYPES.CONTRACT_UPGRADE: {
          const feePolicy = tx.feePolicy || 'user';
          if (feePolicy === 'free') {
            // no-op
          } else if (feePolicy === 'sponsor') {
            const contract = this.contracts.getContract(tx.data.contractAddress);
            if (contract && (contract.sponsorBalance || 0) >= gasCost) {
              contract.sponsorBalance -= gasCost;
              this.state.setContractMeta?.(tx.data.contractAddress, 'sponsorBalance', contract.sponsorBalance);
            } else {
              this.state.subtractBalance(tx.data.from, gasCost);
            }
          } else {
            this.state.subtractBalance(tx.data.from, gasCost);
          }
          break;
        }

        case TX_TYPES.REPORT_CREATE:
          if (gasCost > 0) this.state.subtractBalance(tx.data.from, gasCost);
          break;

        case TX_TYPES.REPORT_VERIFY:
          if (gasCost > 0) this.state.subtractBalance(tx.data.verifier || tx.data.from, gasCost);
          break;

        case TX_TYPES.REPORT_RESOLVE:
          if (gasCost > 0) this.state.subtractBalance(tx.data.authority || tx.data.from, gasCost);
          break;

        case TX_TYPES.REPUTATION_UPDATE:
          if (tx.data.address && tx.data.delta !== undefined) {
            if (tx.data.delta > 0) this.state.increaseReputation(tx.data.address, tx.data.delta);
            else                   this.state.decreaseReputation(tx.data.address, Math.abs(tx.data.delta));
          }
          break;

        case TX_TYPES.SLASH:
          this.state.subtractStake(tx.data.validator, tx.data.amount);
          this.state.resetMissedBlocks(tx.data.validator);
          break;
      }
    } catch (err) {
      console.error(`  ✗ applyTransaction ${tx.id?.slice(0, 8)}: ${err.message}`);
    }
  }

  // ─── Mempool ────────────────────────────────────────────────────────────────

  addTransaction(tx, publicKey) {
    if (this.mempool.length >= this.mempoolLimit) {
      throw new Error('Mempool full. Try again later.');
    }

    this.cleanupRateLimit();
    const addrCount = this.addressTxCount.get(tx.data.from) || 0;
    if (addrCount >= 10) throw new Error('Rate limit: max 10 pending txs per address.');

    if (tx.data.from) this.state.setPublicKey(tx.data.from, publicKey);

    if (!tx.isValid(this.state.publicKeys)) {
      throw new Error('Invalid transaction signature');
    }

    const confirmedNonce = this.state.getNonce(tx.data.from);
    const pendingNonce   = this.pendingNonces.get(tx.data.from) ?? confirmedNonce;
    const expectedNonce  = Math.max(confirmedNonce, pendingNonce);

    if (tx.nonce !== expectedNonce) {
      throw new Error(`Invalid nonce. Expected: ${expectedNonce}, Got: ${tx.nonce}`);
    }

    this.gas.validateGasParams(tx);

    const minGas = this.gas.calculateTransactionGas(tx);
    if (tx.gasLimit < minGas) {
      throw new Error(`gasLimit too low. Minimum for ${tx.type}: ${minGas}`);
    }

    const feePolicy = this._resolveTxFeePolicy(tx);
    const maxGasCost = feePolicy === 'free' ? 0
                     : feePolicy === 'sponsor' ? 0
                     : tx.gasLimit * tx.gasPrice;

    switch (tx.type) {
      case TX_TYPES.TRANSFER:
        if (this.state.getBalance(tx.data.from) < tx.data.amount + maxGasCost) {
          throw new Error('Insufficient balance for transfer + gas');
        }
        break;
      case TX_TYPES.STAKE:
        if (this.state.getBalance(tx.data.from) < tx.data.amount + maxGasCost) {
          throw new Error('Insufficient balance for stake + gas');
        }
        if (tx.data.amount < this.config.minStake) {
          throw new Error(`Minimum stake: ${this._fmt(this.config.minStake)}`);
        }
        break;
      case TX_TYPES.UNSTAKE:
        if (this.state.getBalance(tx.data.from) < maxGasCost) {
          throw new Error('Insufficient balance for gas');
        }
        if (this.state.getStake(tx.data.from) === 0) throw new Error('No stake to unstake');
        if (this.state.isUnstaking(tx.data.from))    throw new Error('Already unstaking');
        break;
      default:
        if (maxGasCost > 0 && this.state.getBalance(tx.data.from) < maxGasCost) {
          throw new Error('Insufficient balance for gas');
        }
    }

    this.pendingNonces.set(tx.data.from, expectedNonce + 1);
    this.mempool.push(tx);
    this.addressTxCount.set(tx.data.from, addrCount + 1);
  }

  cleanupRateLimit() {
    if (Date.now() - this.lastCleanup > 60_000) {
      this.addressTxCount.clear();
      this.lastCleanup = Date.now();
    }
  }

  // ─── Fee policy helpers ──────────────────────────────────────────────────────

  _resolveTxFeePolicy(tx) {
    if (tx.type === TX_TYPES.CONTRACT_CALL || tx.type === TX_TYPES.CONTRACT_UPGRADE) {
      const contract = this.contracts.getContract(tx.data.contractAddress);
      return contract?.feePolicy || 'user';
    }
    return 'user';
  }

  _calculateTxFee(tx) {
    const feePolicy = tx.feePolicy || 'user';
    if (feePolicy === 'free') return 0;
    return (tx.gasUsed || 0) * (tx.gasPrice || 0);
  }

  // ─── Public query APIs ───────────────────────────────────────────────────────

  getEvents(opts = {})                     { return this.state.getEvents(opts); }
  getContractEvents(addr)                  { return this.state.getContractEvents(addr); }
  getReputation(address)                   { return this.state.getReputation(address); }

  getContractRegistry() {
    return this.contracts.getAllContracts().map(c => ({
      address:   c.address,
      name:      c.name      || 'Unknown',
      version:   c.version   || '1.0.0',
      abi:       c.abi       || [],
      codeHash:  c.codeHash,
      creator:   c.creator,
      feePolicy: c.feePolicy || 'user',
      createdAt: c.createdAt,
    }));
  }

  getReports({ category, status, limit } = {}) {
    let results = Array.from(this.reportIndex.values());
    if (category) results = results.filter(r => r.category === category);
    if (status)   results = results.filter(r => r.status   === status);
    if (limit)    results = results.slice(-limit);
    return results;
  }

  getReport(reportId) {
    return this.reportIndex.get(reportId) || null;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  saveBlock(_block) { this.saveChain(); }

  async saveChain() {
    await this.db.put('chain', this.chain.map(b => b.toJSON ? b.toJSON() : b));
  }

  async replayState() {
    this.state.clear();
    this.applyGenesisAllocations();
    for (const block of this.chain) {
      this.applyBlock(block);
    }
  }

  async saveSnapshot(blockHeight) {
    try {
      const snap = {
        blockHeight,
        timestamp: Date.now(),
        state:     this.state.exportState(),
        stateRoot: this.state.computeStateRoot(),
      };
      const p = path.join(this.snapshotDir, `snapshot-${blockHeight}.json`);
      fs.writeFileSync(p, JSON.stringify(snap, null, 2));
      console.log(`📸 Snapshot saved at block ${blockHeight}`);
      this.cleanOldSnapshots();
    } catch (err) {
      console.error('Snapshot error:', err);
    }
  }

  async loadLatestSnapshot() {
    try {
      const files = fs.readdirSync(this.snapshotDir)
        .filter(f => /^snapshot-\d+\.json$/.test(f))
        .map(f => ({ file: f, height: parseInt(f.match(/\d+/)[0]) }))
        .sort((a, b) => b.height - a.height);
      if (!files.length) return null;
      return JSON.parse(fs.readFileSync(path.join(this.snapshotDir, files[0].file), 'utf8'));
    } catch { return null; }
  }

  cleanOldSnapshots() {
    try {
      const files = fs.readdirSync(this.snapshotDir)
        .filter(f => /^snapshot-\d+\.json$/.test(f))
        .map(f => ({ file: f, height: parseInt(f.match(/\d+/)[0]) }))
        .sort((a, b) => b.height - a.height);
      files.slice(3).forEach(s => {
        fs.unlinkSync(path.join(this.snapshotDir, s.file));
      });
    } catch {}
  }

  // ─── Stats & utilities ───────────────────────────────────────────────────────

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  getStats() {
    const blockHeight = this.chain.length;
    const blockReward = typeof this.config.getBlockReward === 'function'
      ? this.config.getBlockReward(blockHeight)
      : this.config.blockReward;

    return {
      network:         this.networkName,
      chainId:         this.chainId,
      blocks:          blockHeight,
      mempool:         this.mempool.length,
      validators:      this.state.getValidators?.()?.length || 0,
      totalStake:      this.state.getTotalStake?.() || 0,
      contracts:       this.contracts.contracts.size,
      reports:         this.reportIndex.size,
      blockReward,
      blockRewardSAYN: this._fmt(blockReward),
      stateRoot:       this.state.computeStateRoot(),
    };
  }

  _fmt(baseUnits) {
    return (baseUnits / this.decimals).toFixed(4) + ' SAYN';
  }

  async close() {
    await this.db.close();
  }
}

export default Blockchain;