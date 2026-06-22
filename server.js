import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Blockchain from './core/blockchain.js';
import { P2PServer } from './p2p/server.js';
import { setupRoutes } from './api/routes.js';
import { loadConfig } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

let blockchain;
let p2pServer;
let miningInterval;
let server;

// ── Persistent Node ID ───────────────────────────────────────────────────────
// Keeps the same nodeId across restarts instead of generating a new one.
// Store in DB_PATH or /tmp so it survives Render restarts (if disk is mounted).
function loadOrCreateNodeId(dbPath) {
  const idFile = path.join(dbPath, 'node-id.txt');
  try {
    if (fs.existsSync(idFile)) {
      const id = fs.readFileSync(idFile, 'utf8').trim();
      if (id.length === 32) return id;
    }
  } catch {}
  const { randomBytes } = await import('crypto').catch(() => require('crypto'));
  // Synchronous fallback
  const id = Math.random().toString(36).slice(2).padEnd(32, '0').slice(0, 32);
  try {
    fs.mkdirSync(dbPath, { recursive: true });
    fs.writeFileSync(idFile, id);
  } catch {}
  return id;
}

async function startServer() {
  try {
    // ── Parse CLI args ────────────────────────────────────────────────────────
    const args = process.argv.slice(2);
    let networkFlag = 'testnet';
    let modeFlag    = 'validator';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--network' && args[i + 1]) networkFlag = args[i + 1];
      if (args[i] === '--mode'    && args[i + 1]) modeFlag    = args[i + 1];
    }

    const config = loadConfig(networkFlag);
    const mode   = modeFlag;
    const dbPath = process.env.DB_PATH || '/tmp/sayman-data';

    // ── Startup banner ────────────────────────────────────────────────────────
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   SAYMAN BLOCKCHAIN - PHASE 7          ║');
    console.log('║   Public Network + Real P2P            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`🌐 NETWORK: ${networkFlag.toUpperCase()}`);
    console.log(`🔧 MODE: ${mode.toUpperCase()}`);
    console.log(`📛 Network Name: ${config.networkName}`);
    console.log(`🔗 Chain ID: ${config.chainId}`);
    console.log(`🌐 API Port: ${config.apiPort}`);
    console.log(`📡 P2P Port: ${config.p2pPort || 'HTTP Server Attached'}`);
    console.log(`⏱️  Block Time: ${config.blockTime}ms`);
    console.log(`💰 Block Reward: ${(config.blockReward / (config.decimals || 10000)).toFixed(4)} SAYN`);
    console.log(`🎯 Min Stake: ${(config.minStake / (config.decimals || 10000)).toFixed(4)} SAYN`);
    console.log(`⏳ Unstake Delay: ${config.unstakeDelay} blocks`);
    console.log(`🚰 Faucet: ${config.faucetEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`👥 Max Peers: ${config.maxPeers}`);
    console.log(`🔗 Bootstrap Peers: ${config.bootstrapPeers?.length > 0 ? config.bootstrapPeers.join(', ') : 'None (standalone mode)'}`);
    console.log(`📁 Database path: ${dbPath}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);

    // ── Blockchain ────────────────────────────────────────────────────────────
    blockchain = new Blockchain(config, dbPath);
    await blockchain.initialize();

    // ── P2P ──────────────────────────────────────────────────────────────────
    p2pServer = new P2PServer(blockchain, config.p2pPort);

    // ── Routes ────────────────────────────────────────────────────────────────
    setupRoutes(app, blockchain, p2pServer, config);

    // ── Health check (Render keep-alive) ─────────────────────────────────────
    app.get('/health', (_req, res) => {
      res.status(200).json({
        status:    'ok',
        timestamp: Date.now(),
        network:   blockchain.networkName,
        blocks:    blockchain.chain.length,
        peers:     p2pServer ? p2pServer.peers.size : 0,
      });
    });

    // ── HTTP server ───────────────────────────────────────────────────────────
    const PORT = config.apiPort;

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API server running on port ${PORT}`);
    });

    server.on('listening', () => {
      console.log(`📡 Node ID: ${p2pServer.nodeId}`);
      console.log(`🔗 Mode: ${mode.toUpperCase()}`);

      // ── Start P2P on the HTTP server (WSS at /p2p) ────────────────────────
      if (mode === 'validator' || mode === 'full') {
        try {
          p2pServer.listen(server);
        } catch (err) {
          console.error('❌ P2P server failed to start:', err.message);
          console.log('⚠️  Continuing in API-only mode');
        }
      }

      // ── Connect to bootstrap peers ────────────────────────────────────────
      // Small delay so our own server is fully ready before opening outbound WS
      if (config.bootstrapPeers?.length > 0) {
        console.log(`\n🔗 Connecting to ${config.bootstrapPeers.length} bootstrap peer(s)...`);
        setTimeout(() => {
          p2pServer.connectToBootstrapPeers(config.bootstrapPeers);
        }, 2000);
      }

      // ── Start mining ──────────────────────────────────────────────────────
      if (mode === 'validator') {
        console.log('\n⛏️  Starting mining...');
        startMining();
      }
    });

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT',  gracefulShutdown);

  } catch (err) {
    console.error('❌ Fatal error during startup:', err);
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
    } catch (err) {
      console.error('Mining error:', err);
    }
  }, config.blockTime);
}

function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');

  if (miningInterval)  clearInterval(miningInterval);
  if (p2pServer)       p2pServer.close();

  const finish = () => {
    if (server) {
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  if (blockchain) {
    blockchain.close().then(finish).catch(finish);
  } else {
    finish();
  }
}

startServer();