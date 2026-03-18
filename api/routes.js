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
    res.json({
      network: config.networkName,
      chainId: config.chainId,
      faucetEnabled: config.faucetEnabled,
      blockTime: config.blockTime,
      blockReward: config.blockReward,
      minStake: config.minStake,
      gasLimits: stats.gasLimits,
      gasCosts: stats.gasCosts
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

  // Single block
  router.get('/blocks/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const block = blockchain.chain[index];
    
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json(normalizeBlockForApi(block));
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
          timestamp: block.timestamp
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
    
    // Get transaction history
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
    
    res.json({
      address,
      balance,
      stake,
      unstaking,
      unlockBlock,
      nonce,
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

      // Verify address matches public key
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

      // CRITICAL: Register public key BEFORE validation
      blockchain.state.setPublicKey(data.from, publicKey);

      // Now validate signature
      if (!tx.isValid(blockchain.state.publicKeys)) {
        console.error(`❌ Invalid signature for tx from ${data.from}`);
        console.error(`   Public key: ${publicKey.substring(0, 20)}...`);
        console.error(`   Signature: ${signature.substring(0, 20)}...`);
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

      const faucetBalance = blockchain.state.getBalance('faucet');
      if (faucetBalance < config.faucetAmount) {
        return res.status(503).json({ 
          error: 'Faucet is empty',
          message: 'Please try again later'
        });
      }

      const tx = Transaction.createTransfer('faucet', address, config.faucetAmount);
      blockchain.mempool.push(tx);

      console.log(`🚰 Faucet: ${config.faucetAmount} SAYM → ${address.substring(0, 8)}...`);

      res.json({
        success: true,
        amount: config.faucetAmount,
        message: `${config.faucetAmount} SAYM credited (pending in mempool)`
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

  // ✅ MISSING ENDPOINT - ADD THIS
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
        timestamp: Date.now()
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

  app.use('/api', router);
}
