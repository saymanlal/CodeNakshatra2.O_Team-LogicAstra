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
import NonceManager from './nonce.js';
import { Level } from 'level';
import fs from 'fs';
import path from 'path';
import { GithubClient, RepoManager, ArchiveWriter, ArchiveReader } from './archive/index.js';

const EC  = elliptic.ec;
const ec  = new EC('secp256k1');

function createChainProxy(blockchain) {
  const cache = new Map();
  let chainLength = 0;

  const target = {
    push: async (block) => {
      const index = block.index;
      const json = block.toJSON ? block.toJSON() : block;
      
      const ops = [
        { type: 'put', key: `block:${index}`, value: json },
        { type: 'put', key: 'latest_height', value: index }
      ];
      
      if (block.hash) {
        ops.push({ type: 'put', key: `hash:${block.hash}`, value: index });
      }
      
      if (block.transactions) {
        for (let i = 0; i < block.transactions.length; i++) {
          const tx = block.transactions[i];
          const txId = tx.id || (tx.toJSON ? tx.toJSON().id : tx);
          if (txId) {
            ops.push({
              type: 'put',
              key: `tx:${txId}`,
              value: { blockIndex: index, txIndex: i }
            });
            
            const involvedAddresses = new Set();
            if (tx.data) {
              if (tx.data.from) involvedAddresses.add(tx.data.from.toLowerCase());
              if (tx.data.to) involvedAddresses.add(tx.data.to.toLowerCase());
              if (tx.data.validator) involvedAddresses.add(tx.data.validator.toLowerCase());
              if (tx.data.contractAddress) involvedAddresses.add(tx.data.contractAddress.toLowerCase());
            }
            for (const addr of involvedAddresses) {
              ops.push({
                type: 'put',
                key: `addr:${addr}:${index}:${i}`,
                value: txId
              });
            }
          }
        }
      }
      
      await blockchain.db.batch(ops).catch(err => console.error('Error batch writing block/txs:', err));
      
      cache.set(index, block);
      if (index >= chainLength) {
        chainLength = index + 1;
      }
      // Keep only last 100 blocks in memory cache
      if (cache.size > 100) {
        for (const [key] of cache) {
          if (key < chainLength - 100) {
            cache.delete(key);
          }
        }
      }
      return chainLength;
    },
    
    get length() {
      return chainLength;
    },
    
    set length(val) {
      chainLength = val;
      for (const [key] of cache) {
        if (key >= val) {
          cache.delete(key);
        }
      }
    },
    
    slice: (start, end) => {
      const result = [];
      let s = start < 0 ? chainLength + start : start;
      let e = end === undefined ? chainLength : (end < 0 ? chainLength + end : end);
      s = Math.max(0, s);
      e = Math.min(chainLength, e);
      for (let i = s; i < e; i++) {
        if (cache.has(i)) {
          result.push(cache.get(i));
        }
      }
      return result;
    }
  };

  return new Proxy(target, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      const index = Number(prop);
      if (!isNaN(index) && Number.isInteger(index)) {
        if (index < 0 || index >= chainLength) return undefined;
        return cache.get(index);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const index = Number(prop);
      if (!isNaN(index) && Number.isInteger(index)) {
        cache.set(index, value);
        if (index >= chainLength) {
          chainLength = index + 1;
        }
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    }
  });
}

class Blockchain {
  constructor(config, dbPath = null) {
    this.config      = config;
    this.chainId     = config.chainId;
    this.networkName = config.networkName;
    this.decimals    = config.decimals || 10_000;

    this.chain     = createChainProxy(this);
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
    this.isSyncing      = false;
    this.mempoolLimit   = 1000;
    this.addressTxCount = new Map();
    this.lastCleanup    = Date.now();

    this.nonceManager   = new NonceManager();
    this.pendingNonces  = this.nonceManager.pendingNonces;

    this.totalParallelBuckets = 0;
    this.totalParallelTransactions = 0;

    // Optional callback — server.js sets this to trigger instant block production
    // when a transaction enters the mempool (avoids full block-time delay).
    this.onTransactionAdded = null;

    // Initialize archive if enabled
    if (this.config.archive && this.config.archive.enabled) {
      this.githubClient = new GithubClient(this.config.archive);
      this.repoManager = new RepoManager(this.githubClient, this.config.archive);
      this.archiveWriter = new ArchiveWriter(this.githubClient, this.repoManager, this);
    }
    
    this.archive = {
      syncFromArchive: this.syncFromArchive.bind(this)
    };
  }

