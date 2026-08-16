import express from 'express';
import Transaction from '../core/transaction.js';
import Wallet from '../wallet/wallet.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getNumericChainId } from '../core/evmHelper.js';

export function setupRoutes(app, blockchain, p2pServer, config) {
  const router = express.Router();

  // ── Cache-Control helper ─────────────────────────────────────────────
  // Cloudflare respects s-maxage on edge cache nodes.
  // max-age tells browsers to cache locally too.
  // Immutable data (txs by hash, blocks by hash) get long TTLs.
  function cache(res, seconds, immutable = false) {
    const directive = immutable
      ? `public, max-age=${seconds}, s-maxage=${seconds}, immutable`
      : `public, max-age=${seconds}, s-maxage=${seconds}`;
    res.setHeader('Cache-Control', directive);
    res.setHeader('Vary', 'Accept-Encoding');
  }

  function normalizeBlockForApi(block) {
    const json = block.toJSON ? block.toJSON() : block;
    const timestamp =
      typeof json.timestamp === 'number' && Number.isFinite(json.timestamp)
        ? json.timestamp
        : (typeof json.previousHash === 'number' && Number.isFinite(json.previousHash)
            ? json.previousHash
            : null);

    return {
      ...json,
      timestamp,
      previousHash:
        timestamp !== null && typeof json.timestamp !== 'number'
          ? null
          : json.previousHash
    };
  }

  // Network info (rarely changes — 1 hour TTL)
  router.get('/network', (req, res) => {
    try {
      cache(res, 3600);
      const stats = blockchain.getStats();
      const dec   = config.decimals || 100_000_000;
      const symbol = config.nativeCurrency?.symbol || config.ticker || 'SAYN';
      res.json({
        network:       config.networkName,
        chainId:       config.chainId,
        layer:         config.layer || 1,
        ticker:        symbol,
        nativeCurrency: config.nativeCurrency || {
          name: 'SAYN',
          symbol: 'SAYN',
          decimals: 8
        },
        faucetEnabled: config.faucetEnabled,
        blockTime:     config.blockTime,
        blockReward:   config.blockReward,
        minStake:      config.minStake,
        unstakeDelay:  config.unstakeDelay,
        gasLimits:     stats.gasLimits,
        gasCosts:      stats.gasCosts,
        stateRoot:     stats.stateRoot,
        decimals:      dec,
        // Explicit denomination guide — eliminates all confusion in the explorer
        denomination: {
          ticker:        symbol,
          decimals:      dec,
          humanUnit:     `1 ${symbol}`,
          baseUnit:      `${dec} base units`,
          description:   `All balances on-chain are stored as integers in base units. Divide by ${dec} to get ${symbol}.`
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  // Stats (changes every block ~5s — short TTL)
  router.get('/stats', (req, res) => {
    try {
      cache(res, 5);
      res.json(blockchain.getStats());
    } catch (err) {
      res.json({ blocks: 0, validators: 0, totalStake: 0, mempool: 0, contracts: 0, stateRoot: '0', network: config.networkName, chainId: config.chainId });
    }
  });

  // Blocks with pagination (5s TTL — new block every 5s)
  router.get('/blocks', async (req, res) => {
    try {
      cache(res, 5);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const totalBlocks = blockchain.chain.length;
      
      const start = Math.max(0, totalBlocks - page * limit);
      const end = Math.max(0, totalBlocks - (page - 1) * limit);
      
      const paginatedBlocks = [];
      for (let i = end - 1; i >= start; i--) {
        const block = await blockchain.getBlock(i);
        if (block) {
          paginatedBlocks.push(normalizeBlockForApi(block));
        }
      }
      
      res.json({
        blocks: paginatedBlocks,
        total: totalBlocks,
        page,
        limit,
        totalPages: Math.ceil(totalBlocks / limit)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Batch Range query for Explorer Range Synchronization ──────────────────
  router.get(['/block-range', '/blocks/range'], async (req, res) => {
    try {
      cache(res, 5);
      const start = parseInt(req.query.start || req.query.from || 0);
      const end = parseInt(req.query.end || req.query.to || (start + 49));
      const blocks = await blockchain.getBlockRange(start, end);
      res.json({
        start,
        end,
        total: blocks.length,
        blocks: blocks.map(normalizeBlockForApi)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/blocks/range/:start/:end', async (req, res) => {
    try {
      cache(res, 5);
      const start = parseInt(req.params.start);
      const end = parseInt(req.params.end);
      const blocks = await blockchain.getBlockRange(start, end);
      res.json({
        start,
        end,
        total: blocks.length,
        blocks: blocks.map(normalizeBlockForApi)
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Community Nodes: Live decentralized network participants ──────────────
  router.get('/community-nodes', (req, res) => {
    try {
      const nodes = [];
      const localNodeId = p2pServer ? p2pServer.nodeId : 'local-node';
      
      // Local node
      nodes.push({
        nodeId: localNodeId,
        role: process.env.NODE_MODE === 'validator' ? 'Validator' : 'Community Node',
        status: 'ONLINE',
        isLocal: true,
        height: blockchain.chain.length,
        storageMB: 250,
        reputation: 1000,
        latency: 0,
        blocksProduced: blockchain.chain.length
      });

      // P2P connected peers
      if (p2pServer && p2pServer.peers) {
        for (const [id, peer] of p2pServer.peers.entries()) {
          nodes.push({
            nodeId: peer.nodeId || `peer-${id.slice(0, 8)}`,
            role: 'Relay & Storage Contributor',
            status: peer.ws?.readyState === 1 ? 'ACTIVE' : 'WARNING',
            isLocal: false,
            height: peer.chainHeight || 0,
            storageMB: 250,
            reputation: peer.reputation || 500,
            latency: peer.lastSeen ? Math.max(1, Date.now() - peer.lastSeen) : 25,
            url: peer.url || 'inbound'
          });
        }
      }

      res.json({
        total: nodes.length,
        active: nodes.filter(n => n.status === 'ONLINE' || n.status === 'ACTIVE').length,
        nodes
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Single block by index (legacy)
  router.get('/blocks/:index', async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const block = await blockchain.getBlock(index);
      
      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }

      res.json(normalizeBlockForApi(block));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FIX: Get block by index (frontend uses this) ──────────────────────────
  router.get('/block/:index', async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index) || index < 0) {
        return res.status(400).json({ error: 'Invalid block index' });
      }

      const block = await blockchain.getBlock(index);
      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }

      res.json(normalizeBlockForApi(block));
    } catch (err) {
      console.error('Error fetching block:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FIX: Get block by hash ──────────────────────────────────────────────────
  router.get('/block/hash/:hash', async (req, res) => {
    try {
      const hash = req.params.hash;
      if (!hash || hash.length < 8) {
        return res.status(400).json({ error: 'Invalid hash' });
      }

      // Check if we have hash mapping in db
      const blockIndexRaw = await blockchain.db.get(`hash:${hash}`).catch(() => null);
      let block = null;
      if (blockIndexRaw !== null) {
        const blockIndex = parseInt(blockIndexRaw, 10);
        block = await blockchain.getBlock(blockIndex);
      } else {
        // Fallback for short hashes or unindexed hashes: check the last 100 blocks in cache
        const recentLimit = Math.max(0, blockchain.chain.length - 100);
        for (let i = blockchain.chain.length - 1; i >= recentLimit; i--) {
          const b = await blockchain.getBlock(i);
          if (b && (b.hash === hash || b.hash.startsWith(hash))) {
            block = b;
            break;
          }
        }
      }

      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }

      res.json(normalizeBlockForApi(block));
    } catch (err) {
      console.error('Error fetching block by hash:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Light client endpoint - Block header only
  router.get('/light/block/:height', async (req, res) => {
    try {
      const height = parseInt(req.params.height);
      const block = await blockchain.getBlock(height);
      
      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }

      res.json({
        index: block.index,
        timestamp: block.timestamp,
        previousHash: block.previousHash,
        validator: block.validator,
        hash: block.hash,
        stateRoot: block.stateRoot,
        gasUsed: block.gasUsed,
        chainId: block.chainId,
        transactionCount: block.transactions.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch block header' });
    }
  });

  // Merkle proof endpoint
  router.get('/proof/:address', (req, res) => {
    try {
      const { address } = req.params;
      const stateRoot = blockchain.state.computeStateRoot();
      const proof = blockchain.state.generateProof(address);
      
      if (!proof) {
        return res.status(404).json({ 
          error: 'Account not found in state tree',
          address 
        });
      }

      res.json({
        address,
        proof,
        stateRoot,
        blockHeight: blockchain.chain.length - 1,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Proof generation error:', error);
      res.status(500).json({ error: 'Failed to generate proof' });
    }
  });

  // Verify proof endpoint
  router.post('/proof/verify', (req, res) => {
    try {
      const { proof, stateRoot } = req.body;

      if (!proof || !stateRoot) {
        return res.status(400).json({ 
          error: 'Missing proof or stateRoot' 
        });
      }

      const isValid = blockchain.state.verifyProof(proof, stateRoot);

      res.json({
        valid: isValid,
        address: proof.leaf?.key,
        stateRoot
      });
    } catch (error) {
      console.error('Proof verification error:', error);
      res.status(500).json({ error: 'Failed to verify proof' });
    }
  });

  // Transaction by ID
  router.get('/transactions/:id', async (req, res) => {
    try {
      const txId = req.params.id;
      
      const txLocationRaw = await blockchain.db.get(`tx:${txId}`).catch(() => null);
      if (txLocationRaw) {
        const txLocation = typeof txLocationRaw === 'string' ? JSON.parse(txLocationRaw) : txLocationRaw;
        const block = await blockchain.getBlock(txLocation.blockIndex);
        if (block) {
          const tx = block.transactions[txLocation.txIndex];
          if (tx) {
            return res.json({
              transaction: tx.toJSON(),
              blockIndex: block.index,
              blockHash: block.hash,
              timestamp: block.timestamp,
              stateRoot: block.stateRoot
            });
          }
        }
      }
      
      // Fallback for mempool
      const mempoolTx = blockchain.mempool.find(t => t.id === txId);
      if (mempoolTx) {
        return res.json({
          transaction: mempoolTx.toJSON(),
          blockIndex: -1,
          blockHash: 'pending',
          timestamp: mempoolTx.timestamp || Date.now(),
          stateRoot: 'pending'
        });
      }
      
      res.status(404).json({ error: 'Transaction not found' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Address info with nonce
  // Accepts both bare 40-char hex and 0x-prefixed EVM addresses (MetaMask compatibility)
  router.get('/address/:address', async (req, res) => {
    try {
      let address = req.params.address.trim().toLowerCase();
      if (address.startsWith('0x')) address = address.slice(2);
      
      const balance = blockchain.state.getBalance(address);
      const stake = blockchain.state.getStake(address);
      const unstaking = blockchain.state.isUnstaking(address);
      const unlockBlock = blockchain.state.getUnlockBlock(address);
      const nonce = blockchain.state.getNonce(address);
      
      const transactions = [];
      const prefix = `addr:${address}:`;
      try {
        for await (const [key, txId] of blockchain.db.iterator({ gte: prefix, lte: prefix + '\xff' })) {
          const parts = key.split(':');
          const blockIndex = parseInt(parts[2], 10);
          const txIndex = parseInt(parts[3], 10);
          
          const block = await blockchain.getBlock(blockIndex);
          if (block && block.transactions[txIndex]) {
            const tx = block.transactions[txIndex];
            transactions.push({
              ...tx.toJSON(),
              blockIndex: block.index,
              blockHash: block.hash,
              timestamp: block.timestamp
            });
          }
        }
      } catch (err) {
        console.error('Error scanning address transactions:', err);
      }
      
      const validators = blockchain.state.getValidators();
      const validatorInfo = validators.find(v => v.address === address);
      
      const reputation = blockchain.state.getReputation(address);
      const symbol = config.nativeCurrency?.symbol || config.ticker || 'SAYN';
      const decimals = config.decimals || 100_000_000;
      res.json({
        address,
        addressEVM: '0x' + address,   // always return 0x form for MetaMask display
        balance,
        balanceHuman: (balance / decimals).toFixed(8),
        symbol,
        stake,
        unstaking,
        unlockBlock,
        nonce,
        reputation,
        transactions: transactions.reverse(),
        isValidator: !!validatorInfo,
        validatorInfo: validatorInfo || null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Balance (legacy) — 0x-prefix compatible
  router.get('/balance/:address', (req, res) => {
    let address = req.params.address.trim().toLowerCase();
    if (address.startsWith('0x')) address = address.slice(2);
    const balance = blockchain.state.getBalance(address);
    const stake = blockchain.state.getStake(address);
    const unstaking = blockchain.state.isUnstaking(address);
    const unlockBlock = blockchain.state.getUnlockBlock(address);
    const nonce = blockchain.state.getNonce(address);
    const symbol = config.nativeCurrency?.symbol || config.ticker || 'SAYN';

    res.json({
      address,
      addressEVM: '0x' + address,
      balance,
      symbol,
      stake,
      unstaking,
      unlockBlock,
      nonce
    });
  });

  // Reputation
  router.get('/reputation/:address', (req, res) => {
    try {
      const { address } = req.params;
      const score = blockchain.state.getReputation(address);
      res.json({ address, reputation: score });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Validators
  router.get('/validators', (req, res) => {
    const validators = blockchain.state.getValidators();
    const totalStake = blockchain.state.getTotalStake();
    
    const blocksPerYear = (365 * 24 * 60 * 60 * 1000) / config.blockTime;
    const yearlyRewards = blocksPerYear * config.blockReward;
    const estimatedAPR = totalStake > 0 ? ((yearlyRewards / totalStake) * 100).toFixed(2) : 0;
    
    res.json({
      validators: validators.map(v => ({
        ...v,
        reputation: blockchain.state.getReputation(v.address),
        percentage: totalStake > 0 ? ((v.stake / totalStake) * 100).toFixed(2) : 0
      })),
      totalStake,
      totalValidators: validators.length,
      estimatedAPR
    });
  });

  // Contracts
  router.get('/contracts', (req, res) => {
    res.json({
      contracts: blockchain.state.getAllContracts()
    });
  });

  router.get('/contracts/:address', (req, res) => {
    const addr = req.params.address;

    // ContractEngine is source of truth for live state (setState writes there)
    // StateEngine has code + metadata; both are kept in sync by setState
    const liveContract  = blockchain.contracts?.getContract(addr);
    const stateContract = blockchain.state.getContract(addr);

    if (!liveContract && !stateContract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const base = liveContract || stateContract;

    // Merge all state sources (in priority order: liveContract > stateEngine.state > stateEngine.contractStorage)
    const liveState      = liveContract?.state      || {};
    const stateEngineObj = stateContract?.state      || {};
    const persistedState = blockchain.state.getContractFullState(addr) || {};
    // getContractFullState already returns contract.state from stateEngine;
    // liveContract.state is the ContractEngine cache. Merge all three:
    const mergedState = Object.assign({}, stateEngineObj, persistedState, liveState);

    // Build ABI: stored abi first; if empty, extract from code using all styles
    let abi = (base.abi && base.abi.length) ? base.abi : _extractContractABI(base.code || '');

    res.json({
      ...base,
      state: mergedState,
      abi,
      // Surface useful display metadata
      hasState:    Object.keys(mergedState).length > 0,
      methodCount: abi.length,
    });
  });

  // ─── Live contract state endpoint (for SAYFORGE & external tools) ─────────
  // Returns only the current state map, no code. Polled every 2s by SAYFORGE.
  router.get('/contracts/:address/state', (req, res) => {
    const addr = req.params.address;
    const liveContract  = blockchain.contracts?.getContract(addr);
    const stateContract = blockchain.state.getContract(addr);
    if (!liveContract && !stateContract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    const liveState      = liveContract?.state      || {};
    const stateEngineObj = stateContract?.state      || {};
    const persistedState = blockchain.state.getContractFullState(addr) || {};
    const mergedState    = Object.assign({}, stateEngineObj, persistedState, liveState);
    res.json({ address: addr, state: mergedState, hasState: Object.keys(mergedState).length > 0 });
  });

  // Helper: extract ABI from all contract styles (class, object-methods, flat fn, arrow fn)
  function _extractContractABI(code) {
    const methods  = new Set();
    const reserved = new Set(['if','for','while','switch','catch','return','async','await','function','class','const','let','var','new','this','try','throw','import','export','default']);
    let m;

    // Style C: flat function declarations  →  function myMethod(
    const flatFn = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    while ((m = flatFn.exec(code)) !== null) {
      if (!reserved.has(m[1])) methods.add(m[1]);
    }
    // Style B1: methods object literal  →  methodName: function(
    const objMethod = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s+)?function\s*\(/g;
    while ((m = objMethod.exec(code)) !== null) {
      if (!reserved.has(m[1])) methods.add(m[1]);
    }
    // Style B2: arrow functions in object  →  methodName: (args) =>
    const arrowMethod = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g;
    while ((m = arrowMethod.exec(code)) !== null) {
      if (!reserved.has(m[1]) && m[1] !== 'constructor') methods.add(m[1]);
    }
    // Style B3/A: shorthand methods  →  methodName(args) {
    const shorthand = /(?:^|[\n,{;])\s*(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm;
    while ((m = shorthand.exec(code)) !== null) {
      if (!reserved.has(m[1]) && m[1] !== 'constructor') methods.add(m[1]);
    }
    // Style: const methodName = (args) => or const methodName = async (args) =>
    const constArrow = /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g;
    while ((m = constArrow.exec(code)) !== null) {
      if (!reserved.has(m[1])) methods.add(m[1]);
    }
    return [...methods];
  }

  // Broadcast signed transaction (with gas)
  router.post('/broadcast', (req, res) => {
    const { type, data, timestamp, signature, publicKey, gasLimit, gasPrice, nonce } = req.body;

    if (!type || !data || !timestamp || !signature || !publicKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (gasLimit === undefined || gasPrice === undefined || nonce === undefined) {
      return res.status(400).json({ error: 'Missing gas parameters or nonce' });
    }

    const tx = new Transaction(type, data);
    tx.timestamp = timestamp;
    tx.signature = signature;
    tx.id = uuidv4();
    tx.gasLimit = gasLimit;
    tx.gasPrice = gasPrice;
    tx.nonce    = nonce;
    tx.publicKey = publicKey;

    const derivedAddress = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 40);

    if (derivedAddress !== data.from) {
      return res.status(400).json({ error: 'Address does not match public key' });
    }

    blockchain.state.setPublicKey(data.from, publicKey);

    if (!tx.isValid(blockchain.state.publicKeys)) {
      console.error(`❌ Invalid signature for tx from ${data.from}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
      blockchain.addTransaction(tx, publicKey);
    } catch (error) {
      // On any rejection (nonce/balance/gas), release the pending nonce slot
      // so the sender can immediately retry without incrementing their nonce.
      if (blockchain.nonceManager) {
        blockchain.nonceManager.releaseOnFailure(data.from, nonce);
      }
      console.error('Broadcast rejected:', error.message);
      return res.status(400).json({
        error: error.message,
        // Tell the client to refetch nonce — never reuse cached value after a rejection
        retryWithFreshNonce: true,
        freshNonce: blockchain.state.getNonce(data.from)
      });
    }

    if (p2pServer) p2pServer.broadcastTransaction(tx);

    console.log(`📨 Transaction received: ${type} from ${data.from.substring(0, 8)}... (gas: ${gasLimit} @ ${gasPrice})`);

    const feeBaseUnits = (tx.gasUsed || gasLimit) * gasPrice;
    const decimals = config.decimals || 100_000_000;
    const symbol = config.nativeCurrency?.symbol || config.ticker || 'SAYN';

    const response = {
      success:     true,
      txId:        tx.id,
      message:     'Transaction accepted and added to mempool',
      gasLimit:    tx.gasLimit,
      gasPrice:    tx.gasPrice,
      maxGasCost:  tx.gasLimit * tx.gasPrice,
      fee: {
        baseUnits:  feeBaseUnits,
        display:    `${(feeBaseUnits / decimals).toFixed(8)} ${symbol}`,
        breakdown:  `${gasLimit.toLocaleString()} units × ${gasPrice} base unit/gas`
      }
    };

    if (type === 'UNSTAKE') {
      response.unlockBlock = blockchain.chain.length + config.unstakeDelay;
    }

    res.json(response);
  });

  // Fresh nonce for an address — clients MUST call this immediately before every broadcast
  // (never cache the nonce between button clicks)
  router.get('/address/:address/nonce', (req, res) => {
    try {
      const { address } = req.params;
      const confirmed = blockchain.state.getNonce(address);
      // pendingNonces tracks highest assigned-but-unconfirmed nonce
      const pending = blockchain.nonceManager
        ? blockchain.nonceManager.getNonce(address)
        : confirmed;
      res.json({
        address,
        confirmedNonce: confirmed,
        pendingNonce:   pending,
        nextNonce:      Math.max(confirmed, pending)  // use this in your next broadcast
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin fund endpoint (testnet only)
  router.post('/admin/fund', async (req, res) => {
    try {
      const { address, amount, secret } = req.body;
      if (secret !== 'sayman-admin-2024') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      if (!address || !amount) {
        return res.status(400).json({ error: 'Address and amount required' });
      }

      const { default: Transaction } = await import('../core/transaction.js');
      const tx = new Transaction(
        'GENESIS',
        { to: address, amount: Number(amount) },
        Date.now(),
        0, // gasLimit
        0, // gasPrice
        0  // nonce
      );
      tx.id = tx.calculateHash();
      
      blockchain.mempool.push(tx);

      res.json({ success: true, message: 'Funding transaction queued in mempool' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Faucet (TESTNET ONLY)
  // Accepts both bare 40-char hex (PUKY/native) and 0x-prefixed 42-char (MetaMask/EVM wallets)
  router.post('/faucet', (req, res) => {
    try {
      if (!config.faucetEnabled) {
        return res.status(403).json({
          error: 'Faucet is disabled on mainnet',
          message: 'Faucet is only available on testnet'
        });
      }

      let { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Address required' });
      }

      // Strip 0x prefix — MetaMask sends 0x-prefixed addresses; SAYMAN stores bare hex
      address = address.trim().toLowerCase();
      if (address.startsWith('0x')) address = address.slice(2);

      if (address.length !== 40 || !/^[0-9a-f]+$/.test(address)) {
        return res.status(400).json({ error: 'Invalid address format. Provide a 40-char hex address or 0x-prefixed EVM address.' });
      }

      const symbol = config.nativeCurrency?.symbol || config.ticker || 'SAYN';
      const tx = new Transaction(
        'GENESIS',
        { to: address, amount: Number(config.faucetAmount) },
        Date.now(),
        0, // gasLimit
        0, // gasPrice
        0  // nonce
      );
      tx.id = tx.calculateHash();

      blockchain.mempool.push(tx);

      console.log(`🚰 Faucet: ${config.faucetAmount} ${symbol} → ${address.substring(0, 8)}...`);

      res.json({
        success: true,
        amount: config.faucetAmount,
        symbol,
        address: '0x' + address,  // return 0x-prefixed for MetaMask display
        message: `${config.faucetAmount} ${symbol} credited (pending in mempool)`
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Mempool
  router.get('/mempool', (req, res) => {
    res.json({
      size: blockchain.mempool.length,
      transactions: blockchain.mempool.map(tx => tx.toJSON())
    });
  });

  // Search
  router.get('/search/:query', async (req, res) => {
    try {
      const query = req.params.query.toLowerCase();
      
      // 1. Block by index
      if (!isNaN(query)) {
        const blockIndex = parseInt(query);
        const block = await blockchain.getBlock(blockIndex);
        if (block) {
          return res.json({
            type: 'block',
            result: block.toJSON()
          });
        }
      }
      
      // 2. Block by hash
      const blockIndexRaw = await blockchain.db.get(`hash:${query}`).catch(() => null);
      if (blockIndexRaw !== null) {
        const blockIndex = parseInt(blockIndexRaw, 10);
        const block = await blockchain.getBlock(blockIndex);
        if (block) {
          return res.json({
            type: 'block',
            result: block.toJSON()
          });
        }
      }
      
      // 3. Transaction by ID
      const txLocationRaw = await blockchain.db.get(`tx:${query}`).catch(() => null);
      if (txLocationRaw) {
        const txLocation = typeof txLocationRaw === 'string' ? JSON.parse(txLocationRaw) : txLocationRaw;
        const block = await blockchain.getBlock(txLocation.blockIndex);
        if (block) {
          const tx = block.transactions[txLocation.txIndex];
          if (tx) {
            return res.json({
              type: 'transaction',
              result: {
                ...tx.toJSON(),
                blockIndex: block.index,
                blockHash: block.hash
              }
            });
          }
        }
      }
      
      // 4. Address search
      const balance = blockchain.state.getBalance(query);
      if (balance > 0 || blockchain.state.getStake(query) > 0 || blockchain.state.getNonce(query) > 0) {
        return res.json({
          type: 'address',
          result: query
        });
      }
      
      res.status(404).json({ error: 'Not found' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Gas estimation
  router.post('/estimate-gas', (req, res) => {
    try {
      const { type, data } = req.body;
      
      const tempTx = new Transaction(type, data);
      const estimatedGas = blockchain.gas.calculateTransactionGas(tempTx);
      
      res.json({
        estimatedGas,
        recommendedGasLimit: Math.ceil(estimatedGas * 1.2),
        minGasPrice: blockchain.gas.limits.minGasPrice
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Network stats
  router.get('/network/stats', (req, res) => {
    try {
      const stats = blockchain.getStats();
      const p2pStats = p2pServer ? p2pServer.getNetworkStats() : { 
        peers: 0, 
        peerList: [], 
        nodeId: 'offline', 
        mode: 'api' 
      };
      
      // Always use the configured block time — computing from timestamps is misleading
      // because during fast-sync, blocks arrive in bursts giving ~1001ms instead of 5s.
      const avgBlockTime = config.blockTime;
      
      res.json({
        network: stats.network,
        chainId: stats.chainId,
        blockHeight: stats.blocks,
        validators: stats.validators,
        totalStake: stats.totalStake,
        mempool: stats.mempool,
        contracts: stats.contracts,
        peers: p2pStats.peers,
        peerList: p2pStats.peerList,
        nodeId: p2pStats.nodeId,
        mode: p2pStats.mode,
        averageBlockTime: Math.round(avgBlockTime),
        uptime: process.uptime(),
        timestamp: Date.now(),
        stateRoot: stats.stateRoot
      });
    } catch (error) {
      console.error('Network stats error:', error);
      res.status(500).json({ error: 'Failed to fetch network stats' });
    }
  });

  router.get('/network/peers', (req, res) => {
    if (!p2pServer) {
      return res.json({ peers: [] });
    }
    
    const p2pStats = p2pServer.getNetworkStats();
    res.json({
      count: p2pStats.peers,
      peers: p2pStats.peerList
    });
  });

  // Live TPS
  router.get('/tps', (req, res) => {
    try {
      const tps = blockchain._estimateTPS();
      const dec = blockchain.config.decimals || 10_000;
      const blockHeight = blockchain.chain.length;
      const lastBlock = blockchain.getLastBlock();
      res.json({
        tps,
        blockHeight,
        decimals: dec,
        ticker: blockchain.config.nativeCurrency?.symbol || blockchain.config.ticker || 'SAYN',
        denomination: {
          ticker:    blockchain.config.nativeCurrency?.symbol || blockchain.config.ticker || 'SAYN',
          decimals:  dec,
          humanUnit: `1 ${blockchain.config.nativeCurrency?.symbol || blockchain.config.ticker || 'SAYN'}`,
          baseUnit:  `${dec.toLocaleString()} base units`,
          note:      `All on-chain amounts are in base units. Divide by ${dec} to get ${blockchain.config.nativeCurrency?.symbol || blockchain.config.ticker || 'SAYN'}.`,
        },
        lastBlockHash: lastBlock?.hash?.slice(0, 16),
        lastBlockTime: lastBlock?.timestamp,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Denomination guide — always available, no confusion about units
  router.get('/denomination', (req, res) => {
    const dec    = config.decimals || 10_000;
    const symbol = config.nativeCurrency?.symbol || config.ticker || 'SAYN';
    res.json({
      ticker:      symbol,
      decimals:    dec,
      humanUnit:   `1 ${symbol}`,
      baseUnit:    `${dec.toLocaleString()} base units`,
      examples: [
        { sayn: 1,      baseUnits: dec },
        { sayn: 0.5,    baseUnits: dec * 0.5 },
        { sayn: 100,    baseUnits: dec * 100 },
        { sayn: 1000,   baseUnits: dec * 1000 },
      ],
      description: `All balances on-chain are stored as integers in base units (sprinkles). Divide by ${dec} to convert to ${symbol}.`,
    });
  });

  // Token factory registry — lists all custom tokens deployed via token-factory or memecoin-factory
  router.get('/tokens', (req, res) => {
    try {
      const tokens = [];
      for (const contract of blockchain.state.getAllContracts()) {
        const all = contract.state?.all_tokens || [];
        const reg = contract.state?.registry || [];   // memecoin-factory
        for (const t of [...all, ...reg]) {
          tokens.push({
            ...t,
            contractAddress: contract.address,
            contractName:    contract.name,
          });
        }
      }
      res.json({ tokens, total: tokens.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // NFT collection registry — lists all NFT collections deployed via nft-factory
  router.get('/nfts', (req, res) => {
    try {
      const collections = [];
      for (const contract of blockchain.state.getAllContracts()) {
        const colls = contract.state?.all_collections || [];
        for (const c of colls) {
          collections.push({
            ...c,
            contractAddress: contract.address,
            contractName:    contract.name,
          });
        }
      }
      res.json({ collections, total: collections.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Staking pools — lists all staking pool contracts
  router.get('/staking-pools', (req, res) => {
    try {
      const pools = [];
      for (const contract of blockchain.state.getAllContracts()) {
        if (contract.state?.owner && contract.state?.totalDelegated !== undefined) {
          pools.push({
            address:        contract.address,
            name:           contract.name,
            owner:          contract.state.owner,
            totalDelegated: contract.state.totalDelegated || 0,
            totalRewards:   contract.state.totalRewards   || 0,
            operatorFee:    contract.state.operatorFee    || 10,
          });
        }
      }
      res.json({ pools, total: pools.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/tokens/:address — single token detail + holder list
  router.get('/tokens/:address', (req, res) => {
    try {
      const tokenAddress = req.params.address;
      let foundToken = null;
      let tokenContract = null;
      let isMemecoin = false;

      for (const contract of blockchain.state.getAllContracts()) {
        const all = contract.state?.all_tokens || [];
        const t = all.find(x => x.address === tokenAddress);
        if (t) {
          foundToken = t;
          tokenContract = contract;
          break;
        }

        const reg = contract.state?.registry || [];
        const m = reg.find(x => x.address === tokenAddress);
        if (m) {
          foundToken = m;
          tokenContract = contract;
          isMemecoin = true;
          break;
        }
      }

      if (!foundToken) {
        return res.status(404).json({ error: 'Token not found' });
      }

      // Collect holders
      const prefix = isMemecoin ? `bal_${tokenAddress}_` : `token_balance_${tokenAddress}_`;
      const holders = [];
      for (const [key, val] of Object.entries(tokenContract.state || {})) {
        if (key.startsWith(prefix) && val > 0) {
          const address = key.substring(prefix.length);
          holders.push({ address, balance: val });
        }
      }

      // Sort holders by balance descending
      holders.sort((a, b) => b.balance - a.balance);

      const metadata = {};
      if (isMemecoin) {
        metadata.iconUrl = tokenContract.state[`icon_${tokenAddress}`] || '';
        metadata.maxWalletPercent = tokenContract.state[`maxWallet_${tokenAddress}`] || 0;
        metadata.transferTaxPercent = tokenContract.state[`transferTax_${tokenAddress}`] || 0;
        metadata.treasury = tokenContract.state[`treasury_${tokenAddress}`] || '';
        metadata.burnOnTransfer = tokenContract.state[`burn_${tokenAddress}`] || false;
      }

      res.json({
        address: tokenAddress,
        name: foundToken.name,
        symbol: foundToken.symbol,
        creator: foundToken.creator,
        totalSupply: foundToken.supply || foundToken.totalSupply || 0,
        holderCount: holders.length,
        holders: holders.slice(0, 100), // Top 100 holders
        isMemecoin,
        metadata
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/memecoins — list all memecoins and their launch configurations
  router.get('/memecoins', (req, res) => {
    try {
      const memecoins = [];
      for (const contract of blockchain.state.getAllContracts()) {
        const reg = contract.state?.registry || [];
        for (const m of reg) {
          const tokenAddress = m.address;
          const prefix = `bal_${tokenAddress}_`;
          let holderCount = 0;
          for (const [key, val] of Object.entries(contract.state || {})) {
            if (key.startsWith(prefix) && val > 0) {
              holderCount++;
            }
          }
          memecoins.push({
            address: tokenAddress,
            name: m.name,
            symbol: m.symbol,
            totalSupply: m.supply || m.totalSupply || 0,
            creator: m.creator,
            iconUrl: contract.state[`icon_${tokenAddress}`] || '',
            maxWalletPercent: contract.state[`maxWallet_${tokenAddress}`] || 0,
            transferTaxPercent: contract.state[`transferTax_${tokenAddress}`] || 0,
            burnOnTransfer: contract.state[`burn_${tokenAddress}`] || false,
            holderCount
          });
        }
      }
      res.json({ memecoins, total: memecoins.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/nfts/:address — NFT collection detail + items list
  router.get('/nfts/:address', (req, res) => {
    try {
      const collAddr = req.params.address;
      let foundColl = null;
      let nftContract = null;

      for (const contract of blockchain.state.getAllContracts()) {
        const colls = contract.state?.all_collections || [];
        const c = colls.find(x => x.address === collAddr);
        if (c) {
          foundColl = c;
          nftContract = contract;
          break;
        }
      }

      if (!foundColl) {
        return res.status(404).json({ error: 'NFT collection not found' });
      }

      const supply = nftContract.state[`coll_supply_${collAddr}`] || 0;
      const name = nftContract.state[`coll_name_${collAddr}`];
      const symbol = nftContract.state[`coll_symbol_${collAddr}`];
      const owner = nftContract.state[`coll_owner_${collAddr}`];
      const maxSupply = nftContract.state[`coll_maxSupply_${collAddr}`];
      const baseURI = nftContract.state[`coll_baseURI_${collAddr}`];

      const items = [];
      for (let tokenId = 1; tokenId <= supply; tokenId++) {
        const itemOwner = nftContract.state[`nft_owner_${collAddr}_${tokenId}`];
        if (itemOwner) {
          items.push({
            tokenId,
            owner: itemOwner,
            tokenURI: nftContract.state[`nft_uri_${collAddr}_${tokenId}`] || ''
          });
        }
      }

      res.json({
        address: collAddr,
        name,
        symbol,
        owner,
        maxSupply,
        supply,
        baseURI,
        items
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/nfts/:address/:tokenId — single NFT item + ownership + history
  router.get('/nfts/:address/:tokenId', async (req, res) => {
    try {
      const collAddr = req.params.address;
      const tokenId = parseInt(req.params.tokenId);

      let foundColl = null;
      let nftContract = null;

      for (const contract of blockchain.state.getAllContracts()) {
        const colls = contract.state?.all_collections || [];
        const c = colls.find(x => x.address === collAddr);
        if (c) {
          foundColl = c;
          nftContract = contract;
          break;
        }
      }

      if (!foundColl) {
        return res.status(404).json({ error: 'NFT collection not found' });
      }

      const owner = nftContract.state[`nft_owner_${collAddr}_${tokenId}`];
      if (!owner) {
        return res.status(404).json({ error: 'NFT item not found' });
      }

      const tokenURI = nftContract.state[`nft_uri_${collAddr}_${tokenId}`] || '';

      // Fetch transaction history for this NFT
      const txs = [];
      const prefix = `addr:${collAddr.toLowerCase()}:`;
      try {
        for await (const [key, txId] of blockchain.db.iterator({ gte: prefix, lte: prefix + '\xff' })) {
          const parts = key.split(':');
          const blockIndex = parseInt(parts[2], 10);
          const txIndex = parseInt(parts[3], 10);
          
          const block = await blockchain.getBlock(blockIndex);
          if (block && block.transactions[txIndex]) {
            const tx = block.transactions[txIndex];
            const method = tx.data?.method;
            const args = tx.data?.args || {};
            const isTarget = (method === 'transfer' && parseInt(args.tokenId) === tokenId) ||
                             (method === 'mint' && tx.gasUsed && parseInt(args.tokenId) === tokenId);
            if (isTarget || tx.id === txId) {
              txs.push({
                ...tx.toJSON(),
                blockIndex: block.index,
                blockHash: block.hash,
                timestamp: block.timestamp
              });
            }
          }
        }
      } catch (err) {
        console.error('Error scanning NFT transactions:', err);
      }

      res.json({
        collectionAddress: collAddr,
        collectionName: nftContract.state[`coll_name_${collAddr}`],
        tokenId,
        owner,
        tokenURI,
        transactions: txs.reverse()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/address/:address/full — single call account overview
  router.get('/address/:address/full', async (req, res) => {
    try {
      const { address } = req.params;
      
      const balance = blockchain.state.getBalance(address);
      const stake = blockchain.state.getStake(address);
      const unstaking = blockchain.state.isUnstaking(address);
      const unlockBlock = blockchain.state.getUnlockBlock(address);
      const nonce = blockchain.state.getNonce(address);
      const reputation = blockchain.state.getReputation(address);

      const tokenBalances = [];
      const nftsOwned = [];

      for (const contract of blockchain.state.getAllContracts()) {
        // Token factory
        const allTokens = contract.state?.all_tokens || [];
        for (const t of allTokens) {
          const bal = contract.state[`token_balance_${t.address}_${address}`] || 0;
          if (bal > 0) {
            tokenBalances.push({
              address: t.address,
              name: t.name,
              symbol: t.symbol,
              balance: bal,
              isMemecoin: false
            });
          }
        }

        // Memecoin factory
        const registry = contract.state?.registry || [];
        for (const m of registry) {
          const bal = contract.state[`bal_${m.address}_${address}`] || 0;
          if (bal > 0) {
            tokenBalances.push({
              address: m.address,
              name: m.name,
              symbol: m.symbol,
              balance: bal,
              isMemecoin: true,
              iconUrl: contract.state[`icon_${m.address}`] || ''
            });
          }
        }

        // NFT factory
        const collections = contract.state?.all_collections || [];
        for (const c of collections) {
          const bal = contract.state[`nft_balance_${c.address}_${address}`] || 0;
          if (bal > 0) {
            const supply = contract.state[`coll_supply_${c.address}`] || 0;
            const tokenIds = [];
            for (let i = 1; i <= supply; i++) {
              if (contract.state[`nft_owner_${c.address}_${i}`] === address) {
                tokenIds.push(i);
              }
            }
            nftsOwned.push({
              address: c.address,
              name: c.name,
              symbol: c.symbol,
              balance: bal,
              tokenIds
            });
          }
        }
      }

      // Get transactions
      const transactions = [];
      const prefix = `addr:${address.toLowerCase()}:`;
      try {
        for await (const [key, txId] of blockchain.db.iterator({ gte: prefix, lte: prefix + '\xff' })) {
          const parts = key.split(':');
          const blockIndex = parseInt(parts[2], 10);
          const txIndex = parseInt(parts[3], 10);
          
          const block = await blockchain.getBlock(blockIndex);
          if (block && block.transactions[txIndex]) {
            const tx = block.transactions[txIndex];
            transactions.push({
              ...tx.toJSON(),
              blockIndex: block.index,
              blockHash: block.hash,
              timestamp: block.timestamp
            });
          }
        }
      } catch (err) {
        console.error('Error scanning address transactions:', err);
      }

      const validators = blockchain.state.getValidators();
      const validatorInfo = validators.find(v => v.address === address);

      res.json({
        address,
        balance,
        stake,
        unstaking,
        unlockBlock,
        nonce,
        reputation,
        tokenBalances,
        nftsOwned,
        transactions: transactions.reverse(),
        isValidator: !!validatorInfo,
        validatorInfo: validatorInfo || null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/layers — live status of real L2/sidechain commitments
  // Only shows chains registered via Layer2Bridge-style contracts (no fake hardcoded data).
  router.get('/layers', async (req, res) => {
    try {
      const layers = [];
      const allContracts = blockchain.contracts?.getAllContracts?.() || blockchain.state.getAllContracts();

      for (const contract of allContracts) {
        // Merge state from both engines so we see keys regardless of which wrote them
        const liveState  = contract.state || {};
        const stateEngineContract = blockchain.state.getContract(contract.address);
        const stateObj   = Object.assign({}, stateEngineContract?.state || {}, liveState);

        const registeredKeys = Object.keys(stateObj).filter(k => k.startsWith('registered_'));
        if (registeredKeys.length === 0) continue;

        for (const key of registeredKeys) {
          const chainId   = key.substring('registered_'.length);
          const name      = stateObj['name_'      + chainId] || chainId;
          const sequencer = stateObj['sequencer_' + chainId] || null;
          const height    = stateObj['height_'    + chainId] || 0;
          const type      = stateObj['type_'      + chainId] || 'L2 Rollup';
          const rpcUrl    = stateObj['rpc_'       + chainId] || null;
          const explorerUrl = stateObj['explorer_' + chainId] || null;

          // Scan contract tx history for most recent commitState call
          let lastCommitTime = null;
          const prefix = `addr:${contract.address.toLowerCase()}:`;
          try {
            for await (const [dbKey] of blockchain.db.iterator({
              gte: prefix, lte: prefix + '\xff', reverse: true, limit: 50
            })) {
              const parts = dbKey.split(':');
              const blockIndex = parseInt(parts[2], 10);
              const txIndex    = parseInt(parts[3], 10);
              if (isNaN(blockIndex) || isNaN(txIndex)) continue;
              const block = await blockchain.getBlock(blockIndex);
              if (block && block.transactions[txIndex]) {
                const tx = block.transactions[txIndex];
                if (tx.data?.method === 'commitState' && tx.data?.args?.chainId === chainId) {
                  lastCommitTime = tx.timestamp || block.timestamp;
                  break;
                }
              }
            }
          } catch (_e) {/* ignore scan errors */}

          const ageMs  = lastCommitTime ? Date.now() - lastCommitTime : Infinity;
          const status = ageMs < 60_000 ? 'active' : ageMs < 600_000 ? 'slow' : 'stale';

          layers.push({ chainId, name, sequencer, height, lastCommitTime, type, rpcUrl, explorerUrl, status, bridgeContract: contract.address });
        }
      }

      res.json({ layers, total: layers.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── MetaMask / EIP-3085  wallet_addEthereumChain compatible endpoint ────────
  // Also serves as a standard EVM network info endpoint for any wallet.
  // This is what wallets poll to get the chain logo URL + RPC + chainId.
  router.get('/wallet/chain', (req, res) => {
    const symbol  = config.nativeCurrency?.symbol || config.ticker || 'SAYN';
    const chainId = config.chainId;
    const numericId = getNumericChainId(chainId);
    const chainIdHex = '0x' + numericId.toString(16);
    const host   = req.get('host') || req.hostname || 'community.node.sayman.network';
    const proto  = (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : 'https';
    const base   = `${proto}://${host}`;

    res.json({
      chainId:            chainIdHex,
      chainName:          config.networkName || 'Sayman Public Testnet',
      nativeCurrency: {
        name:     config.nativeCurrency?.name    || symbol,
        symbol:   symbol,
        decimals: 18   // MetaMask always expects 18 for display math; we handle base-unit conversion internally
      },
      rpcUrls:            [ `${base}/rpc`, `${base}/api` ],
      blockExplorerUrls:  [ base ],
      iconUrls:           [ `${base}/assets/logo-512.png` ],
      // Standard EIP-3085 fields
      _metadata: {
        internalDecimals: config.decimals || 100_000_000,
        internalSymbol:   symbol,
        note: 'SAYMAN uses 8 internal decimals. The 18-decimal nativeCurrency is for MetaMask UI compatibility only.'
      }
    });
  });

  // Redirect /wallet-chain (legacy) to /wallet/chain
  router.get('/wallet-chain', (req, res) => res.redirect('/api/wallet/chain'));


  // GET /api/search — unified search detecting tx/address/block/token
  router.get('/search', async (req, res) => {
    try {
      const q = (req.query.q || '').trim().toLowerCase();
      if (!q) {
        return res.status(400).json({ error: 'Search query required' });
      }

      // 1. Block by index
      if (!isNaN(q)) {
        const blockIndex = parseInt(q);
        const block = await blockchain.getBlock(blockIndex);
        if (block) {
          return res.json({ type: 'block', result: block.toJSON() });
        }
      }

      // 2. Block by hash (starts with 0x and length 66, or length 64 hex)
      const blockIndexRaw = await blockchain.db.get(`hash:${q}`).catch(() => null);
      if (blockIndexRaw !== null) {
        const blockIndex = parseInt(blockIndexRaw, 10);
        const block = await blockchain.getBlock(blockIndex);
        if (block) {
          return res.json({ type: 'block', result: block.toJSON() });
        }
      }

      // 3. Transaction by ID
      const txLocationRaw = await blockchain.db.get(`tx:${q}`).catch(() => null);
      if (txLocationRaw) {
        const txLocation = typeof txLocationRaw === 'string' ? JSON.parse(txLocationRaw) : txLocationRaw;
        const block = await blockchain.getBlock(txLocation.blockIndex);
        if (block) {
          const tx = block.transactions[txLocation.txIndex];
          if (tx) {
            return res.json({
              type: 'transaction',
              result: {
                ...tx.toJSON(),
                blockIndex: block.index,
                blockHash: block.hash
              }
            });
          }
        }
      }

      // 4. Contract address check
      const contractByAddr = blockchain.contracts?.getContract(q) || blockchain.state.getContract(q);
      if (contractByAddr) {
        return res.json({ type: 'contract', result: q, name: contractByAddr.name || 'Contract' });
      }

      // 5. Address check (any address with known state)
      const balance = blockchain.state.getBalance(q);
      const stake   = blockchain.state.getStake(q);
      const nonce   = blockchain.state.getNonce(q);
      if ((q.length === 40 && /^[0-9a-f]+$/i.test(q)) || balance > 0 || stake > 0 || nonce > 0) {
        return res.json({ type: 'address', result: q });
      }

      // 5. Token/NFT Lookup by symbol/name
      for (const contract of blockchain.state.getAllContracts()) {
        const all = contract.state?.all_tokens || [];
        const reg = contract.state?.registry || [];
        const colls = contract.state?.all_collections || [];

        const t = [...all, ...reg].find(x => x.symbol?.toLowerCase() === q || x.name?.toLowerCase() === q);
        if (t) {
          return res.json({ type: 'token', result: t.address });
        }

        const c = colls.find(x => x.symbol?.toLowerCase() === q || x.name?.toLowerCase() === q);
        if (c) {
          return res.json({ type: 'nft', result: c.address });
        }
      }

      res.status(404).json({ error: 'No matching block, transaction, address, or token found.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  // ── Contributor API Endpoints ───────────────────────────────────────────────
  const contributorRegistry = new Map();

  router.post('/contributor/register', (req, res) => {
    try {
      const { nodeId, walletAddress, storageMB, tier, permanent } = req.body;
      const estimatedDailyReward = (storageMB || 0) * 0.0004;
      const registeredAt = Date.now();
      const contributor = { nodeId, walletAddress, storageMB, tier, permanent, estimatedDailyReward, registeredAt, uptimeSeconds: 0 };
      contributorRegistry.set(nodeId, contributor);
      if (p2pServer && typeof p2pServer.emit === 'function') {
        p2pServer.emit('contributor-registered', contributor);
      }
      res.json({ success: true, nodeId, registeredAt, tier, estimatedDailyReward });
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  router.get('/contributor/status/:nodeId', (req, res) => {
    try {
      const { nodeId } = req.params;
      const contributor = contributorRegistry.get(nodeId);
      if (!contributor) return res.status(404).json({ error: 'Not found' });
      const uptimeSeconds = Math.floor((Date.now() - contributor.registeredAt) / 1000);
      const estimatedPendingReward = (uptimeSeconds / 86400) * contributor.estimatedDailyReward;
      res.json({
        nodeId: contributor.nodeId,
        walletAddress: contributor.walletAddress,
        storageMB: contributor.storageMB,
        tier: contributor.tier,
        permanent: contributor.permanent,
        uptimeSeconds,
        estimatedPendingReward,
        registeredAt: contributor.registeredAt
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  router.post('/contributor/challenge/:nodeId', (req, res) => {
    try {
      const { nodeId } = req.params;
      const { challengeSeed } = req.body;
      const timestamp = Date.now();
      const seedNum = challengeSeed ? challengeSeed.toString().charCodeAt(0) : 0;
      const leafIndex = seedNum % 1000;
      const hmac = crypto.createHash('sha256').update(nodeId + leafIndex + timestamp).digest('hex');
      res.json({ leafIndex, hmac, timestamp });
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  router.post('/contributor/claim', (req, res) => {
    try {
      const { nodeId, walletAddress, estimatedReward, signature } = req.body;
      if (!contributorRegistry.has(nodeId)) {
        return res.status(400).json({ error: 'Node ID not registered' });
      }
      if (!walletAddress || (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress) && !/^[a-fA-F0-9]{40}$/.test(walletAddress))) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      let amount = Math.min((estimatedReward || 0) * 100000000, 1000000000);
      amount = Math.floor(amount);
      const tx = new Transaction('REWARD', { to: walletAddress, amount });
      tx.timestamp = Date.now();
      tx.id = tx.calculateHash ? tx.calculateHash() : uuidv4();
      blockchain.mempool.push(tx);
      res.json({ txHash: tx.id, status: 'pending', claimedAmount: amount / 100000000, note: 'Contributor reward claim submitted to mempool' });
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  router.get('/contributor/leaderboard', (req, res) => {
    try {
      const list = Array.from(contributorRegistry.values())
        .sort((a, b) => b.storageMB - a.storageMB)
        .slice(0, 20)
        .map(c => ({
          nodeId: c.nodeId,
          tier: c.tier,
          estimatedDailyReward: c.estimatedDailyReward,
          permanent: c.permanent,
          storageMB: c.storageMB
        }));
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  router.get('/contributor/stats', (req, res) => {
    try {
      const contributors = Array.from(contributorRegistry.values());
      const totalContributors = contributors.length;
      const totalStorageMB = contributors.reduce((sum, c) => sum + c.storageMB, 0);
      const avgDailyReward = totalContributors > 0 ? contributors.reduce((sum, c) => sum + c.estimatedDailyReward, 0) / totalContributors : 0;
      const totalVSU = Math.floor(totalStorageMB / 1024) * 10;
      const sorted = [...contributors].sort((a, b) => b.storageMB - a.storageMB);
      const topTier = totalContributors > 0 ? sorted[0].tier : 'none';
      res.json({ totalContributors, totalStorageMB, totalVSU, avgDailyReward, topTier });
    } catch (err) {
      res.status(500).json({ error: 'Internal error', details: err.message });
    }
  });

  app.use('/api', router);
}