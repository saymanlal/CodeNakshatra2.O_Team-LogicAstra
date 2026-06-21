import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.FAUCET_PORT || 10000;
const API_BASE = process.env.API_BASE || 'https://sayman.up.railway.app/api';
const FAUCET_AMOUNT = parseInt(process.env.FAUCET_AMOUNT) || 100;

class FaucetWallet {
  constructor() {
    const seed = 'sayman-faucet-seed-2024';
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    
    const keyPair = ec.keyFromPrivate(hash);
    this.privateKey = keyPair.getPrivate('hex');
    this.publicKey = keyPair.getPublic('hex');
    
    const pubKeyHash = crypto.createHash('sha256').update(this.publicKey).digest('hex');
    this.address = pubKeyHash.substring(0, 40);
    
    console.log(`🚰 Faucet Address: ${this.address}`);
    console.log(`🔑 Faucet Public Key: ${this.publicKey}`);
  }

  async signTransaction(txData) {
    const keyPair = ec.keyFromPrivate(this.privateKey);
    
    // CRITICAL: Must match Transaction.calculateHash() exactly!
    const dataToHash = JSON.stringify({
      type: txData.type,
      timestamp: txData.timestamp,
      data: txData.data,
      gasLimit: txData.gasLimit,
      gasPrice: txData.gasPrice,
      nonce: txData.nonce
    });
    
    const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
    console.log(`🔐 Signing hash: ${hash}`);
    
    const signature = keyPair.sign(hash);
    return signature.toDER('hex');
  }
}

const faucetWallet = new FaucetWallet();
const cooldowns = new Map();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    faucet: faucetWallet.address,
    publicKey: faucetWallet.publicKey
  });
});

app.post('/faucet', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address || address.length !== 40) {
      return res.status(400).json({ error: 'Invalid address format (must be 40 characters)' });
    }
    
    const now = Date.now();
    const lastClaim = cooldowns.get(address);
    const cooldownTime = 600000; // 10 minutes
    
    if (lastClaim && (now - lastClaim) < cooldownTime) {
      const remainingTime = Math.ceil((cooldownTime - (now - lastClaim)) / 1000 / 60);
      return res.status(429).json({ 
        error: `Please wait ${remainingTime} minutes before claiming again` 
      });
    }
    
    console.log(`🔍 Fetching nonce for faucet address: ${faucetWallet.address}`);
    
    // Get current nonce from blockchain
    const balanceRes = await fetch(`${API_BASE}/address/${faucetWallet.address}`);
    if (!balanceRes.ok) {
      throw new Error('Failed to fetch faucet balance');
    }
    const balanceData = await balanceRes.json();
    const nonce = balanceData.nonce || 0;
    
    console.log(`📊 Current nonce: ${nonce}`);
    console.log(`💰 Faucet balance: ${balanceData.balance} SAYM`);
    
    if (balanceData.balance < FAUCET_AMOUNT) {
      return res.status(503).json({ 
        error: 'Faucet is empty. Please contact administrator.' 
      });
    }
    
    // Get gas estimate
    const gasEstRes = await fetch(`${API_BASE}/estimate-gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TRANSFER',
        data: { from: faucetWallet.address, to: address, amount: FAUCET_AMOUNT }
      })
    });
    
    if (!gasEstRes.ok) {
      throw new Error('Failed to estimate gas');
    }
    
    const gasData = await gasEstRes.json();
    
    console.log(`⛽ Gas estimate: ${gasData.estimatedGas}`);
    
    // Create transaction data
   const txData = {
    type: 'TRANSFER',
    data: { 
      from: faucetWallet.address, 
      to: address, 
      amount: FAUCET_AMOUNT 
    },
    timestamp: Date.now(),
    gasLimit: gasData.recommendedGasLimit || 50000,
    gasPrice: gasData.minGasPrice || 1,
    nonce: nonce
  };
  
  console.log(`📝 Transaction data:`, JSON.stringify(txData, null, 2));
  
  // CRITICAL: Calculate the exact hash that will be signed
  const hashForSigning = crypto.createHash('sha256')
    .update(JSON.stringify(txData))
    .digest('hex');
  
  console.log(`🔐 Hash being signed: ${hashForSigning}`);
  
  // Sign transaction
  const signature = await faucetWallet.signTransaction(txData);
    
    console.log(`✍️  Signature: ${signature.substring(0, 20)}...`);
    
    // Create signed transaction
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: faucetWallet.publicKey
    };
    
    console.log(`📡 Broadcasting transaction to ${API_BASE}/broadcast`);
    
    // Broadcast transaction
    const broadcastRes = await fetch(`${API_BASE}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });
    
    const result = await broadcastRes.json();
    
    console.log(`📨 Broadcast result:`, result);
    
    if (result.success) {
      cooldowns.set(address, now);
      console.log(`✅ Faucet claim successful: ${FAUCET_AMOUNT} SAYM → ${address}`);
      
      res.json({ 
        success: true, 
        amount: FAUCET_AMOUNT,
        txId: result.txId,
        message: `${FAUCET_AMOUNT} SAYM sent to ${address}`
      });
    } else {
      console.error(`❌ Broadcast failed:`, result.error);
      res.status(400).json({ 
        error: result.error || 'Transaction failed',
        details: result
      });
    }
    
  } catch (error) {
    console.error('❌ Faucet error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚰 Faucet Server Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 API Base: ${API_BASE}`);
  console.log(`💰 Amount per claim: ${FAUCET_AMOUNT} SAYM`);
  console.log(`⏱️  Cooldown: 10 minutes\n`);
});