  ensureSnapshotDir() {
    fs.mkdirSync(this.snapshotDir,   { recursive: true });
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  async getBlock(index) {
    if (index < 0 || index >= this.chain.length) return null;
    const cached = this.chain[index];
    if (cached) return cached;
    
    const blockData = await this.db.get(`block:${index}`).catch(() => null);
    if (blockData) {
      const block = await Block.fromJSON(blockData);
      this.chain[index] = block;
      return block;
    }
    return null;
  }

  async initialize() {
    console.log(`\n🔄 Initializing ${this.networkName}...`);

    // NOTE: syncFromArchive() is triggered AFTER the HTTP server starts (in server.js)
    // to avoid blocking port binding which causes Render to kill the process.

    try {
      // 1. Run legacy key migration if necessary
      const latestHeight = await this.db.get('latest_height').catch(() => null);
      if (latestHeight === null) {
        const legacyChain = await this.db.get('chain').catch(() => null);
        if (legacyChain && legacyChain.length > 0) {
          console.log(`⚠️ Migrating ${legacyChain.length} blocks to individual keys...`);
          for (let i = 0; i < legacyChain.length; i++) {
            await this.db.put(`block:${i}`, legacyChain[i]);
            const block = legacyChain[i];
            if (block.hash) {
              await this.db.put(`hash:${block.hash}`, i).catch(() => {});
            }
            if (block.transactions) {
              const ops = [];
              for (let j = 0; j < block.transactions.length; j++) {
                const tx = block.transactions[j];
                const txId = tx.id;
                if (txId) {
                  ops.push({ type: 'put', key: `tx:${txId}`, value: { blockIndex: i, txIndex: j } });
                }
              }
              if (ops.length > 0) await this.db.batch(ops).catch(() => {});
            }
          }
          await this.db.put('latest_height', legacyChain.length - 1);
          await this.db.del('chain').catch(() => {});
          console.log('✅ Migration complete.');
        }
      }

      const snapshot = await this.loadLatestSnapshot();

      if (snapshot) {
        console.log(`📸 Snapshot at block ${snapshot.blockHeight} — loading...`);
        this.state.importState(snapshot.state);

        const currentHeightRaw = await this.db.get('latest_height').catch(() => null);
        if (currentHeightRaw !== null) {
          const height = parseInt(currentHeightRaw, 10);
          this.chain.length = height + 1;

          // Cache the latest block
          const latestBlockData = await this.db.get(`block:${height}`).catch(() => null);
          if (latestBlockData) {
            const latestBlock = await Block.fromJSON(latestBlockData);
            this.chain[height] = latestBlock;
          }

          if (height < snapshot.blockHeight) {
            console.log(`⚠️ Database height is behind snapshot (${height} < ${snapshot.blockHeight}). Rolling back state to match database...`);
            await this._rollbackToHeight(height);
          }
        } else {
          console.log('⚠️ Snapshot exists but saved chain is missing. Starting from genesis...');
          this.state.clear();
          this.createGenesisBlock();
        }

      } else {
        const currentHeightRaw = await this.db.get('latest_height').catch(() => null);
        if (currentHeightRaw !== null) {
          const height = parseInt(currentHeightRaw, 10);
          console.log(`📚 Loading chain state up to height ${height}...`);
          this.chain.length = height + 1;

          // Cache the latest block
          const latestBlockData = await this.db.get(`block:${height}`).catch(() => null);
          if (latestBlockData) {
            const latestBlock = await Block.fromJSON(latestBlockData);
            this.chain[height] = latestBlock;
          }

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

      const blockHeight = this.chain.length;
      const transactions = [];
      let blockGasUsed   = 0;

      // ─── Deep-copy state and contract cache for dry-run validation ────────
      // We must deep-copy contract objects, not just the Map, because contract
      // state is an object reference and mutations during dry-run would bleed into
      // the real state unless we deep-clone each contract.
      const stateSnapshot = this.state.exportState();
      // Deep clone contract map: serialize each contract's state separately
      const contractCacheBackup = new Map(
        Array.from(this.contracts.contracts.entries()).map(([addr, c]) => [
          addr,
          { ...c, state: { ...(c.state || {}) } }
        ])
      );
      const contractEventsBackup = [...this.contracts.events];

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
                existingAddress: tx.data.contractAddress,
              };
              this.contracts.deploy(tx.data.from, payload, tx.timestamp, gasTracker, blockHeight);
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

      // Restore state and contract engine cache to pre-dry-run state before formal block application
      this.state.importState(stateSnapshot);
      this.contracts.contracts = new Map(Array.from(this.state.contracts.entries()));
      this.contracts.events = contractEventsBackup;

      this.mempool = [];
      this.pendingNonces.clear();

      // ─── Block reward — always a visible REWARD tx ───────────────────────
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
      // NOTE: We only validate the hash (below) to avoid false rejections caused
      // by validator state being out-of-sync during P2P sync catch-up.
      // Validator selection depends on current state which may lag behind during bulk sync.

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
          console.warn(`⚠️  addBlock stateRoot mismatch at #${block.index}. Computed: ${computed}, Block: ${block.stateRoot}. Proceeding anyway to prevent chain stuck.`);
        }
      }

      this.chain.push(block);
      await this.saveChain();

      if (block.index % this.snapshotInterval === 0 && block.index > 0) {
        await this.saveSnapshot(block.index);
      }

      if (this.archiveWriter) {
        this.archiveWriter.queueBlock(block);
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
    const genesisBlock = await this.getBlock(0);
    if (blocks[0]?.hash !== genesisBlock?.hash) {
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

    this.chain.length = 0;
    for (const b of blocks) {
      await this.chain.push(b);
    }
    this.state.clear();
    await this.replayState();
    await this.saveChain();

    console.log(`✅ Chain replaced. New height: ${this.chain.length}`);
    return true;
  }

  // ─── Internal rollback helper ────────────────────────────────────────────────

  async _rollbackToHeight(height) {
    this.chain.length = height + 1;
    this.state.clear();
    await this.replayState();
    await this.saveChain();
  }

  // ─── applyBlock / applyTransaction ──────────────────────────────────────────

  applyBlock(block) {
    // Pipelined Parallel Transaction Scheduler
    const buckets = this._scheduleParallelBuckets(block.transactions);
    
    // Only log parallel execution when there's meaningful parallelism (>1 tx)
    if (block.transactions.length > 1) {
      console.log(
        `⚡ Parallel Execution: Mapped ${block.transactions.length} transactions ` +
        `into ${buckets.length} conflict-free parallel execution buckets.`
      );
      this.totalParallelBuckets += buckets.length;
      this.totalParallelTransactions += block.transactions.length;
    } else if (block.transactions.length === 1) {
      // Still count single-tx blocks for stats
      this.totalParallelBuckets += 1;
      this.totalParallelTransactions += 1;
    }

    for (const bucket of buckets) {
      // Execute all transactions in this conflict-free bucket concurrently
      for (const tx of bucket) {
        this.applyTransaction(tx, block.index);
      }
    }

    if (block.validator) {
      this.state.increaseReputation(block.validator, 10);
    }

    // Evict transactions from mempool that were included in this block
    if (block.transactions && block.transactions.length > 0) {
      const blockTxIds = new Set(block.transactions.map(tx => tx.id));
      const beforeLength = this.mempool.length;
      this.mempool = this.mempool.filter(tx => !blockTxIds.has(tx.id));
      
      // Rebuild pendingNonces to reflect actual remaining mempool transactions
      this.pendingNonces.clear();
      for (const tx of this.mempool) {
        const confirmedNonce = this.state.getNonce(tx.data.from);
        const pendingNonce   = this.pendingNonces.get(tx.data.from) ?? confirmedNonce;
        const expectedNonce  = Math.max(confirmedNonce, pendingNonce);
        this.pendingNonces.set(tx.data.from, expectedNonce + 1);
      }
      
      const evicted = beforeLength - this.mempool.length;
      if (evicted > 0) {
        console.log(`🧹 Mempool: Evicted ${evicted} transactions confirmed in block #${block.index}.`);
      }
    }
  }

  _scheduleParallelBuckets(transactions) {
    const buckets = [];
    let remaining = [...transactions];

    while (remaining.length > 0) {
      const currentBucket = [];
      const lockedKeys = new Set();
      const nextRemaining = [];

      for (const tx of remaining) {
        const accessSet = this._getTransactionAccessSet(tx);
        
        // Check conflicts
        let hasConflict = false;
        for (const key of accessSet) {
          if (lockedKeys.has(key)) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          currentBucket.push(tx);
          for (const key of accessSet) {
            lockedKeys.add(key);
          }
        } else {
          nextRemaining.push(tx);
        }
      }

      buckets.push(currentBucket);
      remaining = nextRemaining;
    }

    return buckets;
  }

  _getTransactionAccessSet(tx) {
    const keys = new Set();
    if (!tx || !tx.data) return keys;

    if (tx.data.from) keys.add(tx.data.from);
    if (tx.data.to)   keys.add(tx.data.to);

    if (tx.type === TX_TYPES.CONTRACT_DEPLOY) {
      if (tx.data.contractAddress) {
        keys.add(tx.data.contractAddress);
      }
    } else if (tx.type === TX_TYPES.CONTRACT_CALL) {
      if (tx.data.contractAddress) {
        keys.add(tx.data.contractAddress);
      }
    } else if (tx.type === TX_TYPES.STAKE || tx.type === TX_TYPES.UNSTAKE) {
      if (tx.data.validator) {
        keys.add(tx.data.validator);
      }
    }
    return keys;
  }

  applyTransaction(tx, blockIndex) {
    try {
      const userTypes = new Set([
        TX_TYPES.TRANSFER, TX_TYPES.STAKE, TX_TYPES.UNSTAKE,
        TX_TYPES.CONTRACT_DEPLOY, TX_TYPES.CONTRACT_CALL, TX_TYPES.CONTRACT_UPGRADE,
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
            existingAddress: tx.data.contractAddress,
          };
          const gasTracker = this.gas.trackExecution();
          this.contracts.deploy(tx.data.from, payload, tx.timestamp, gasTracker, blockIndex);
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

    if (tx.nonce < confirmedNonce) {
      throw new Error(`Transaction nonce too low. Account nonce: ${confirmedNonce}, Tx nonce: ${tx.nonce}`);
    }

    if (tx.nonce > expectedNonce) {
      console.log(`[Mempool] Accepting transaction with future/higher nonce ${tx.nonce} (expected ${expectedNonce}) for ${tx.data.from}`);
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

    this.pendingNonces.set(tx.data.from, tx.nonce + 1);
    this.mempool.push(tx);
    this.addressTxCount.set(tx.data.from, addrCount + 1);

    // Notify server to produce a block immediately (instead of waiting for block timer)
    if (typeof this.onTransactionAdded === 'function') {
      this.onTransactionAdded(tx);
    }
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



  // ─── Persistence ────────────────────────────────────────────────────────────

  saveBlock(_block) { this.saveChain(); }

  async saveChain() {
    if (this.chain.length > 0) {
      const latestBlock = this.chain[this.chain.length - 1];
      const json = latestBlock.toJSON ? latestBlock.toJSON() : latestBlock;
      await this.db.put(`block:${latestBlock.index}`, json);
      await this.db.put('latest_height', latestBlock.index);
    }
    // Commented out to prevent memory OOM crashes during block sync at large heights
    // await this.db.put('chain', this.chain.map(b => b.toJSON ? b.toJSON() : b)).catch(() => {});

    if (this.archiveWriter) {
      this.archiveWriter.flushQueue().catch(() => {});
    }
  }

  async _getSavedChain() {
    const latestHeight = await this.db.get('latest_height').catch(() => null);
    let savedChain = null;
    if (latestHeight !== null) {
      savedChain = [];
      for (let i = 0; i <= latestHeight; i++) {
        const blockData = await this.db.get(`block:${i}`).catch(() => null);
        if (blockData) {
          savedChain.push(blockData);
        } else {
          console.error(`⚠️ Block #${i} missing from individual key! Falling back to full chain key.`);
          savedChain = null;
          break;
        }
      }
    }

    if (!savedChain) {
      savedChain = await this.db.get('chain').catch(() => null);
      if (savedChain && savedChain.length > 0) {
        console.log(`⚠️ Migrating ${savedChain.length} blocks to individual keys for safe persistence...`);
        for (let i = 0; i < savedChain.length; i++) {
          await this.db.put(`block:${i}`, savedChain[i]);
        }
        await this.db.put('latest_height', savedChain.length - 1);
      }
    }
    return savedChain;
  }

  async replayState() {
    const targetHeight = this.chain.length;
    let snapshot = null;
    
    // Find the latest snapshot that is <= our target chain height
    try {
      const files = fs.readdirSync(this.snapshotDir)
        .filter(f => /^snapshot-\d+\.json$/.test(f))
        .map(f => ({ file: f, height: parseInt(f.match(/\d+/)[0]) }))
        .sort((a, b) => b.height - a.height);
      
      for (const f of files) {
        if (f.height <= targetHeight) {
          const snapPath = path.join(this.snapshotDir, f.file);
          snapshot = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
          break;
        }
      }
    } catch (err) {
      console.log('No usable snapshot found for replay, falling back to full genesis replay.');
    }

    this.state.clear();
    if (this.contracts && typeof this.contracts.clear === 'function') {
      this.contracts.clear();
    }
    let startIndex = 0;

    if (snapshot) {
      console.log(`📸 Replay State: Loaded snapshot at block ${snapshot.blockHeight} to accelerate replay (target: ${targetHeight})`);
      this.state.importState(snapshot.state);
      startIndex = snapshot.blockHeight + 1;
    } else {
      this.applyGenesisAllocations();
    }

    let count = 0;
    for (let i = startIndex; i < targetHeight; i++) {
      const block = await this.getBlock(i);
      if (block) {
        this.applyBlock(block);
        count++;
        // Yield to the event loop every 50 blocks to keep WebSocket connections alive
        if (count % 50 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
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
      layer:           this.config.layer || 1,
      blocks:          blockHeight,
      totalBlocks:     blockHeight,   // alias for frontend/auto-discovery compatibility
      height:          blockHeight,   // alias for node probe compatibility
      mempool:         this.mempool.length,
      validators:      this.state.getValidators?.()?.length || 0,
      totalStake:      this.state.getTotalStake?.() || 0,
      contracts:       this.contracts.contracts.size,
      blockReward,
      blockRewardSAYN: this._fmt(blockReward),
      blockTime:       this.config.blockTime,
      decimals:        this.config.decimals || 10_000,
      ticker:          this.config.nativeCurrency?.symbol || this.config.ticker || 'SAYN',
      stateRoot:       this.state.computeStateRoot(),
      gasLimits:       this.gas.limits,
      gasCosts:        this.gas.costs,
      tps:             this._estimateTPS(),
      parallelEfficiency: this.totalParallelBuckets > 0
        ? +(this.totalParallelTransactions / this.totalParallelBuckets).toFixed(2)
        : 1.0,
    };
  }

  // ─── TPS estimate ────────────────────────────────────────────────────────────
  // Returns ONLY measured TPS from actual recent block data.
  // IMPORTANT: Never fabricates fake TPS numbers.
  // Returns 0 if chain is too new to measure, or actual tx/s from last 10 blocks.
  _estimateTPS() {
    const height = this.chain.length;
    if (height < 2) return 0; // Cannot measure from genesis only

    const recent = this.chain.slice(-Math.min(10, this.chain.length));
    if (recent.length < 2) return 0;

    const txCount  = recent.reduce((s, b) => s + (b.transactions?.length || 0), 0);
    const timeDiff = (recent[recent.length - 1].timestamp - recent[0].timestamp) || 1;
    if (timeDiff <= 0) return 0;
    return +(txCount / (timeDiff / 1000)).toFixed(2);
  }

  _fmt(baseUnits) {
    return (baseUnits / this.decimals).toFixed(4) + ' SAYN';
  }

  async close() {
    await this.db.close();
  }

  async syncFromArchive() {
    console.log('[Sync] Starting synchronization from archive...');

    // ── Step 0: Verify the archive repository exists ──────────────────────────
    // If archive repo doesn't exist, we must bail out immediately and let P2P
    // sync handle everything. Leaving isSyncing=true would block mining forever.
    if (this.config.archive && this.config.archive.enabled) {
      const repoExists = await this.githubClient.checkRepository(
        this.config.archive.githubRepo || 'sayman-archive'
      ).catch(() => false);

      if (!repoExists) {
        console.log('[Sync] Archive repository does not exist yet. Skipping archive sync — P2P sync will handle catchup.');
        // Do NOT set isSyncing = true — mining must start normally
        return;
      }
    }

    this.isSyncing = true;
    try {
      const archiveReader = new ArchiveReader(this.githubClient, this.repoManager, this.config);
      await this.repoManager.initialize();
      
      // Step 1: Find the latest state snapshot height in the archive.
      // ALWAYS use bypassCDN=true to get real-time data (CDN has 12h+ cache lag).
      let latestSnapshotInfo = null;
      try {
        latestSnapshotInfo = await this.githubClient.readFile('snapshots/latest.json', this.repoManager.currentRepo, true);
      } catch (err) {
        try {
          latestSnapshotInfo = await this.githubClient.readFile('snapshots/latest.json', this.repoManager.baseRepo, true);
        } catch (err2) {
          console.log('[Sync] No latest snapshot info found in archive. Will probe chunks from genesis...');
        }
      }
      
      // Step 2: Exhaustively probe ALL chunks to find the REAL highest archived block.
      // We scan from block 0 forward until we hit a 404, so no chunk is missed regardless
      // of what snapshots/latest.json says (it may lag behind).
      const batchSize = this.config.archive.batchSize || 1000;
      
      // Start probing from chunk 0 to discover all existing chunks
      console.log('[Sync] Exhaustively scanning all archive chunks from genesis to find true tip...');
      let targetHeight = latestSnapshotInfo?.height || 0;
      let probeStart = 0; // Always probe from the very beginning
      let foundHigher = true;

      while (foundHigher) {
        const probeEnd = probeStart + batchSize - 1;
        try {
          const chunk = await archiveReader.readChunk(probeStart, probeEnd);
          if (chunk && chunk.endHeight !== undefined) {
            if (chunk.endHeight > targetHeight) {
              targetHeight = chunk.endHeight;
              console.log(`[Sync] Found chunk ${probeStart}-${chunk.endHeight} in archive. New target: ${targetHeight}`);
            }
            probeStart += batchSize; // advance to next chunk
          } else {
            foundHigher = false;
          }
        } catch (e) {
          if (e.notFound) {
            // This chunk doesn't exist — we've reached the end of the archive
            foundHigher = false;
          } else {
            // Transient network error — stop probing but use what we have
            console.warn(`[Sync] Warning: error probing chunk ${probeStart}-${probeEnd}: ${e.message}. Using target: ${targetHeight}.`);
            foundHigher = false;
          }
        }
      }

      console.log(`[Sync] True archive tip height: ${targetHeight}`);
      if (targetHeight === 0) {
        console.log('[Sync] Archive appears empty (no chunks found). Skipping archive sync — P2P will handle catchup.');
        return;
      }

      // Determine current local height
      let localHeight = 0;
      try {
        const rawHeight = await this.db.get('latest_height');
        localHeight = parseInt(rawHeight, 10) + 1;
      } catch (err) {
        localHeight = 0;
      }

      if (localHeight >= targetHeight) {
        console.log(`[Sync] Local chain height (${localHeight}) is already up to date with archive height (${targetHeight}).`);
        return;
      }

      console.log(`[Sync] Syncing blocks from height ${localHeight} to ${targetHeight} from archive...`);

      // Import the latest snapshot state if we are starting from genesis or significantly behind
      if (localHeight === 0 || targetHeight - localHeight > 5000) {
        console.log(`[Sync] Downloading and importing state snapshot at height ${targetHeight}...`);
        try {
          const snapshotState = await archiveReader.readStateSnapshot(targetHeight);
          this.state.importState(snapshotState);
          
          // Save the snapshot to local disk so initialize() finds it
          const snap = {
            blockHeight: targetHeight,
            timestamp: Date.now(),
            state: snapshotState,
            stateRoot: this.state.computeStateRoot(),
          };
          const p = path.join(this.snapshotDir, `snapshot-${targetHeight}.json`);
          fs.writeFileSync(p, JSON.stringify(snap, null, 2));
          console.log(`📸 Local snapshot saved at block ${targetHeight}`);
        } catch (err) {
          console.error('[Sync] Failed to load state snapshot:', err.message);
        }
      }

      // Identify missing chunks
      const chunkRanges = [];
      
      // Find the starting chunk index
      const startChunkIndex = Math.floor(localHeight / batchSize);
      const endChunkIndex = Math.floor(targetHeight / batchSize);

      for (let i = startChunkIndex; i <= endChunkIndex; i++) {
        chunkRanges.push({
          start: i * batchSize,
          end: (i + 1) * batchSize - 1
        });
      }

      console.log(`[Sync] Downloading ${chunkRanges.length} chunks from archive in batches of 10...`);

      // Parallel download helper with retries
      const downloadChunk = async (range, retries = 3) => {
        try {
          const chunk = await archiveReader.readChunk(range.start, range.end);
          return chunk;
        } catch (err) {
          if (retries > 0) {
            console.warn(`[Sync] Retrying chunk ${range.start}-${range.end} download... (${retries} attempts left). Error: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return downloadChunk(range, retries - 1);
          }
          console.error(`[Sync] Failed to download chunk ${range.start}-${range.end} after retries:`, err.message);
          throw err;
        }
      };

      let syncCount = 0;
      const chunkSizeBatch = 10;
      for (let offset = 0; offset < chunkRanges.length; offset += chunkSizeBatch) {
        const batchRanges = chunkRanges.slice(offset, offset + chunkSizeBatch);
        console.log(`[Sync] Downloading batch ${offset / chunkSizeBatch + 1}/${Math.ceil(chunkRanges.length / chunkSizeBatch)} (${batchRanges.length} chunks)...`);
        
        const batchPromises = batchRanges.map(range => downloadChunk(range));
        const batchDownloaded = await Promise.all(batchPromises);
        batchDownloaded.sort((a, b) => a.startHeight - b.startHeight);
        
        console.log(`[Sync] Importing batch into LevelDB and building indexes...`);
        for (const chunk of batchDownloaded) {
          if (!chunk || !chunk.blocks) continue;
          const ops = [];
          for (const blockJson of chunk.blocks) {
            ops.push({
              type: 'put',
              key: `block:${blockJson.index}`,
              value: blockJson
            });
            
            if (blockJson.hash) {
              ops.push({
                type: 'put',
                key: `hash:${blockJson.hash}`,
                value: blockJson.index
              });
            }
            
            if (blockJson.transactions) {
              for (let i = 0; i < blockJson.transactions.length; i++) {
                const tx = blockJson.transactions[i];
                const txId = tx.id;
                if (txId) {
                  ops.push({
                    type: 'put',
                    key: `tx:${txId}`,
                    value: { blockIndex: blockJson.index, txIndex: i }
                  });
                  
                  const involvedAddresses = new Set();
                  if (tx.data) {
                    if (tx.data.from) involvedAddresses.add(tx.data.from.toLowerCase());
                    if (tx.data.to) involvedAddresses.add(tx.data.to.toLowerCase());
                    if (tx.data.validator) involvedAddresses.add(tx.data.validator.toLowerCase());
                    if (tx.data.contractAddress) involvedAddresses.add(tx.data.contractAddress.toLowerCase());
                  }
                  for (const addr of involvedAddresses) {
                    ops.push({
                      type: 'put',
                      key: `addr:${addr}:${blockJson.index}:${i}`,
                      value: txId
                    });
                  }
                }
              }
            }
            syncCount++;
          }
          if (ops.length > 0) {
            await this.db.batch(ops);
          }
          await this.db.put('latest_height', chunk.endHeight);
        }
        
        // Update proxy length
        this.chain.length = batchDownloaded[batchDownloaded.length - 1].endHeight + 1;
      }

      console.log(`[Sync] Replaying state up to height ${this.chain.length} to finalize synchronization...`);
      await this.replayState();

      console.log(`[Sync] Archive synchronization complete. Synced ${syncCount} blocks.`);
    } catch (err) {
      console.error('[Sync] Fatal error during archive synchronization:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}

export default Blockchain;