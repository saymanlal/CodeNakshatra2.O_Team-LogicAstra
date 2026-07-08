import express from 'express';
import { readFileSync } from 'fs';
import Blockchain from './core/blockchain.js';
import Database from './storage/db.js';
import P2PServer from './core/p2p.js';
import createRouter from './routes/api.js';
import Wallet from './core/wallet.js';

const network = process.env.NODE_ENV || 'testnet';
const port = process.env.PORT || null;
const p2pPort = process.env.P2P_PORT || null;
const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const config = JSON.parse(
  readFileSync(`./config/${network}.json`, 'utf-8')
);

// Override config with environment variables
if (port) config.port = parseInt(port);
if (p2pPort) config.p2pPort = parseInt(p2pPort);
if (peers.length > 0) config.peers = peers;

console.log('\n╔════════════════════════════════════════╗');
console.log('║   SAYMAN BLOCKCHAIN - PHASE 2          ║');
console.log('║   Advanced Proof-of-Stake              ║');
console.log('╚════════════════════════════════════════╝\n');
console.log(`Network: ${config.network.toUpperCase()}`);
console.log(`API Port: ${config.port}`);
console.log(`P2P Port: ${config.p2pPort}`);
console.log(`Block Time: ${config.blockTime}ms`);
console.log(`Block Reward: ${config.blockReward} SAYN`);
console.log(`Min Stake: ${config.minimumStake} SAYN`);
console.log(`Unstake Delay: ${config.unstakeDelay} blocks`);
console.log(`Slash Percentage: ${config.slashPercentage * 100}%`);
console.log(`Faucet: ${config.faucetEnabled ? 'Enabled' : 'Disabled'}`);
console.log(`Auto-mine: ${config.autoMine !== false ? 'Enabled' : 'Disabled'}`);
console.log(`Peers: ${config.peers.length > 0 ? config.peers.join(', ') : 'None'}\n`);

const db = new Database(config.network + '_' + config.p2pPort);
const blockchain = new Blockchain(config, db);

await blockchain.initialize();

// Initialize P2P
const p2pServer = new P2PServer(blockchain, config.p2pPort, config.peers);
p2pServer.listen();

const app = express();
app.use(express.json());
app.use('/api', createRouter(blockchain, p2pServer));

app.get('/', (req, res) => {
  res.json({
    name: 'Sayman Blockchain',
    coin: 'SAYN',
    network: config.network,
    version: '2.0.0',
    phase: 2,
    ...blockchain.getStats(),
    peers: p2pServer.sockets.length
  });
});

// Auto-mining
if (config.autoMine !== false) {
  setInterval(async () => {
    const block = await blockchain.createBlock();
    if (block) {
      console.log(`✓ Block #${block.index} created by ${block.validator.substring(0, 8)}...`);
      console.log(`  Transactions: ${block.transactions.length}`);
      console.log(`  Reward: ${config.blockReward} SAYN`);
      console.log(`  Hash: ${block.hash.substring(0, 16)}...`);
      
      // Broadcast to peers
      p2pServer.broadcastBlock(block);
    }
  }, config.blockTime);
  console.log('✓ Auto-mining enabled');
} else {
  console.log('⚠ Auto-mining disabled - use POST /api/mine to create blocks');
}

app.listen(config.port, () => {
  console.log(`✓ API server running on http://localhost:${config.port}`);
  console.log(`✓ Blockchain initialized with ${blockchain.chain.length} blocks`);
  
  const genesisValidator = blockchain.stakeManager.getValidator(config.genesisValidator);
  if (genesisValidator) {
    console.log(`✓ Genesis validator has ${genesisValidator.stake} SAYN staked\n`);
  }
  
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${config.port}/`);
  console.log(`  GET  http://localhost:${config.port}/api/stats`);
  console.log(`  GET  http://localhost:${config.port}/api/chain`);
  console.log(`  GET  http://localhost:${config.port}/api/balance/:address`);
  console.log(`  GET  http://localhost:${config.port}/api/validator/:address`);
  console.log(`  GET  http://localhost:${config.port}/api/validators`);
  console.log(`  GET  http://localhost:${config.port}/api/validators/all`);
  console.log(`  POST http://localhost:${config.port}/api/transaction`);
  console.log(`  POST http://localhost:${config.port}/api/stake`);
  console.log(`  POST http://localhost:${config.port}/api/unstake`);
  console.log(`  POST http://localhost:${config.port}/api/withdraw`);
  console.log(`  GET  http://localhost:${config.port}/api/mempool`);
  console.log(`  POST http://localhost:${config.port}/api/mine`);
  if (config.faucetEnabled) {
    console.log(`  POST http://localhost:${config.port}/api/faucet`);
  }
  console.log('');
});

process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await db.close();
  process.exit(0);
});

export { blockchain, Wallet };