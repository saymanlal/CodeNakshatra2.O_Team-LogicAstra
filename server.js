import './core/env.js';
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

app.use(express.static(path.join(__dirname, 'frontend')));

// Serve the built Android APK from the repo-root apk/ folder.
// Without this, /apk/base.apk 404s because only frontend/ is mounted above.
app.use('/apk', express.static(path.join(__dirname, 'apk')));

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

app.get('/docs/*', (req, res) => {
  const docsPath = path.join(__dirname, 'frontend', 'docs.html');
  if (fs.existsSync(docsPath)) {
    res.sendFile(docsPath);
  } else {
    res.status(404).send('Docs page not found');
  }
});

app.use('/assets', express.static(path.join(__dirname, 'frontend', 'assets')));

let blockchain;
let p2pServer;
let miningInterval;
let pingerInterval;
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
    let bootstrapFlag = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--network' && args[i + 1]) networkFlag = args[i + 1];
      if (args[i] === '--mode' && args[i + 1]) modeFlag = args[i + 1];
      if (args[i] === '--bootstrap' && args[i + 1]) bootstrapFlag = args[i + 1];
    }

    const config = loadConfig(networkFlag);
    const mode = modeFlag;
    const dbPath = process.env.DB_PATH || `./data/node-${config.apiPort}`;

    if (bootstrapFlag) {
      const parsedPeers = bootstrapFlag.split(',').map(s => s.trim()).filter(Boolean);
      config.bootstrapPeers = parsedPeers.map(peer => {
        let url = peer;
        if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
          url = 'ws://' + url;
        }
        if (!url.endsWith('/p2p')) {
          url = url + '/p2p';
        }
        return url;
      });
    }

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
    const blockRewardDec = config.decimals === 100_000_000 ? 8 : 4;
    console.log(`💰 Block Reward: ${(config.blockReward / (config.decimals || 10000)).toFixed(blockRewardDec)} SAYN`);
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

      if (mode === 'validator' || mode === 'full' || mode === 'fullnode' || mode === 'observer') {
        try {
          p2pServer.listen(config.p2pPort ? null : server);
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
        startBootstrapPinger(config.bootstrapPeers);
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
      if (p2pServer && p2pServer.isSyncing) {
        // Skip block production while syncing from peers to prevent forks
        return;
      }
      const block = await blockchain.createBlock();
      if (block && p2pServer) {
        p2pServer.broadcastBlock(block);
      }
    } catch (err) {
      console.error('Mining error:', err.message);
    }
  }, config.blockTime);
}

function startBootstrapPinger(peers) {
  const urlsToPing = new Set();
  
  if (Array.isArray(peers)) {
    peers.forEach(peerUrl => {
      if (!peerUrl) return;
      let httpUrl = peerUrl
        .replace(/^wss:\/\//i, 'https://')
        .replace(/^ws:\/\//i, 'http://')
        .replace(/\/p2p\/?$/i, '');
      urlsToPing.add(`${httpUrl}/health`);
    });
  }

  // Also self-ping if running on Render
  if (process.env.RENDER_EXTERNAL_URL) {
    let selfUrl = process.env.RENDER_EXTERNAL_URL;
    let httpUrl = selfUrl.endsWith('/') ? selfUrl.slice(0, -1) : selfUrl;
    urlsToPing.add(`${httpUrl}/health`);
  }

  if (urlsToPing.size === 0) return;

  const ping = () => {
    urlsToPing.forEach(async (healthUrl) => {
      try {
        console.log(`[Keep-Alive] Pinged endpoint: ${healthUrl}`);
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(10000) });
        console.log(`[Keep-Alive] Response status for ${healthUrl}: ${res.status}`);
      } catch (err) {
        console.error(`[Keep-Alive] Failed to ping ${healthUrl}:`, err.message);
      }
    });
  };

  ping();
  pingerInterval = setInterval(ping, 300_000); // 5 minutes
}

function gracefulShutdown() {
  console.log('\n🛑 Shutting down gracefully...');

  if (miningInterval) clearInterval(miningInterval);
  if (pingerInterval) clearInterval(pingerInterval);
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