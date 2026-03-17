import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Blockchain from './core/blockchain.js';
import { P2PServer } from './p2p/server.js';
import { setupRoutes } from './api/routes.js';
import { loadConfig } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

let blockchain;
let p2pServer;
let miningInterval;
let server;

async function startServer() {
  try {
    const args = process.argv.slice(2);
    let networkFlag = 'testnet';
    let modeFlag = 'validator';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--network' && args[i + 1]) {
        networkFlag = args[i + 1];
      }
      if (args[i] === '--mode' && args[i + 1]) {
        modeFlag = args[i + 1];
      }
    }

    const config = loadConfig(networkFlag);
    const mode = modeFlag;

    console.log('\n');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   SAYMAN BLOCKCHAIN - PHASE 7          ║');
    console.log('║   Public Network + Real P2P            ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('\n');
    console.log(`🌐 NETWORK: ${networkFlag.toUpperCase()}`);
    console.log(`🔧 MODE: ${mode.toUpperCase()}`);
    console.log(`📛 Network Name: ${config.networkName}`);
    console.log(`🔗 Chain ID: ${config.chainId}`);
    console.log(`🌐 API Port: ${config.apiPort}`);
    console.log(`📡 P2P Port: ${config.p2pPort || 'HTTP Server Attached'}`);
    console.log(`⏱️  Block Time: ${config.blockTime}ms`);
    console.log(`💰 Block Reward: ${config.blockReward} SAYM`);
    console.log(`🎯 Min Stake: ${config.minStake} SAYM`);
    console.log(`⏳ Unstake Delay: ${config.unstakeDelay} blocks`);
    console.log(`🚰 Faucet: ${config.faucetEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`👥 Max Peers: ${config.maxPeers}`);
    console.log(`🔗 Bootstrap Peers: ${config.bootstrapPeers.length > 0 ? config.bootstrapPeers.join(', ') : 'None (standalone mode)'}`);
    console.log('\n');

    const dbPath = process.env.DB_PATH || '/tmp/sayman-data';
    console.log(`📁 Database path: ${dbPath}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    blockchain = new Blockchain(config, dbPath);
    await blockchain.initialize();

    p2pServer = new P2PServer(blockchain, config.p2pPort);

    setupRoutes(app, blockchain, p2pServer, blockchain.config);

    // CRITICAL: Health check for Render deployment
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: Date.now(),
        network: blockchain.networkName,
        blocks: blockchain.chain.length
      });
    });

    const PORT = config.apiPort;
    
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API server running on port ${PORT}`);
    });

    // Wait for server to be ready before starting P2P
    server.on('listening', () => {
      console.log(`📡 Node ID: ${p2pServer.nodeId}`);
      console.log(`🔗 Mode: ${mode.toUpperCase()}`);
      
      // Start P2P after HTTP server is listening
      if (mode === 'validator' || mode === 'full') {
        try {
          p2pServer.listen(server);
        } catch (error) {
          console.error('❌ P2P server failed to start:', error.message);
          console.log('⚠️  Continuing in API-only mode');
        }
      }

      if (config.bootstrapPeers.length > 0) {
        console.log('\n🔗 Connecting to bootstrap peers...');
        config.bootstrapPeers.forEach(peer => {
          p2pServer.connectToPeer(peer);
        });
      }

      if (mode === 'validator') {
        console.log('\n⛏️  Starting mining...');
        startMining();
      }
    });

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('❌ Fatal error during startup:', error);
    process.exit(1);
  }
}

function startMining() {
  const config = blockchain.config;
  
  miningInterval = setInterval(async () => {
    try {
      const block = await blockchain.createBlock();
      if (block && p2pServer) {
        p2pServer.broadcastBlock(block);
      }
    } catch (error) {
      console.error('Mining error:', error);
    }
  }, config.blockTime);
}

function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (miningInterval) {
    clearInterval(miningInterval);
  }
  
  if (p2pServer) {
    p2pServer.close();
  }
  
  if (blockchain) {
    blockchain.close().then(() => {
      if (server) {
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  } else {
    if (server) {
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

startServer();

/* ok now in sayman.onrender.com after deployement now no errors of p2p or others in console but still problems in the frontend ok now in dashboard it's reversed but it should update like the last block I can see there in top is 9 and now even the new blocks are getting created still in top it stuck 9 in the list and in explorer section at once it should only show last 20 block but should also have slider to go to next 20 and previous 20 and still the data and timing for blocks are showing invalid date and the styling have some problem because in navbar going from dashboard to explorer and so on the section changes but the black color show the current nav link isn't shifting and in validator section it is not showing any validator as we still have our first validator and in frontend at the bottom most footer write Copyright 2026 and all necessary stuff to be */