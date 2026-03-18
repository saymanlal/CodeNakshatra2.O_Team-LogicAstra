import crypto from 'crypto';
import elliptic from 'elliptic';
import Block from './block.js';
import Transaction from './transaction.js';
import StateEngine from './state.js';
import ProofOfStake from './pos.js';
import ContractEngine from './contracts.js';
import GasCalculator from './gas.js';
import { Level } from 'level';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

class Blockchain {
  constructor(config, dbPath = null) {
    this.config = config;
    this.chainId = config.chainId;
    this.networkName = config.networkName;
    this.chain = [];
    this.mempool = [];
    this.state = new StateEngine();
    this.pos = new ProofOfStake(this.state, config);
    this.gas = new GasCalculator(config);
    this.contracts = new ContractEngine(this.state, this.gas);
    
    const finalDbPath = dbPath || `./data/${config.chainId}`;
    this.db = new Level(finalDbPath, { valueEncoding: 'json' });
    
    this.isProducing = false;
    this.mempoolLimit = 1000;
    this.addressTxCount = new Map();
    this.lastCleanup = Date.now();
  }

  async initialize() {
    console.log('🔄 Initializing blockchain...');
    
    try {
      const savedChain = await this.db.get('chain');
      
      if (savedChain && savedChain.length > 0) {
        console.log(`📚 Loading existing blockchain...`);
        
        for (const blockData of savedChain) {
          const block = await Block.fromJSON(blockData);
          this.chain.push(block);
        }
        
        console.log(`✅ Loaded ${savedChain.length} blocks from database`);
        console.log('🔄 Rebuilding state from blockchain...');
        this.replayState();
        console.log('✅ State rebuilt successfully');
      } else {
        this.createGenesisBlock();
      }
      
      console.log('✅ Blockchain initialization complete');
      console.log(`📊 Current height: ${this.chain.length}`);
      
    } catch (error) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        this.createGenesisBlock();
      } else {
        throw error;
      }
    }
  }

  createGenesisBlock() {
    console.log('🌱 Creating genesis block...');
    
    const genesisConfig = this.config.genesis;
    const allocations = genesisConfig.allocations || {};
    
    const transactions = [];
    
    const faucetSeed = 'sayman-faucet-seed-2024';
    const faucetHash = crypto.createHash('sha256').update(faucetSeed).digest('hex');
    const faucetKeyPair = ec.keyFromPrivate(faucetHash);
    const faucetPubKey = faucetKeyPair.getPublic('hex');
    const faucetAddress = crypto.createHash('sha256').update(faucetPubKey).digest('hex').substring(0, 40);
    
    console.log(`🚰 Genesis Faucet Address: ${faucetAddress}`);
  
    // CRITICAL: Register faucet public key in state
    this.state.setPublicKey(faucetAddress, faucetPubKey);
    console.log(`✓ Faucet public key registered`);
    
    Object.entries(allocations).forEach(([key, amount]) => {
      let address;
      
      if (key === 'faucet1') {
        address = faucetAddress;
        this.state.addBalance(address, amount);
        console.log(`✓ Faucet allocated: ${address} (${amount} SAYM)`);
      } else if (key === 'validator1') {
        const validatorSeed = 'genesis-validator-' + this.chainId;
        const validatorHash = crypto.createHash('sha256').update(validatorSeed).digest('hex');
        const validatorKeyPair = ec.keyFromPrivate(validatorHash);
        const validatorPubKey = validatorKeyPair.getPublic('hex');
        address = crypto.createHash('sha256').update(validatorPubKey).digest('hex').substring(0, 40);
        
        const stakeAmount = amount;
        const totalAmount = amount * 2;
        
        this.state.addBalance(address, totalAmount);
        this.state.stake(address, stakeAmount);
        this.pos.addValidator(address, stakeAmount);
        
        console.log(`✓ Validator added: ${address.substring(0, 8)}... (Stake: ${stakeAmount})`);
        console.log(`✓ Genesis validator created: ${address.substring(0, 8)}... with ${stakeAmount} SAYM stake`);
      } else {
        const seed = `genesis-${key}-${this.chainId}`;
        const hash = crypto.createHash('sha256').update(seed).digest('hex');
        const keyPair = ec.keyFromPrivate(hash);
        const pubKey = keyPair.getPublic('hex');
        address = crypto.createHash('sha256').update(pubKey).digest('hex').substring(0, 40);
        
        this.state.addBalance(address, amount);
        console.log(`✓ Genesis allocation: ${key} → ${address.substring(0, 8)}... (${amount} SAYM)`);
      }
    });
    
    const genesisBlock = new Block(
      0,
      genesisConfig.timestamp,
      transactions,
      '0',
      'genesis-validator',
      0
    );
    
    genesisBlock.hash = genesisBlock.calculateHash();
    
    this.chain.push(genesisBlock);
    this.saveBlock(genesisBlock);
    
    console.log('✅ Genesis block created');
    
    return genesisBlock;
  }

  saveBlock(block) {
    this.saveChain();
  }

  async saveChain() {
    const chainData = this.chain.map(block => block.toJSON());
    await this.db.put('chain', chainData);
  }

  replayState() {
    this.state.clear();
    for (const block of this.chain) {
      this.applyBlock(block);
    }
  }

  applyBlock(block) {
    for (const tx of block.transactions) {
      this.applyTransaction(tx, block.index);
    }
  }

  applyTransaction(tx, blockIndex) {
    try {
      if (tx.type !== 'GENESIS' && tx.type !== 'REWARD' && tx.type !== 'REWARD_FEE' && tx.type !== 'SLASH') {
        this.state.incrementNonce(tx.data.from);
      }

      switch (tx.type) {
        case 'GENESIS':
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case 'TRANSFER':
          const transferGasCost = tx.gasUsed * tx.gasPrice;
          this.state.subtractBalance(tx.data.from, tx.data.amount + transferGasCost);
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case 'STAKE':
          const stakeGasCost = tx.gasUsed * tx.gasPrice;
          this.state.subtractBalance(tx.data.from, tx.data.amount + stakeGasCost);
          this.state.addStake(tx.data.from, tx.data.amount);
          this.state.resetMissedBlocks(tx.data.from);
          break;

        case 'UNSTAKE':
          const unstakeGasCost = tx.gasUsed * tx.gasPrice;
          this.state.subtractBalance(tx.data.from, unstakeGasCost);
          const stakeAmount = this.state.getStake(tx.data.from);
          const unlockBlock = blockIndex + this.config.unstakeDelay;
          this.state.setStake(tx.data.from, 0);
          this.state.initiateUnstake(tx.data.from, unlockBlock);
          break;

        case 'REWARD':
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case 'REWARD_FEE':
          this.state.addBalance(tx.data.to, tx.data.amount);
          break;

        case 'CONTRACT_DEPLOY':
          const deployGasCost = tx.gasUsed * tx.gasPrice;
          this.state.subtractBalance(tx.data.from, deployGasCost);
          break;

        case 'CONTRACT_CALL':
          const callGasCost = tx.gasUsed * tx.gasPrice;
          this.state.subtractBalance(tx.data.from, callGasCost);
          break;

        case 'SLASH':
          this.state.subtractStake(tx.data.validator, tx.data.amount);
          this.state.resetMissedBlocks(tx.data.validator);
          break;
      }
    } catch (error) {
      console.error(`Error applying transaction ${tx.id}: ${error.message}`);
    }
  }

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

    const expectedNonce = this.state.getNonce(tx.data.from);
    if (tx.nonce !== expectedNonce) {
      throw new Error(`Invalid nonce. Expected: ${expectedNonce}, Got: ${tx.nonce}`);
    }

    this.gas.validateGasParams(tx);

    const minGas = this.gas.calculateTransactionGas(tx);
    if (tx.gasLimit < minGas) {
      throw new Error(`Gas limit too low. Minimum: ${minGas}`);
    }

    const maxGasCost = tx.gasLimit * tx.gasPrice;
    
    switch (tx.type) {
      case 'TRANSFER':
        if (this.state.getBalance(tx.data.from) < (tx.data.amount + maxGasCost)) {
          throw new Error('Insufficient balance for transfer + gas');
        }
        break;

      case 'STAKE':
        if (this.state.getBalance(tx.data.from) < (tx.data.amount + maxGasCost)) {
          throw new Error('Insufficient balance for staking + gas');
        }
        if (tx.data.amount < this.config.minStake) {
          throw new Error(`Minimum stake is ${this.config.minStake} SAYM`);
        }
        break;

      case 'UNSTAKE':
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

      case 'CONTRACT_DEPLOY':
      case 'CONTRACT_CALL':
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

  async createBlock() {
    if (this.isProducing) {
      return null;
    }

    this.isProducing = true;

    try {
      const lastBlock = this.getLastBlock();
      const validator = this.pos.selectValidator(lastBlock.hash);

      if (!validator) {
        this.isProducing = false;
        return null;
      }

      const transactions = [];
      let blockGasUsed = 0;

      for (const tx of this.mempool) {
        try {
          const gasTracker = this.gas.trackExecution();
          
          if (tx.type === 'CONTRACT_DEPLOY') {
            this.contracts.deploy(tx.data.from, tx.data.code, tx.timestamp, gasTracker);
          } else if (tx.type === 'CONTRACT_CALL') {
            this.contracts.call(
              tx.data.from,
              tx.data.contractAddress,
              tx.data.method,
              tx.data.args,
              gasTracker,
              tx.gasLimit
            );
          } else {
            const minGas = this.gas.calculateTransactionGas(tx);
            gasTracker.gasUsed = minGas;
          }

          if (blockGasUsed + gasTracker.gasUsed > this.gas.limits.maxGasPerBlock) {
            continue;
          }

          tx.gasUsed = gasTracker.gasUsed;
          transactions.push(tx);
          blockGasUsed += gasTracker.gasUsed;

          const gasFee = tx.gasUsed * tx.gasPrice;
          if (gasFee > 0) {
            const feeReward = Transaction.createRewardFee(validator, gasFee);
            transactions.push(feeReward);
          }

        } catch (error) {
          console.log(`⚠ Transaction ${tx.id.substring(0, 8)} failed: ${error.message}`);
        }
      }

      this.mempool = [];

      const rewardTx = Transaction.createReward(validator, this.config.blockReward);
      transactions.push(rewardTx);

      const slashEvents = this.pos.checkSlashing(this.config);
      for (const slash of slashEvents) {
        const slashTx = Transaction.createSlash(
          slash.validator,
          slash.amount,
          slash.reason
        );
        transactions.push(slashTx);
      }

      const block = new Block(
        this.chain.length,
        Date.now(),
        transactions,
        lastBlock.hash,
        validator,
        0
      );
      
      block.chainId = this.chainId;
      block.gasUsed = blockGasUsed;

      this.applyBlock(block);
      this.chain.push(block);
      this.state.resetMissedBlocks(validator);
      await this.saveChain();

      console.log(`✅ Block #${block.index} | Validator: ${validator.substring(0, 8)}... | Txs: ${block.transactions.length} | Gas: ${blockGasUsed}`);

      this.isProducing = false;
      return block;

    } catch (error) {
      console.error('Error creating block:', error);
      this.isProducing = false;
      return null;
    }
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  getStats() {
    const validatorCount = this.pos && this.pos.validators ? this.pos.validators.size : 0;
    const contractCount = this.contracts && this.contracts.contracts instanceof Map ? this.contracts.contracts.size : 0;
    let totalStake = 0;
    if (this.pos && this.pos.validators) {
      totalStake = Array.from(this.pos.validators.values()).reduce((sum, v) => sum + v.stake, 0);
    }
    
    return {
      network: this.networkName,
      chainId: this.chainId,
      blocks: this.chain.length,
      mempool: this.mempool.length,
      validators: validatorCount,
      totalStake,
      contracts: contractCount
    };
  }

  async close() {
    await this.db.close();
  }
}

export default Blockchain;
