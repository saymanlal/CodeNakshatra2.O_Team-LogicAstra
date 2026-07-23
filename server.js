import './core/env.js';
import express from 'express';
import cors from 'cors';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import Blockchain from './core/blockchain.js';
import { P2PServer } from './p2p/server.js';
import { setupRoutes } from './api/routes.js';
import { loadConfig } from './config/index.js';
import { submitRollupToL1 } from './core/rollup.js';
import { runMigration } from './core/archive/index.js';
import {
  parseTransaction,
  calculateEVMHash,
  recoverPublicKey,
  getEthereumAddress,
  getNumericChainId,
  formatEVMBlock,
  formatEVMTransaction
} from './core/evmHelper.js';
import Transaction, { TX_TYPES } from './core/transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Gzip compression for all JSON API responses ───────────────────────────────
// Reduces bandwidth by ~70-80%, preventing free-tier bandwidth cap suspensions.
app.use((req, res, next) => {
  const ae = req.headers['accept-encoding'] || '';
  if (!ae.includes('gzip')) return next();
  const _json = res.json.bind(res);
  res.json = (data) => {
    const body = JSON.stringify(data);
    zlib.gzip(Buffer.from(body, 'utf8'), (err, compressed) => {
      if (err) return _json(data);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Vary', 'Accept-Encoding');
      res.end(compressed);
    });
  };
  next();
});

