import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';
import Block from '../core/block.js';

export class P2PServer {
  constructor(blockchain, port = null) {
    this.blockchain = blockchain;
    this.port = port;
    this.peers = new Map();
    this.wss = null;
    this.nodeId = crypto.randomBytes(16).toString('hex');
    this.isSyncing = false;
    this.syncQueue = [];

    this.outboundUrls = new Set();
    this.reconnectTimers = new Map();
    this.RECONNECT_DELAY = 15_000;

    // ── AUTO DISCOVERY ──────────────────────────────────────────────
    this.bootstrapUrls = [];
    this.discoveredPeers = new Set();
    this.discoveryInterval = null;
    this.pendingPeerRequests = new Map();
    this.disconnectTimes = new Map();
    this.urlToNodeId = new Map();
  }

  // ─── Server startup ─────────────────────────────────────────────────────────

  listen(httpServer = null) {
    try {
      if (httpServer) {
        this.wss = new WebSocketServer({ server: httpServer, path: '/p2p' });
        console.log('✅ P2P WebSocket attached to HTTP server at /p2p');
      } else if (this.port) {
        this.wss = new WebSocketServer({ port: this.port });
        console.log(`✅ P2P server on port ${this.port}`);
      } else {
        console.log('⚠️ P2P disabled — API-only mode');
        return;
      }

      this.wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        console.log(`🤝 Inbound peer from ${ip}`);
        this._handleInboundConnection(ws);
      });

      this.wss.on('error', (err) => {
        console.error('❌ P2P WSS error:', err.message);
      });

      console.log(`📡 Node ID: ${this.nodeId}`);

