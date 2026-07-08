import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import elliptic from 'elliptic';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading faucet/.env, then fallback to root .env
const loadFaucetEnv = () => {
  const parseEnv = (text) => {
    const env = {};
    const lines = text.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      env[key] = val;
    }
    return env;
  };

  const localEnv = path.join(__dirname, '.env');
  const rootEnv = path.join(__dirname, '..', '.env');
  const pathsToTry = [localEnv, rootEnv];

  for (const envPath of pathsToTry) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const env = parseEnv(content);
        for (const [key, val] of Object.entries(env)) {
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
        console.log(`Loaded faucet env from ${envPath}`);
        break;
      }
    } catch (e) {
      console.warn(`Warning loading env at ${envPath}:`, e.message);
    }
  }
};
loadFaucetEnv();

const EC = elliptic.ec;
const ec = new EC('secp256k1');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.FAUCET_PORT || 10000;
const FAUCET_AMOUNT = parseInt(process.env.FAUCET_AMOUNT) || 100_000_000_000; // 1000 SAYN (with 8 decimals)
const API_PEERS = process.env.API_PEERS
  ? process.env.API_PEERS.split(',').map(s => s.trim()).filter(Boolean)
  : (process.env.API_BASE 
      ? [process.env.API_BASE] 
      : ['https://sayman.up.railway.app/api', 'https://sayman.onrender.com/api']
    );
let activePeerIndex = 0;

async function apiFetch(path, options = {}) {
  let lastError = new Error('No working peers');
  for (let i = 0; i < API_PEERS.length; i++) {
    const idx = (activePeerIndex + i) % API_PEERS.length;
    const base = API_PEERS[idx];
    const url = `${base}${path}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (res.ok || res.status < 500) {
        activePeerIndex = idx;
        return res;
      }
      console.warn(`⚠️ Faucet backend: Peer ${base} returned status ${res.status}. Trying next...`);
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Faucet backend failed to connect to peer ${base}: ${err.message}. Trying next...`);
    }
  }
  throw lastError;
}

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
    const balanceRes = await apiFetch(`/address/${faucetWallet.address}`);
    if (!balanceRes.ok) {
      throw new Error('Failed to fetch faucet balance');
    }
    const balanceData = await balanceRes.json();
    const nonce = balanceData.nonce || 0;
    
    console.log(`📊 Current nonce: ${nonce}`);
    console.log(`💰 Faucet balance: ${balanceData.balance} SAYN`);
    
    if (balanceData.balance < FAUCET_AMOUNT) {
      return res.status(503).json({ 
        error: 'Faucet is empty. Please contact administrator.' 
      });
    }
    
    // Get gas estimate
    const gasEstRes = await apiFetch('/estimate-gas', {
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
    
    console.log(`📡 Broadcasting transaction to ${API_PEERS[activePeerIndex]}/broadcast`);
    
    // Broadcast transaction
    const broadcastRes = await apiFetch('/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });
    
    const result = await broadcastRes.json();
    
    console.log(`📨 Broadcast result:`, result);
    
    if (result.success) {
      cooldowns.set(address, now);
      console.log(`✅ Faucet claim successful: ${FAUCET_AMOUNT} SAYN → ${address}`);
      
      res.json({ 
        success: true, 
        amount: FAUCET_AMOUNT,
        txId: result.txId,
        message: `${FAUCET_AMOUNT} SAYN sent to ${address}`
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
  console.log(`🔗 API Peers: ${API_PEERS.join(', ')}`);
  console.log(`💰 Amount per claim: ${FAUCET_AMOUNT} SAYN`);
  console.log(`⏱️  Cooldown: 10 minutes\n`);
});