// Serve the built Android APK from the repo-root apk/ folder.
// Without this, /apk/base.apk 404s because only frontend/ is mounted above.
app.use(express.static(path.join(__dirname, 'frontend')));
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
        <title>SAYMAN Documentation</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; color: #1a1a1a; background: #fafafa; }
          h1 { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
          p { color: #555; line-height: 1.6; }
          a { color: #111; font-weight: 600; text-decoration: underline; }
          a:hover { color: #666; }
          .card { background: #ffffff; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>📚 Documentation Moved</h1>
        <p>The SAYMAN developer documentation site has been migrated to its own dedicated repository for independent hosting.</p>
        <div class="card">
          <p><strong>Repository:</strong> <a href="https://github.com/saymanlal/sayman-docs" target="_blank">github.com/saymanlal/sayman-docs</a></p>
        </div>
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

// Serve frontend/assets AND root assets/ (for logo-512.png accessible to MetaMask)
app.use('/assets', express.static(path.join(__dirname, 'assets')));
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
    console.log('║   SAYMAN BLOCKCHAIN - PHASE 22         ║');
    console.log('║   Instant Tx + Bandwidth Optimised     ║');
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

    // Archive Initialization and Migration
    if (config.archive && config.archive.enabled) {
      let archiveMigrationComplete = false;
      const checkpointPath = path.resolve(config.archive.migrationCheckpoint || './data/migration-checkpoint.json');
      if (fs.existsSync(checkpointPath)) {
        try {
          const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
          archiveMigrationComplete = !!checkpoint.migrationComplete;
        } catch {}
      }

      if (!archiveMigrationComplete) {
        console.log('[Archive] Starting block archive migration...');
        try {
          await runMigration(blockchain, blockchain.archiveWriter);
        } catch (migrationErr) {
          console.error('⚠️ [Archive] Archive migration failed:', migrationErr.message);
          console.log('ℹ️ [Archive] Continuing node execution without completing archive migration.');
        }
      } else {
        console.log('[Archive] Archive migration already marked complete.');
      }

      await blockchain.archiveWriter.start();
    }

    p2pServer = new P2PServer(blockchain, config.p2pPort);

    if (config.bootstrapPeers?.length > 0) {
      p2pServer.setBootstrapPeers(config.bootstrapPeers);
    }

    setupRoutes(app, blockchain, p2pServer, config);
    app.post(['/', '/api', '/rpc'], handleJsonRpc);

    // Explorer SPA routing fallbacks for blocks, txs, and contracts
    app.get(['/block/:id', '/tx/:hash', '/contract/:address'], (req, res) => {
      res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    });

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

      if (mode === 'validator' || mode === 'full' || mode === 'fullnode' || mode === 'observer' || mode === 'sequencer') {
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

      if (config.archive && config.archive.enabled) {
        blockchain.syncFromArchive().catch(err => {
          console.error('⚠️ [Sync] Archive sync failed:', err.message);
        });
      }

      if (mode === 'validator' || mode === 'sequencer') {
        console.log(`\n⛏️ Starting block production in ${mode.toUpperCase()} mode...`);
        startMining(mode);

        // ── Instant block production on mempool arrival ───────────────────
        // Instead of waiting the full blockTime (5 s) after every tx,
        // fire a block immediately when the first tx lands in an empty mempool.
        let instantBlockDebounce = null;
        blockchain.onTransactionAdded = () => {
          if (instantBlockDebounce) return;  // already scheduled
          if (blockchain.isSyncing || (p2pServer && p2pServer.isSyncing)) return;
          if (!p2pServer?.canProduceBlocks()) return;
          instantBlockDebounce = setTimeout(async () => {
            instantBlockDebounce = null;
            try {
              const block = await blockchain.createBlock();
              if (block) {
                if (p2pServer) p2pServer.broadcastBlock(block);
                if (mode === 'sequencer' && block.index > 0 && block.index % 5 === 0) {
                  submitRollupToL1(block, config).catch(err =>
                    console.error('[Rollup] Error submitting to L1:', err.message)
                  );
                }
              }
            } catch (err) {
              console.error('[Instant-Block] Error:', err.message);
            }
          }, 200); // 200ms debounce — batch rapid-fire txs
        };
      }
    });

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (err) {
    console.error('❌ Fatal error during startup:', err);
    process.exit(1);
  }
}

function startMining(mode) {
  const config = blockchain.config;
  const startupTime = Date.now();

  miningInterval = setInterval(async () => {
    try {
      if (p2pServer) {
        // Skip block production while P2P sync is in progress
        // Note: blockchain.isSyncing is set by P2P sync; archive sync bails early if no repo.
        // We add a safety reset: if stuck syncing > 3 minutes, force unblock mining.
        if (blockchain && blockchain.isSyncing) {
          const syncAge = Date.now() - (p2pServer.lastSyncRequestTime || 0);
          if (syncAge > 180_000) {
            // Stalled for >3 minutes — force-reset
            console.warn('[Miner] Blockchain sync stalled >3min. Force-resetting isSyncing to resume mining.');
            blockchain.isSyncing = false;
            p2pServer.syncingFromPeerId = null;
          } else {
            return;
          }
        }
        if (p2pServer.isSyncing) {
          return;
        }

        // ── Leader election: standby nodes yield to the primary ───────
        // Primary (sayman.onrender.com) always produces.
        // Standbys only produce when primary has been silent for > 20s.
        if (!p2pServer.canProduceBlocks()) {
          return; // Primary is alive — yield
        }

        // Skip block production if we are behind any connected peer
        let maxPeerHeight = 0;
        for (const peer of p2pServer.peers.values()) {
          if (peer.chainHeight > maxPeerHeight) {
            maxPeerHeight = peer.chainHeight;
          }
        }
        if (maxPeerHeight > blockchain.chain.length) {
          console.log(`[Miner] Skipping block production: local height (${blockchain.chain.length}) is behind peer height (${maxPeerHeight})`);
          return;
        }

        // If bootstrap peers are configured, wait to connect to at least one peer
        // to avoid producing blocks in isolation, with a 30-second startup grace period
        if (config.bootstrapPeers?.length > 0 && p2pServer.peers.size === 0) {
          const elapsed = Date.now() - startupTime;
          if (elapsed < 30_000) {
            console.log(`[Miner] Waiting to connect to bootstrap peers before starting block production...`);
            return;
          }
        }
      }

      const block = await blockchain.createBlock();
      if (block) {
        if (p2pServer) {
          p2pServer.broadcastBlock(block);
        }
        // If this node is running as a sequencer (L2 Rollup node), submit commitment to L1
        if (mode === 'sequencer' && block.index > 0 && block.index % 5 === 0) {
          submitRollupToL1(block, config).catch(err => {
            console.error('[Rollup] Error submitting to L1:', err.message);
          });
        }
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

async function handleJsonRpc(req, res) {
  const { jsonrpc, id, method, params } = req.body;
  if (jsonrpc !== '2.0') {
    return res.status(400).json({ error: 'Only JSON-RPC 2.0 is supported' });
  }

  try {
    const result = await processJsonRpc(method, params);
    res.json({ jsonrpc: '2.0', id, result });
  } catch (err) {
    console.error(`[RPC Error] method=${method}:`, err);
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: err.message || 'Internal error'
      }
    });
  }
}

async function processJsonRpc(method, params) {
  switch (method) {
    case 'eth_chainId': {
      const chainIdStr = blockchain.config.chainId;
      const numericId = getNumericChainId(chainIdStr);
      return '0x' + numericId.toString(16);
    }
    case 'net_version': {
      const chainIdStr = blockchain.config.chainId;
      const numericId = getNumericChainId(chainIdStr);
      return numericId.toString();
    }
    case 'eth_blockNumber': {
      const height = blockchain.chain.length - 1;
      return '0x' + height.toString(16);
    }
    case 'eth_getBlockByNumber': {
      const [blockNumParam, includeTxs] = params;
      let blockIndex;
      if (blockNumParam === 'latest' || blockNumParam === 'safe' || blockNumParam === 'finalized') {
        blockIndex = blockchain.chain.length - 1;
      } else if (blockNumParam === 'earliest') {
        blockIndex = 0;
      } else if (blockNumParam === 'pending') {
        blockIndex = blockchain.chain.length - 1;
      } else {
        blockIndex = parseInt(blockNumParam, 16);
      }

      const block = await blockchain.getBlock(blockIndex);
      if (!block) return null;

      return formatEVMBlock(block, !!includeTxs, blockchain);
    }
    case 'eth_getBlockByHash': {
      const [blockHash, includeTxs] = params;
      const hashStr = blockHash.startsWith('0x') ? blockHash.slice(2) : blockHash;
      
      const blockIndexRaw = await blockchain.db.get(`hash:${hashStr}`).catch(() => null);
      if (blockIndexRaw !== null) {
        const blockIndex = parseInt(blockIndexRaw, 10);
        const block = await blockchain.getBlock(blockIndex);
        if (block) return formatEVMBlock(block, !!includeTxs, blockchain);
      }
      return null;
    }
    case 'eth_getBalance': {
      const [addressParam] = params;
      let address = (addressParam || '').toLowerCase();
      if (address.startsWith('0x')) address = address.slice(2);
      
      const balance = blockchain.state.getBalance(address);
      // SAYMAN base units (1e8 decimals) → 18-decimal wei for MetaMask display
      // Multiply by 1e10 to bridge the 8-decimal gap
      const balanceWei = BigInt(balance) * 10n**10n;
      return '0x' + balanceWei.toString(16);
    }
    case 'eth_getTransactionCount': {
      const [addressParam] = params;
      let address = (addressParam || '').toLowerCase();
      if (address.startsWith('0x')) address = address.slice(2);

      const confirmedNonce = blockchain.state.getNonce(address);
      // Include pending nonce from NonceManager if available
      const pendingNonce = blockchain.nonceManager
        ? blockchain.nonceManager.getNonce(address)
        : confirmedNonce;
      const nonce = Math.max(confirmedNonce, pendingNonce);
      return '0x' + nonce.toString(16);
    }
    case 'eth_gasPrice': {
      const gasPrice = blockchain.config.defaultGasPrice || 1;
      const gasPriceWei = BigInt(gasPrice) * 10n**10n;
      return '0x' + gasPriceWei.toString(16);
    }
    case 'eth_estimateGas': {
      // Return a reasonable gas estimate for MetaMask
      return '0x' + (21000).toString(16);
    }
    case 'eth_sendRawTransaction': {
      const [rawTxHex] = params;
      const evmTx = parseTransaction(rawTxHex);
      
      // Recover public key
      const msgHash = calculateEVMHash(evmTx);
      const pubKeyHex = recoverPublicKey(msgHash, evmTx.r, evmTx.s, evmTx.v, evmTx.typeByte);
      const senderAddr = getEthereumAddress(pubKeyHex);

      const cleanSenderAddr = senderAddr.startsWith('0x') ? senderAddr.slice(2) : senderAddr;

      let txType = TX_TYPES.TRANSFER;
      let dataPayload = {
        from: cleanSenderAddr,
        to: evmTx.to ? (evmTx.to.startsWith('0x') ? evmTx.to.slice(2) : evmTx.to) : null,
        amount: Number(evmTx.value / 10n**10n)
      };

      if (evmTx.data && evmTx.data !== '' && evmTx.data !== '0x') {
        if (!evmTx.to) {
          txType = TX_TYPES.CONTRACT_DEPLOY;
          dataPayload = {
            from: cleanSenderAddr,
            code: evmTx.data
          };
        } else {
          txType = TX_TYPES.CONTRACT_CALL;
          dataPayload = {
            from: cleanSenderAddr,
            contractAddress: evmTx.to.startsWith('0x') ? evmTx.to.slice(2) : evmTx.to,
            method: 'execute',
            args: { rawInput: evmTx.data }
          };
        }
      }

      const tx = new Transaction(txType, dataPayload);
      tx.nonce = evmTx.nonce;
      tx.gasLimit = evmTx.gasLimit;
      tx.gasPrice = Number(BigInt(evmTx.gasPrice) / 10n**10n) || 1;
      tx.signature = { r: evmTx.r, s: evmTx.s, v: evmTx.v };
      tx.publicKey = pubKeyHex;
      tx.isEVM = true;
      tx.evmRaw = rawTxHex;
      tx.timestamp = Date.now();
      tx.id = crypto.createHash('sha256').update(rawTxHex).digest('hex');

      const added = await blockchain.addTransaction(tx, pubKeyHex);
      if (!added) {
        throw new Error('Transaction rejected by mempool');
      }

      if (p2pServer) {
        p2pServer.broadcastTransaction(tx);
      }

      return '0x' + tx.id;
    }
    case 'eth_getTransactionByHash': {
      const [txHash] = params;
      const hashStr = txHash.startsWith('0x') ? txHash.slice(2) : txHash;
      
      let foundTx = null;
      let foundBlock = null;
      let txIdx = 0;
      
      const txLocationRaw = await blockchain.db.get(`tx:${hashStr}`).catch(() => null);
      if (txLocationRaw) {
        const txLocation = typeof txLocationRaw === 'string' ? JSON.parse(txLocationRaw) : txLocationRaw;
        const block = await blockchain.getBlock(txLocation.blockIndex);
        if (block) {
          foundBlock = block;
          txIdx = txLocation.txIndex;
          foundTx = block.transactions[txIdx];
        }
      }

      if (!foundTx) {
        foundTx = blockchain.mempool.find(t => t.id === hashStr);
      }

      if (!foundTx) return null;
      return formatEVMTransaction(foundTx, foundBlock, blockchain, txIdx);
    }
    case 'eth_getTransactionReceipt': {
      const [txHash] = params;
      const hashStr = txHash.startsWith('0x') ? txHash.slice(2) : txHash;

      let foundTx = null;
      let foundBlock = null;
      let txIdx = 0;
      
      const txLocationRaw = await blockchain.db.get(`tx:${hashStr}`).catch(() => null);
      if (txLocationRaw) {
        const txLocation = typeof txLocationRaw === 'string' ? JSON.parse(txLocationRaw) : txLocationRaw;
        const block = await blockchain.getBlock(txLocation.blockIndex);
        if (block) {
          foundBlock = block;
          txIdx = txLocation.txIndex;
          foundTx = block.transactions[txIdx];
        }
      }

      if (!foundTx || !foundBlock) return null;

      const fromAddr = foundTx.data.from ? (foundTx.data.from.startsWith('0x') ? foundTx.data.from : '0x' + foundTx.data.from) : '0x' + '0'.repeat(40);
      const toAddr = foundTx.data.to ? (foundTx.data.to.startsWith('0x') ? foundTx.data.to : '0x' + foundTx.data.to) : null;
      const gasUsed = foundTx.gasUsed || 21000;

      return {
        transactionHash: '0x' + foundTx.id,
        transactionIndex: '0x' + txIdx.toString(16),
        blockHash: '0x' + foundBlock.hash,
        blockNumber: '0x' + foundBlock.index.toString(16),
        from: fromAddr,
        to: toAddr,
        cumulativeGasUsed: '0x' + gasUsed.toString(16),
        gasUsed: '0x' + gasUsed.toString(16),
        contractAddress: foundTx.type === 'CONTRACT_DEPLOY' && foundTx.data?.contractAddress
          ? '0x' + foundTx.data.contractAddress
          : null,
        logs: [],
        logsBloom: '0x' + '0'.repeat(512),
        status: '0x1',   // all mined txs are successful (revert = not in chain)
        effectiveGasPrice: '0x' + ((blockchain.config.defaultGasPrice || 1) * 10**10).toString(16)
      };
    }
    case 'eth_accounts': {
      return [];
    }
    case 'eth_requestAccounts': {
      return [];
    }
    // ── Log/Filter methods — MetaMask polls these constantly ────────────────────
    case 'eth_getLogs': {
      // Return empty logs array — SAYMAN events are not EVM-ABI encoded
      return [];
    }
    case 'eth_newBlockFilter': {
      // Return a filter ID; MetaMask uses this to detect new blocks
      return '0x1';
    }
    case 'eth_newPendingTransactionFilter': {
      return '0x2';
    }
    case 'eth_newFilter': {
      return '0x3';
    }
    case 'eth_getFilterChanges': {
      // Return latest block hash so MetaMask knows chain is live
      const lastBlock = blockchain.getLastBlock();
      return lastBlock ? ['0x' + lastBlock.hash] : [];
    }
    case 'eth_getFilterLogs': {
      return [];
    }
    case 'eth_uninstallFilter': {
      return true;
    }
    // ── Wallet methods — wallet_addEthereumChain from MetaMask ─────────────────
    case 'wallet_addEthereumChain':
    case 'wallet_switchEthereumChain': {
      // These are handled client-side by MetaMask; return null = success acknowledged
      return null;
    }
    case 'wallet_getPermissions':
    case 'eth_getCode': {
      return '0x';
    }
    case 'web3_clientVersion': {
      return 'SAYMAN/v7.0.0/javascript';
    }
    case 'eth_syncing': {
      return false; // not syncing
    }
    case 'net_listening': {
      return true;
    }
    case 'net_peerCount': {
      return '0x' + (p2pServer ? p2pServer.peers.size : 0).toString(16);
    }
    default:
      throw new Error(`Method ${method} not supported`);
  }
}

startServer();