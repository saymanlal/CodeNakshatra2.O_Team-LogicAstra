import express from 'express';
import Transaction from '../core/transaction.js';
import Wallet from '../wallet/wallet.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export function setupRoutes(app, blockchain, p2pServer, config) {
  const router = express.Router();

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

  // Network info
  router.get('/network', (req, res) => {
    const stats = blockchain.getStats();
    const dec   = config.decimals || 100_000_000;
    res.json({
      network:       config.networkName,
      chainId:       config.chainId,
      layer:         config.layer || 1,
      ticker:        config.ticker || 'SAYN',
      faucetEnabled: config.faucetEnabled,
      blockTime:     config.blockTime,
      blockReward:   config.blockReward,
      minStake:      config.minStake,
      gasLimits:     stats.gasLimits,
      gasCosts:      stats.gasCosts,
      stateRoot:     stats.stateRoot,
      decimals:      dec,
      // Explicit denomination guide — eliminates all confusion in the explorer
      denomination: {
        ticker:        config.ticker || 'SAYN',
        decimals:      dec,
        humanUnit:     '1 SAYN',
        baseUnit:      `${dec} base units`,
        description:   `All balances on-chain are stored as integers in base units. Divide by ${dec} to get SAYN.`
      }
    });
  });

  // Stats
  router.get('/stats', (req, res) => {
    res.json(blockchain.getStats());
  });

  // Blocks with pagination
  router.get('/blocks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const allBlocks = blockchain.chain
      .map(normalizeBlockForApi)
      .sort((a, b) => b.index - a.index);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedBlocks = allBlocks.slice(start, end);
    
    res.json({
      blocks: paginatedBlocks,
      total: allBlocks.length,
      page,
      limit,
      totalPages: Math.ceil(allBlocks.length / limit)
    });
  });

  // Single block by index (legacy)
  router.get('/blocks/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const block = blockchain.chain[index];
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json(normalizeBlockForApi(block));
  });

  // ─── FIX: Get block by index (frontend uses this) ──────────────────────────
  router.get('/block/:index', (req, res) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index) || index < 0) {
        return res.status(400).json({ error: 'Invalid block index' });
      }

      if (index >= blockchain.chain.length) {
        return res.status(404).json({ error: 'Block not found' });
      }

      const block = blockchain.chain[index];
      res.json(normalizeBlockForApi(block));
    } catch (err) {
      console.error('Error fetching block:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FIX: Get block by hash ──────────────────────────────────────────────────
  router.get('/block/hash/:hash', (req, res) => {
    try {
      const hash = req.params.hash;
      if (!hash || hash.length < 8) {
        return res.status(400).json({ error: 'Invalid hash' });
      }

      const chain = blockchain.chain;
      const block = chain.find(b => {
        const blockHash = b.hash || '';
        return blockHash === hash || blockHash.startsWith(hash);
      });

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
  router.get('/light/block/:height', (req, res) => {
    try {
      const height = parseInt(req.params.height);
      const block = blockchain.chain[height];
      
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
  router.get('/transactions/:id', (req, res) => {
    const txId = req.params.id;
    
    for (const block of blockchain.chain) {
      const tx = block.transactions.find(t => t.id === txId);
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
    
    res.status(404).json({ error: 'Transaction not found' });
  });

  // Address info with nonce
  router.get('/address/:address', (req, res) => {
    const { address } = req.params;
    
    const balance = blockchain.state.getBalance(address);
    const stake = blockchain.state.getStake(address);
    const unstaking = blockchain.state.isUnstaking(address);
    const unlockBlock = blockchain.state.getUnlockBlock(address);
    const nonce = blockchain.state.getNonce(address);
    
    const transactions = [];
    for (const block of blockchain.chain) {
      for (const tx of block.transactions) {
        if (tx.data.from === address || tx.data.to === address || 
            tx.data.validator === address || tx.data.contractAddress === address) {
          transactions.push({
            ...tx.toJSON(),
            blockIndex: block.index,
            blockHash: block.hash,
            timestamp: block.timestamp
          });
        }
      }
    }
    
    const validators = blockchain.state.getValidators();
    const validatorInfo = validators.find(v => v.address === address);
    
    const reputation = blockchain.state.getReputation(address);
    res.json({
      address,
      balance,
      stake,
      unstaking,
      unlockBlock,
      nonce,
      reputation,
      transactions: transactions.reverse(),
      isValidator: !!validatorInfo,
      validatorInfo: validatorInfo || null
    });
  });

  // Balance (legacy)
  router.get('/balance/:address', (req, res) => {
    const { address } = req.params;
    const balance = blockchain.state.getBalance(address);
    const stake = blockchain.state.getStake(address);
    const unstaking = blockchain.state.isUnstaking(address);
    const unlockBlock = blockchain.state.getUnlockBlock(address);
    const nonce = blockchain.state.getNonce(address);

    res.json({
      address,
      balance,
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
    const contract = blockchain.state.getContract(req.params.address);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json(contract);
  });

  // Broadcast signed transaction (with gas)
  router.post('/broadcast', (req, res) => {
    try {
      const { type, data, timestamp, signature, publicKey, gasLimit, gasPrice, nonce } = req.body;

      if (!type || !data || !timestamp || !signature || !publicKey) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      if (gasLimit === undefined || gasPrice === undefined || nonce === undefined) {
        return res.status(400).json({
          error: 'Missing gas parameters or nonce'
        });
      }

      const tx = new Transaction(type, data);
      tx.timestamp = timestamp;
      tx.signature = signature;
      tx.id = uuidv4();
      tx.gasLimit = gasLimit;
      tx.gasPrice = gasPrice;
      tx.nonce = nonce;
      tx.publicKey = publicKey;

      const derivedAddress = crypto
        .createHash('sha256')
        .update(publicKey)
        .digest('hex')
        .substring(0, 40);

      if (derivedAddress !== data.from) {
        return res.status(400).json({
          error: 'Address does not match public key'
        });
      }

      blockchain.state.setPublicKey(data.from, publicKey);

      if (!tx.isValid(blockchain.state.publicKeys)) {
        console.error(`❌ Invalid signature for tx from ${data.from}`);
        return res.status(400).json({
          error: 'Invalid signature'
        });
      }

      blockchain.addTransaction(tx, publicKey);

      if (p2pServer) {
        p2pServer.broadcastTransaction(tx);
      }

      console.log(`📨 Transaction received: ${type} from ${data.from.substring(0, 8)}... (gas: ${gasLimit} @ ${gasPrice})`);

      const response = {
        success: true,
        txId: tx.id,
        message: 'Transaction accepted and added to mempool',
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        maxGasCost: tx.gasLimit * tx.gasPrice
      };

      if (type === 'UNSTAKE') {
        response.unlockBlock = blockchain.chain.length + config.unstakeDelay;
      }

      res.json(response);

    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(400).json({ error: error.message });
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
  router.post('/faucet', (req, res) => {
    try {
      if (!config.faucetEnabled) {
        return res.status(403).json({ 
          error: 'Faucet is disabled on mainnet',
          message: 'Faucet is only available on testnet'
        });
      }

      const { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Address required' });
      }

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

      console.log(`🚰 Faucet: ${config.faucetAmount} SAYN → ${address.substring(0, 8)}...`);

      res.json({
        success: true,
        amount: config.faucetAmount,
        message: `${config.faucetAmount} SAYN credited (pending in mempool)`
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
  router.get('/search/:query', (req, res) => {
    const query = req.params.query.toLowerCase();
    
    if (!isNaN(query)) {
      const blockIndex = parseInt(query);
      if (blockchain.chain[blockIndex]) {
        return res.json({
          type: 'block',
          result: blockchain.chain[blockIndex].toJSON()
        });
      }
    }
    
    const blockByHash = blockchain.chain.find(b => b.hash.toLowerCase() === query);
    if (blockByHash) {
      return res.json({
        type: 'block',
        result: blockByHash.toJSON()
      });
    }
    
    for (const block of blockchain.chain) {
      const tx = block.transactions.find(t => t.id.toLowerCase() === query);
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
    
    const balance = blockchain.state.getBalance(query);
    if (balance > 0 || blockchain.state.getStake(query) > 0) {
      return res.json({
        type: 'address',
        result: query
      });
    }
    
    res.status(404).json({ error: 'Not found' });
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
      
      let avgBlockTime = config.blockTime;
      if (blockchain.chain.length > 10) {
        const recent = blockchain.chain.slice(-10);
        const timeDiff = recent[recent.length - 1].timestamp - recent[0].timestamp;
        avgBlockTime = timeDiff / 9;
      }
      
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
        ticker: blockchain.config.ticker || 'SAYN',
        denomination: {
          ticker:    blockchain.config.ticker || 'SAYN',
          decimals:  dec,
          humanUnit: '1 SAYN',
          baseUnit:  `${dec.toLocaleString()} base units`,
          note:      `All on-chain amounts are in base units. Divide by ${dec} to get SAYN.`,
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
    const dec = config.decimals || 10_000;
    res.json({
      ticker:      config.ticker    || 'SAYN',
      decimals:    dec,
      humanUnit:   '1 SAYN',
      baseUnit:    `${dec.toLocaleString()} base units`,
      examples: [
        { sayn: 1,      baseUnits: dec },
        { sayn: 0.5,    baseUnits: dec * 0.5 },
        { sayn: 100,    baseUnits: dec * 100 },
        { sayn: 1000,   baseUnits: dec * 1000 },
      ],
      description: `All balances on-chain are stored as integers in base units (sprinkles). Divide by ${dec} to convert to SAYN.`,
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

  app.use('/api', router);
}