      // ── Start auto-discovery ──────────────────────────────────────
      this._startDiscovery();

    } catch (err) {
      console.error('❌ P2P startup failed:', err.message);
      console.log('📡 API-only mode');
    }
  }

  // ─── AUTO DISCOVERY ──────────────────────────────────────────────────────────

  _startDiscovery() {
    // Every 30 seconds, try to discover new peers
    this.discoveryInterval = setInterval(() => {
      this._discoverPeers();
    }, 30_000);

    // Initial discovery after 5 seconds
    setTimeout(() => this._discoverPeers(), 5000);
  }

  async _discoverPeers() {
    try {
      // 1. Ask all connected peers for their known peers
      this._broadcast({ type: 'get_peers' });

      // 2. If we have bootstrap peers, connect to them
      for (const url of this.bootstrapUrls) {
        if (!this.outboundUrls.has(url) && !this._isConnected(url)) {
          this.connectToPeer(url);
        }
      }

      // 3. Check for offline bootstrap peers to trigger self-healing deploy webhooks
      for (const [url, disconnectTime] of this.disconnectTimes.entries()) {
        const offlineDuration = Date.now() - disconnectTime;
        if (offlineDuration > 3600_000) { // 1 hour
          const host = url
            .replace(/^https?:\/\//i, '')
            .replace(/^wss?:\/\//i, '')
            .replace(/\/p2p\/?$/i, '')
            .replace(/[^a-z0-9]/gi, '_')
            .toUpperCase();
          const hookVarName = `DEPLOY_HOOK_${host}`;
          const webhookUrl = process.env[hookVarName];
          if (webhookUrl) {
            console.warn(`⚠️ Peer ${url} has been offline for ${Math.round(offlineDuration / 60000)} minutes. Triggering deploy webhook: ${hookVarName}`);
            fetch(webhookUrl, { method: 'POST' }).catch(() => {});
            // Reset disconnect time to avoid spamming the webhook
            this.disconnectTimes.set(url, Date.now());
          }
        }
      }

    } catch (err) {
      // silently ignore
    }
  }

  // ─── Set bootstrap peers ─────────────────────────────────────────────────────

  setBootstrapPeers(urls = []) {
    if (!Array.isArray(urls)) return;
    this.bootstrapUrls = urls.filter(u => u && u.trim());
    console.log(`🔗 Set ${this.bootstrapUrls.length} bootstrap peer(s)`);
    if (this.bootstrapUrls.length) {
      this.bootstrapUrls.forEach(u => console.log(`  → ${u}`));
    }
  }

  // ─── Bootstrap: connect to known peers ──────────────────────────────────────

  connectToBootstrapPeers(urls = []) {
    if (urls.length) {
      this.bootstrapUrls = [...new Set([...this.bootstrapUrls, ...urls])];
    }
    if (!this.bootstrapUrls.length) {
      console.log('⚠️ No bootstrap peers configured');
      return;
    }

    console.log(`\n🔗 Connecting to ${this.bootstrapUrls.length} bootstrap peer(s)...`);
    this.bootstrapUrls.forEach(url => {
      if (!this.outboundUrls.has(url) && !this._isConnected(url)) {
        this.connectToPeer(url);
      }
    });
  }

  // ─── Outbound connection ─────────────────────────────────────────────────────

  connectToPeer(url) {
    if (!url || typeof url !== 'string') return;
    url = url.trim();
    if (!url) return;

    if (this.outboundUrls.has(url)) return;
    this.outboundUrls.add(url);

    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      console.warn(`⚠️ Invalid peer URL: ${url}`);
      this.outboundUrls.delete(url);
      return;
    }

    const attempt = () => {
      for (const peer of this.peers.values()) {
        if (peer.url === url && peer.ws.readyState === WebSocket.OPEN) {
          return;
        }
      }

      console.log(`🔗 Connecting to peer: ${url}`);
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error(`❌ Bad peer URL ${url}:`, err.message);
        this._scheduleReconnect(url);
        return;
      }

      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          console.log(`⏱️ Connection timeout: ${url}`);
          this._scheduleReconnect(url);
        }
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✅ Connected to peer: ${url}`);
        this.disconnectTimes.delete(url);
        this._handleOutboundConnection(ws, url);
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`❌ Peer ${url} error:`, err.message);
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        console.log(`🔌 Outbound peer closed: ${url}`);
        for (const [id, peer] of this.peers.entries()) {
          if (peer.url === url) {
            this.peers.delete(id);
            break;
          }
        }
        if (!this.disconnectTimes.has(url)) {
          this.disconnectTimes.set(url, Date.now());
        }
        this._scheduleReconnect(url);
      });
    };

    attempt();
  }

  _scheduleReconnect(url) {
    if (this.reconnectTimers.has(url)) return;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(url);
      this.outboundUrls.delete(url);
      this.connectToPeer(url);
    }, this.RECONNECT_DELAY);
    this.reconnectTimers.set(url, timer);
  }

  // ─── Inbound connection ──────────────────────────────────────────────────────

  _handleInboundConnection(ws) {
    const peerId = crypto.randomBytes(8).toString('hex');
    this.peers.set(peerId, {
      ws,
      id: peerId,
      url: null,
      nodeId: null,
      chainHeight: 0,
      lastSeen: Date.now(),
      synced: false,
    });

    console.log(`👤 Inbound peer ${peerId} (total: ${this.peers.size})`);
    this._registerHandlers(ws, peerId);
    this._sendHandshake(ws);
    this._requestBlocks(ws);
  }

  _handleOutboundConnection(ws, url) {
    const peerId = crypto.randomBytes(8).toString('hex');
    this.peers.set(peerId, {
      ws,
      id: peerId,
      url,
      nodeId: null,
      chainHeight: 0,
      lastSeen: Date.now(),
      synced: false,
    });

    console.log(`👤 Outbound peer ${peerId} → ${url} (total: ${this.peers.size})`);
    this._registerHandlers(ws, peerId);
    this._sendHandshake(ws);
    this._requestBlocks(ws);
  }

  // ─── Shared per-socket event registration ────────────────────────────────────

  _registerHandlers(ws, peerId) {
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this._handleMessage(msg, peerId);
      } catch (err) {
        console.error(`P2P parse error from ${peerId}:`, err.message);
      }
    });

    ws.on('close', () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        console.log(`👋 Peer ${peerId} disconnected`);
        if (peer.url) {
          if (!this.disconnectTimes.has(peer.url)) {
            this.disconnectTimes.set(peer.url, Date.now());
          }
          this._scheduleReconnect(peer.url);
        }
        this.peers.delete(peerId);
      }
    });

    ws.on('error', (err) => {
      console.error(`Peer ${peerId} socket error:`, err.message);
      this.peers.delete(peerId);
    });
  }

  // ─── Message dispatch ────────────────────────────────────────────────────────

  async _handleMessage(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (peer) peer.lastSeen = Date.now();

    switch (msg.type) {
      case 'handshake':
        await this._handleHandshake(msg, peerId);
        break;

      case 'new_block':
        await this._handleNewBlock(msg, peerId);
        break;

      case 'new_transaction':
        await this._handleNewTransaction(msg, peerId);
        break;

      case 'get_blocks':
        this._handleGetBlocks(msg, peerId);
        break;

      case 'blocks':
        await this._handleBlocks(msg, peerId);
        break;

      case 'get_peers':
        this._handleGetPeers(msg, peerId);
        break;

      case 'peers':
        this._handlePeers(msg, peerId);
        break;

      default:
        break;
    }
  }

  // ─── Peer discovery messages ────────────────────────────────────────────────

  _handleGetPeers(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    // Send back our known peer list (excluding the requester)
    const peerList = Array.from(this.peers.values())
      .filter(p => p.id !== peerId && p.url)
      .map(p => p.url)
      .slice(0, 20);

    if (peerList.length) {
      this._send(peer.ws, {
        type: 'peers',
        peers: peerList,
      });
    }
  }

  _handlePeers(msg, peerId) {
    const peers = msg.peers || [];
    if (!Array.isArray(peers)) return;

    // Connect to any new peers we don't know about
    let newPeers = 0;
    for (const url of peers) {
      if (!this.outboundUrls.has(url) && !this._isConnected(url)) {
        console.log(`🔍 Discovered new peer: ${url}`);
        this.discoveredPeers.add(url);
        this.connectToPeer(url);
        newPeers++;
      }
    }
    if (newPeers) {
      console.log(`✨ Discovered ${newPeers} new peer(s)`);
    }
  }

  _isConnected(url) {
    for (const peer of this.peers.values()) {
      if (peer.url === url && peer.ws.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    const peerNodeId = this.urlToNodeId.get(url);
    if (peerNodeId) {
      for (const peer of this.peers.values()) {
        if (peer.nodeId === peerNodeId && peer.ws.readyState === WebSocket.OPEN) {
          return true;
        }
      }
    }
    return false;
  }

  // ─── Handshake ──────────────────────────────────────────────────────────────

  async _handleHandshake(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.nodeId = msg.nodeId;
    peer.chainHeight = msg.chainHeight || 0;
    peer.chainId = msg.chainId;

    console.log(`🤝 Handshake: node=${msg.nodeId?.slice(0, 8)} height=${msg.chainHeight}`);

    // Chain ID mismatch — reject
    if (msg.chainId && this.blockchain.chainId && msg.chainId !== this.blockchain.chainId) {
      console.warn(`⚠️ Chain ID mismatch. Closing.`);
      peer.ws.close();
      this.peers.delete(peerId);
      return;
    }

    // Self-connection check
    if (msg.nodeId === this.nodeId) {
      console.log(`⚠️ Closed self-connection to node: ${msg.nodeId}`);
      peer.ws.close();
      this.peers.delete(peerId);
      return;
    }

    // Map URL to nodeId if outbound URL exists
    if (peer.url && msg.nodeId) {
      this.urlToNodeId.set(peer.url, msg.nodeId);
    }

    // Check for duplicate connection to the same nodeId
    for (const [otherId, otherPeer] of this.peers.entries()) {
      if (otherId !== peerId && otherPeer.nodeId === msg.nodeId) {
        console.log(`🔍 Duplicate connection to nodeId ${msg.nodeId} detected.`);

        const peerInitiator = peer.url ? this.nodeId : msg.nodeId;
        const otherPeerInitiator = otherPeer.url ? this.nodeId : msg.nodeId;

        if (peerInitiator !== otherPeerInitiator) {
          const keepInitiator = this.nodeId > msg.nodeId ? this.nodeId : msg.nodeId;

          if (peerInitiator === keepInitiator) {
            console.log(`↔️ Keeping new connection ${peerId} (initiated by ${peerInitiator}) and closing old one ${otherId}`);
            if (otherPeer.url && !peer.url) {
              peer.url = otherPeer.url;
            }
            otherPeer.ws.close();
            this.peers.delete(otherId);
          } else {
            console.log(`↔️ Keeping old connection ${otherId} (initiated by ${otherPeerInitiator}) and closing new one ${peerId}`);
            if (peer.url && !otherPeer.url) {
              otherPeer.url = peer.url;
            }
            peer.ws.close();
            this.peers.delete(peerId);
            return;
          }
        } else {
          console.log(`↔️ Keeping older connection ${otherId} and closing new one ${peerId}`);
          peer.ws.close();
          this.peers.delete(peerId);
          return;
        }
      }
    }

    // If peer is ahead, sync
    if (msg.chainHeight > this.blockchain.chain.length) {
      console.log(`📥 Peer is ahead (${msg.chainHeight} > ${this.blockchain.chain.length}). Syncing...`);
      this._requestBlocks(peer.ws);
    }
  }

  _sendHandshake(ws) {
    this._send(ws, {
      type: 'handshake',
      nodeId: this.nodeId,
      chainHeight: this.blockchain.chain.length,
      chainId: this.blockchain.chainId,
      timestamp: Date.now(),
    });
  }

  // ─── New block from peer ─────────────────────────────────────────────────────

  async _handleNewBlock(msg, peerId) {
    try {
      const blockData = msg.block;
      if (!blockData) return;

      const ourHeight = this.blockchain.chain.length;

      if (blockData.index < ourHeight) {
        const localBlock = this.blockchain.chain[blockData.index];
        if (localBlock && localBlock.hash !== blockData.hash) {
          console.warn(`⚠️ Fork at block ${blockData.index}. Requesting sync from common ancestor...`);
          const peer = this.peers.get(peerId);
          if (peer) {
            this._send(peer.ws, {
              type: 'get_blocks',
              fromIndex: Math.max(0, blockData.index - 1),
            });
          }
        }
        return;
      }

      if (blockData.index === ourHeight) {
        const block = await Block.fromJSON(blockData);
        const added = await this.blockchain.addBlock(block);
        if (added) {
          const peer = this.peers.get(peerId);
          if (peer) {
            peer.chainHeight = Math.max(peer.chainHeight || 0, block.index + 1);
          }
          console.log(`📦 Accepted block #${block.index} from peer ${peerId}`);
          this._broadcastExcept({ type: 'new_block', block: blockData }, peerId);
        }
        return;
      }

      const peer = this.peers.get(peerId);
      if (peer) {
        console.log(`📥 Peer ahead. Requesting sync...`);
        this._requestBlocks(peer.ws);
      }
    } catch (err) {
      console.error('❌ _handleNewBlock error:', err.message);
    }
  }

  // ─── New transaction from peer ───────────────────────────────────────────────

  async _handleNewTransaction(msg, peerId) {
    try {
      if (!msg.transaction) return;

      const { default: Transaction } = await import('../core/transaction.js');
      const tx = Transaction.fromJSON(msg.transaction);

      const mempoolDuplicate = this.blockchain.mempool.some(
        existing => existing.id === tx.id
      );
      if (mempoolDuplicate) return;

      const chainDuplicate = this.blockchain.chain.some(block =>
        block.transactions.some(existing => existing.id === tx.id)
      );
      if (chainDuplicate) return;

      this.blockchain.addTransaction(tx, tx.publicKey);
      this._broadcastExcept({
        type: 'new_transaction',
        transaction: msg.transaction
      }, peerId);

    } catch (err) {
      console.error(`❌ Failed to process tx from peer ${peerId}:`, err.message);
    }
  }

  // ─── Block request / response ────────────────────────────────────────────────

  _requestBlocks(ws) {
    this._send(ws, {
      type: 'get_blocks',
      fromIndex: Math.max(0, this.blockchain.chain.length - 1),
    });
  }

  _handleGetBlocks(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const from = msg.fromIndex || 0;
    const BATCH = 100;
    const blocks = this.blockchain.chain.slice(from, from + BATCH);

    if (!blocks.length) return;

    const batch = blocks.map(b => b.toJSON ? b.toJSON() : b);
    this._send(peer.ws, { type: 'blocks', blocks: batch });
  }

  async _handleBlocks(msg, peerId) {
    const blocks = msg.blocks;
    if (!Array.isArray(blocks) || !blocks.length) return;

    this.syncQueue.push({ blocks, peerId });
    if (this.isSyncing) return;

    this.isSyncing = true;

    try {
      while (this.syncQueue.length > 0) {
        const item = this.syncQueue.shift();
        await this._processBlocksBatch(item.blocks, item.peerId);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  async _processBlocksBatch(blocks, peerId) {
    console.log(`📚 Received ${blocks.length} blocks from peer ${peerId}`);

    try {
      let imported = 0;
      const peer = this.peers.get(peerId);

      for (const blockData of blocks) {
        const ourHeight = this.blockchain.chain.length;

        if (blockData.index < ourHeight) {
          const localBlock = this.blockchain.chain[blockData.index];
          if (localBlock && localBlock.hash !== blockData.hash) {
            console.warn(`⚠️ Fork detected at block #${blockData.index}`);
            if (peer && peer.chainHeight > ourHeight) {
              console.log(`🔄 Peer has longer chain (${peer.chainHeight} > ${ourHeight}). Rolling back local chain to #${blockData.index - 1} and syncing...`);
              await this.blockchain._rollbackToHeight(blockData.index - 1);
              this._send(peer.ws, {
                type: 'get_blocks',
                fromIndex: Math.max(0, blockData.index - 1),
              });
              this.syncQueue = []; // Clear queue since we're starting a new sync request
              return;
            }
          }
          continue;
        }

        if (blockData.index === ourHeight) {
          const block = await Block.fromJSON(blockData);
          const added = await this.blockchain.addBlock(block);
          if (added) {
            imported++;
          } else {
            console.warn(`⚠️ addBlock rejected #${blockData.index}`);
            this.syncQueue = []; // Clear queue on rejection
            return;
          }
          continue;
        }

        console.log(`⚠️ Gap: have ${ourHeight}, next is ${blockData.index}`);
        if (peer) this._requestBlocks(peer.ws);
        this.syncQueue = []; // Clear queue on gap, since we requested a fresh start
        return;
      }

      if (imported > 0) {
        console.log(`✅ Synced ${imported} blocks. New height: ${this.blockchain.chain.length}`);
        this._broadcastHandshake();
      }

      // If we are still behind the peer, request the next batch
      if (peer && peer.chainHeight > this.blockchain.chain.length) {
        console.log(`📥 Still behind peer (${this.blockchain.chain.length} < ${peer.chainHeight}). Requesting next batch...`);
        this._requestBlocks(peer.ws);
      }
    } catch (err) {
      console.error('❌ _processBlocksBatch error:', err.message);
    }
  }

  // ─── Broadcast helpers ───────────────────────────────────────────────────────

  broadcastBlock(block) {
    this.broadcast({
      type: 'new_block',
      block: block.toJSON ? block.toJSON() : block,
    });
    this._broadcastHandshake();
  }

  broadcastTransaction(transaction) {
    this.broadcast({
      type: 'new_transaction',
      transaction: transaction.toJSON ? transaction.toJSON() : transaction,
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const peer of this.peers.values()) {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(data);
      }
    }
  }

  _broadcastExcept(message, excludePeerId) {
    const data = JSON.stringify(message);
    for (const [id, peer] of this.peers.entries()) {
      if (id !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(data);
      }
    }
  }

  _broadcastHandshake() {
    for (const peer of this.peers.values()) {
      if (peer.ws.readyState === WebSocket.OPEN) {
        this._sendHandshake(peer.ws);
      }
    }
  }

  _send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  connectToPeerLegacy(url) { this.connectToPeer(url); }

  getStats() {
    const uniquePeers = [];
    const seenNodeIds = new Set();
    
    for (const peer of this.peers.values()) {
      if (peer.nodeId) {
        if (!seenNodeIds.has(peer.nodeId)) {
          seenNodeIds.add(peer.nodeId);
          uniquePeers.push(peer);
        }
      } else {
        uniquePeers.push(peer);
      }
    }

    return {
      nodeId: this.nodeId,
      peers: uniquePeers.length,
      enabled: !!this.wss,
      peerList: uniquePeers.map(p => ({
        id: p.id,
        nodeId: p.nodeId,
        chainHeight: p.chainHeight,
        lastSeen: p.lastSeen,
        url: p.url,
      })),
    };
  }

  getNetworkStats() {
    return {
      ...this.getStats(),
      mode: 'validator',
      discovered: this.discoveredPeers.size,
    };
  }

  close() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    for (const [url, timer] of this.reconnectTimers.entries()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    for (const peer of this.peers.values()) {
      try { peer.ws.close(); } catch {}
    }

    if (this.wss) {
      this.wss.close();
      console.log('🔌 P2P server closed');
    }
  }
}