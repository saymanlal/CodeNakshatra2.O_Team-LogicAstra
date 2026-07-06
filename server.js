import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import Blockchain from './core/blockchain.js';
import { P2PServer } from './p2p/server.js';
import { setupRoutes } from './api/routes.js';
import { loadConfig } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Serve static files from frontend directory ──
app.use(express.static(path.join(__dirname, 'frontend')));

// ── ADD THIS: Serve docs.html at /docs route ──
app.get('/docs', (req, res) => {
  const docsPath = path.join(__dirname, 'frontend', 'docs.html');
  console.log(`📚 Docs requested, looking for: ${docsPath}`);
  if (fs.existsSync(docsPath)) {
    res.sendFile(docsPath);
  } else {
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Docs Not Found</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; color: #1a1a1a; }
          h1 { font-size: 24px; font-weight: 500; }
          p { color: #666; }
          a { color: #667eea; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .code { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 13px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>📚 Documentation Not Found</h1>
        <p>The documentation page could not be found. Please make sure <code>docs.html</code> exists in the <code>frontend</code> directory.</p>
        <div class="code">frontend/docs.html</div>
        <p><a href="/">← Return to Explorer</a></p>
      </body>
      </html>
    `);
  }
});

// ── Handle /docs/* routes (for any sub-pages) ──
app.get('/docs/*', (req, res) => {
  const docsPath = path.join(__dirname, 'frontend', 'docs.html');
  if (fs.existsSync(docsPath)) {
    res.sendFile(docsPath);
  } else {
    res.status(404).send('Docs page not found');
  }
});

// ── Serve assets from frontend ──
app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));

let blockchain;
let p2pServer;
let miningInterval;
let server;

function loadOrCreateNodeId(dbPath) {
  const idFile = path.join(dbPath, 'node-id.txt');
  try {
    if (fs.existsSync(idFile)) {
      const id = fs.readFileSync(idFile, 'utf8').trim();
      if (id.length === 32) return id;
    }
  } catch {}

  const id = crypto.randomBytes(16).toString('hex');
  try {
    fs.mkdirSync(dbPath, { recursive: true });
    fs.writeFileSync(idFile, id);
  } catch {}
  return id;
}

async function startServer() {
  try {
    const args = process.argv.slice(2);
    let networkFlag = 'public-testnet';
    let modeFlag = 'validator';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--network' && args[i + 1]) networkFlag = args[i + 1];
      if (args[i] === '--mode' && args[i + 1]) modeFlag = args[i + 1];
    }

    const config = loadConfig(networkFlag);
    const mode = modeFlag;
    const dbPath = process.env.DB_PATH || '/tmp/sayman-data';

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   SAYMAN BLOCKCHAIN - PHASE 7          ║');
    console.log('║   Public Network + Real P2P            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`🌐 NETWORK: ${networkFlag.toUpperCase()}`);
    console.log(`🔧 MODE: ${mode.toUpperCase()}`);
    console.log(`📛 Network Name: ${config.networkName}`);
    console.log(`🔗 Chain ID: ${config.chainId}`);
    console.log(`🌐 API Port: ${config.apiPort}`);
    console.log(`⏱️  Block Time: ${config.blockTime}ms`);
    console.log(`💰 Block Reward: ${(config.blockReward / (config.decimals || 10000)).toFixed(4)} SAYN`);
    console.log(`👥 Max Peers: ${config.maxPeers}`);
    console.log(`🔗 Bootstrap Peers: ${config.bootstrapPeers?.length > 0 ? config.bootstrapPeers.join(', ') : 'None'}`);
    console.log(`📁 Database path: ${dbPath}\n`);

    const nodeId = loadOrCreateNodeId(dbPath);
    console.log(`📡 Node ID: ${nodeId}`);

    blockchain = new Blockchain(config, dbPath);
    await blockchain.initialize();

    p2pServer = new P2PServer(blockchain, config.p2pPort);

    if (config.bootstrapPeers?.length > 0) {
      p2pServer.setBootstrapPeers(config.bootstrapPeers);
    }

    setupRoutes(app, blockchain, p2pServer, config);

    app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: Date.now(),
        network: blockchain.networkName,
        blocks: blockchain.chain.length,
        peers: p2pServer ? p2pServer.peers.size : 0,
      });
    });

    const PORT = config.apiPort;

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 API server running on port ${PORT}`);
      console.log(`📊 Explorer: http://localhost:${PORT}`);
      console.log(`📚 Docs: http://localhost:${PORT}/docs`);
      console.log(`🔗 Mode: ${mode.toUpperCase()}`);

      if (mode === 'validator' || mode === 'full') {
        try {
          p2pServer.listen(server);
        } catch (err) {
          console.error('❌ P2P server failed to start:', err.message);
          console.log('⚠️ Continuing in API-only mode');
        }
      }

      if (config.bootstrapPeers?.length > 0) {
        console.log(`\n🔗 Connecting to ${config.bootstrapPeers.length} bootstrap peer(s)...`);
        setTimeout(() => {
          p2pServer.connectToBootstrapPeers(config.bootstrapPeers);
        }, 2000);
      }

      if (mode === 'validator') {
        console.log('\n⛏️ Starting block production...');
        startMining();
      }
    });

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

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
      console.error('Mining error:', err.message);
    }
  }, config.blockTime);
}

function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');

  if (miningInterval) clearInterval(miningInterval);
  if (p2pServer) p2pServer.close();

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