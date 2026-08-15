import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';
import Block from '../core/block.js';

function normalizeUrl(url) {
  if (!url) return '';
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^wss?:\/\//i, '')
    .replace(/\/p2p\/?$/i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function getPublicP2PUrl() {
  if (process.env.PUBLIC_P2P_URL) return process.env.PUBLIC_P2P_URL;
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/^http/, 'ws') + '/p2p';
  }
  if (process.env.RAILWAY_STATIC_URL) {
    return `wss://${process.env.RAILWAY_STATIC_URL}/p2p`;
  }
  return null;
}

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
    this.selfUrls = new Set();
    this.reconnectTimers = new Map();
    this.reconnectDelays = new Map();
    this.RECONNECT_DELAY = 15_000;

    // ── AUTO DISCOVERY ──────────────────────────────────────────────
    this.bootstrapUrls = [];
    this.discoveredPeers = new Set();
    this.discoveryInterval = null;
    this.heartbeatInterval = null;
    this.pendingPeerRequests = new Map();
    this.disconnectTimes = new Map();
    this.urlToNodeId = new Map();

    // ── LEADER ELECTION (PoS-based, leaderless) ─────────────────────────────
    // There is NO designated primary node. The block producer each slot is
    // determined by stake-weighted random selection (VRF / round-robin over
    // the active validator set). Any validator node can become the leader.
    // Nodes monitor each other's heartbeats; if the current slot leader is
    // silent for > PRIMARY_TIMEOUT ms, the next validator steps up.
    this.isPrimaryNode = false;       // set in listen() based on PoS validator rank
    this.primaryAlive = false;        // true when we recently heard a leader_heartbeat
    this.primaryLastSeen = 0;
    this.PRIMARY_TIMEOUT = 20_000;   // treat slot leader as timed-out after 20s
    this.leaderHeartbeatInterval = null;

    // ── SINGLE PEER SYNC CONTROL ───────────────────────────────────
    this.syncingFromPeerId = null;
    this.blockchain.isSyncing = false;
    this.lastSyncRequestTime = 0;
  }

  // ─── Server startup ─────────────────────────────────────────────────────────

  listen(httpServer = null) {
    try {
      if (httpServer) {
        this.wss = new WebSocketServer({
          server: httpServer,
          path: '/p2p',
          perMessageDeflate: {
            zlibDeflateOptions: { level: 6 },  // balanced speed vs. compression
            threshold: 1024                    // only compress frames > 1KB
          }
        });
        console.log('✅ P2P WebSocket attached to HTTP server at /p2p (compression: on)');
      } else if (this.port) {
        this.wss = new WebSocketServer({
          port: this.port,
          perMessageDeflate: {
            zlibDeflateOptions: { level: 6 },
            threshold: 1024
          }
        });
        console.log(`✅ P2P server on port ${this.port} (compression: on)`);
      } else {
        console.log('⚠️ P2P disabled — API-only mode');
        return;
      }

      // ── Decentralized PoS Leader Election ──────────────────────────────
      // No single primary URL host is hardcoded. Leader election is determined
      // dynamically by Proof-of-Stake on-chain validator selection.
      const primaryCfg = (process.env.PRIMARY_NODE_URL || '').toLowerCase();
      if (primaryCfg === 'self' || process.env.NODE_MODE === 'validator') {
        this.isPrimaryNode = true;
        console.log('👑 Dynamic Validator Mode: Node initialized for PoS consensus participation');
      } else {
        this.isPrimaryNode = true; // All nodes participate in PoS leader election selection
        console.log('🔄 Peer Node: Running in dynamic multi-node PoS consensus mode');
      }

      this.wss.on('connection', (ws, req) => {
        try {
          const ip = req.socket.remoteAddress;
          console.log(`🤝 Inbound peer from ${ip}`);
          this._handleInboundConnection(ws);
        } catch (e) {
          console.error('Error handling inbound connection:', e);
        }
      });

      this.wss.on('error', (err) => {
        try {
          console.error('❌ P2P WSS error:', err.message);
        } catch (e) {}
      });

      console.log(`📡 Node ID: ${this.nodeId}`);

      // ── Start auto-discovery ──────────────────────────────────────
      this._startDiscovery();

      // ── Start heartbeat pings ─────────────────────────────────────
      this._startHeartbeat();

      // ── Start leader heartbeat ────────────────────────────────────
      this._startLeaderHeartbeat();

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
    }, 60_000);

    // Initial discovery after 5 seconds
    setTimeout(() => this._discoverPeers(), 5000);
  }

  // ─── Heartbeat: keep connections alive ───────────────────────────────────────

  _startHeartbeat() {
    // Send a ping to every peer every 25 seconds to keep Render/Railway connections alive.
    // If a peer has not responded for > 180 seconds, it will be pruned by _discoverPeers.
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [peerId, peer] of this.peers.entries()) {
        if (peer.ws.readyState === 1 /* OPEN */) {
          try {
            this._send(peer.ws, { type: 'ping', timestamp: now });
            if (typeof peer.ws.ping === 'function') {
              peer.ws.ping();
            }
          } catch (e) {
            // ignore send errors — socket will be cleaned up naturally
          }
        } else if (peer.ws.readyState > 1 /* CLOSING / CLOSED */) {
          // Socket is already dead — remove immediately
          console.warn(`⚠️ Peer ${peerId} socket is dead (readyState=${peer.ws.readyState}). Removing.`);
          this.peers.delete(peerId);
          if (peer.url) {
            this.outboundUrls.delete(peer.url);
            if (!peer.isDuplicate && !peer.ws.isDuplicate) {
              if (!this.disconnectTimes.has(peer.url)) {
                this.disconnectTimes.set(peer.url, now);
              }
              this._scheduleReconnect(peer.url);
            }
          }
        }
      }
      
      // If no peers, produce blocks locally (solo mode)
      if (this.peers.size === 0 && this.canProduceBlocks() && this.blockchain && typeof this.blockchain.createBlock === 'function') {
        this.blockchain.createBlock().catch(err => console.error('Solo block production error:', err));
      }

      // Trigger sync verification to recover from any stalled syncs
      this.checkAndTriggerSync();
    }, 45_000);
  }

  async _discoverPeers() {
    try {
      // 0. Prune inactive connections (no message received for > 300 seconds)
      const now = Date.now();
      const INACTIVE_TIMEOUT = 300_000; // 300 seconds
      for (const [peerId, peer] of this.peers.entries()) {
        const inactiveDuration = now - peer.lastSeen;
        if (inactiveDuration > INACTIVE_TIMEOUT) {
          console.warn(`⚠️ Peer ${peerId} (${peer.url || 'inbound'}) is inactive for ${Math.round(inactiveDuration / 1000)}s. Terminating connection.`);
          try {
            if (peer.ws.terminate) {
              peer.ws.terminate();
            } else {
              peer.ws.close();
            }
          } catch (e) {}
          this.peers.delete(peerId);
          if (peer.url) {
            this.outboundUrls.delete(peer.url);
            if (!this.disconnectTimes.has(peer.url)) {
              this.disconnectTimes.set(peer.url, now);
            }
          }
        }
      }

      // 1. Ask all connected peers for their known peers
      this.broadcast({ type: 'get_peers' });

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

    if (this.selfUrls.has(url)) return;
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
        ws = new WebSocket(url, {
          perMessageDeflate: {
            zlibDeflateOptions: { level: 6 },
            threshold: 1024
          }
        });
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
        this.reconnectDelays.delete(url);
        this._handleOutboundConnection(ws, url);
      });

      ws.on('error', (err) => {
        try {
          clearTimeout(timeout);
          console.error(`❌ Peer ${url} error:`, err.message);
        } catch (e) {}
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        console.log(`🔌 Outbound peer closed: ${url}`);
        let isDuplicate = ws.isDuplicate;
        for (const [id, peer] of this.peers.entries()) {
          if (peer.url === url) {
            if (peer.isDuplicate) isDuplicate = true;
            this.peers.delete(id);
            break;
          }
        }
        if (isDuplicate) {
          console.log(`↔️ Not scheduling reconnect for duplicate peer connection to ${url}`);
          return;
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
    if (this.selfUrls.has(url)) return;
    if (this.reconnectTimers.has(url)) return;
    
    const currentDelay = this.reconnectDelays.get(url) || 15_000;
    const nextDelay = Math.min(currentDelay * 2, 120_000);
    this.reconnectDelays.set(url, nextDelay);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(url);
      this.outboundUrls.delete(url);
      this.connectToPeer(url);
    }, currentDelay);
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
    // NOTE: Do NOT call _requestBlocks here.
    // The handshake response will carry peer's chainHeight, and _handleHandshake
    // will trigger sync from the BEST available peer — not from every peer.
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
    // NOTE: Do NOT call _requestBlocks here.
    // The handshake response will carry peer's chainHeight, and _handleHandshake
    // will trigger sync from the BEST available peer — not from every peer.
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
          if (peer.isDuplicate || ws.isDuplicate) {
            console.log(`↔️ Not scheduling reconnect for duplicate peer connection to ${peer.url}`);
          } else {
            if (!this.disconnectTimes.has(peer.url)) {
              this.disconnectTimes.set(peer.url, Date.now());
            }
            this._scheduleReconnect(peer.url);
          }
        }
        this.peers.delete(peerId);
      }
    });

    ws.on('error', (err) => {
      try {
        console.error(`Peer ${peerId} socket error:`, err.message);
        this.peers.delete(peerId);
      } catch (e) {}
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

      case 'ping':
        this._handlePing(msg, peerId);
        break;

      case 'pong':
        // just update lastSeen (already done above)
        break;

      case 'leader_heartbeat':
        this._handleLeaderHeartbeat(msg, peerId);
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

  // ─── Ping / Pong ─────────────────────────────────────────────────────────────

  _handlePing(_msg, peerId) {
    const peer = this.peers.get(peerId);
    if (peer && peer.ws.readyState === 1) {
      this._send(peer.ws, { type: 'pong', timestamp: Date.now() });
    }
  }

  _isConnected(url) {
    const normUrl = normalizeUrl(url);
    if (!normUrl) return false;

    for (const peer of this.peers.values()) {
      if (peer.ws.readyState === WebSocket.OPEN) {
        if (peer.url && normalizeUrl(peer.url) === normUrl) {
          return true;
        }
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
      if (peer.url) {
        this.selfUrls.add(peer.url);
      }
      peer.ws.close();
      this.peers.delete(peerId);
      return;
    }

    // Map URL to nodeId if outbound URL exists or publicUrl is provided
    if (msg.publicUrl) {
      this.urlToNodeId.set(msg.publicUrl, msg.nodeId);
      if (!peer.url) {
        peer.url = msg.publicUrl;
      }
    }
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
            otherPeer.isDuplicate = true;
            if (otherPeer.ws) otherPeer.ws.isDuplicate = true;
            otherPeer.ws.close();
            this.peers.delete(otherId);
          } else {
            console.log(`↔️ Keeping old connection ${otherId} (initiated by ${otherPeerInitiator}) and closing new one ${peerId}`);
            if (peer.url && !otherPeer.url) {
              otherPeer.url = peer.url;
            }
            peer.isDuplicate = true;
            if (peer.ws) peer.ws.isDuplicate = true;
            peer.ws.close();
            this.peers.delete(peerId);
            return;
          }
        } else {
          console.log(`↔️ Keeping older connection ${otherId} and closing new one ${peerId}`);
          peer.isDuplicate = true;
          if (peer.ws) peer.ws.isDuplicate = true;
          peer.ws.close();
          this.peers.delete(peerId);
          return;
        }
      }
    }

    // Update peer's chain height so dashboard always shows accurate values
    peer.chainHeight = msg.chainHeight || peer.chainHeight || 0;

    const localHeight = this.blockchain.chain.length;
    const peerHeight  = msg.chainHeight || 0;

    if (peerHeight > localHeight) {
      // Coordinate and trigger sync from the single best peer, avoiding multi-peer redundant downloads
      this.checkAndTriggerSync();
    } else if (peerHeight < localHeight) {
      // Peer is behind — push our chain to help them catch up quickly.
      const fromIndex = Math.max(0, peerHeight);
      console.log(`📤 Peer is ${localHeight - peerHeight} blocks behind. Helping peer catch up from #${fromIndex}...`);
      this._send(peer.ws, { type: 'get_blocks', fromIndex });
    } else {
      // Same height — verify tip hashes match to detect silent forks.
      const ourTip = this.blockchain.chain[localHeight - 1];
      if (msg.tipHash && ourTip && msg.tipHash !== ourTip.hash) {
        console.warn(`⚠️ Same height (${localHeight}) but tip hash mismatch — possible fork. Requesting sync...`);
        this._send(peer.ws, { type: 'get_blocks', fromIndex: Math.max(0, localHeight - 10) });
      }
    }
  }

  _sendHandshake(ws) {
    const lastBlock = this.blockchain.chain[this.blockchain.chain.length - 1];
    this._send(ws, {
      type: 'handshake',
      nodeId: this.nodeId,
      chainHeight: this.blockchain.chain.length,
      chainId: this.blockchain.chainId,
      timestamp: Date.now(),
      publicUrl: getPublicP2PUrl(),
      tipHash: lastBlock ? lastBlock.hash : null,
    });
  }

  // ─── New block from peer ─────────────────────────────────────────────────────

  async _handleNewBlock(msg, peerId) {
    try {
      const blockData = msg.block;
      if (!blockData) return;

      const ourHeight = this.blockchain.chain.length;

      if (blockData.index < ourHeight) {
        const localBlock = await this.blockchain.getBlock(blockData.index);
        if (localBlock && localBlock.hash !== blockData.hash) {
          console.warn(`⚠️ Fork at block ${blockData.index}. Requesting sync from common ancestor...`);
          const peer = this.peers.get(peerId);
          if (peer) {
            const rollbackHeight = Math.max(0, blockData.index - 1);
            this._send(peer.ws, {
              type: 'get_blocks',
              fromIndex: rollbackHeight,
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

      const txLocationRaw = await this.blockchain.db.get(`tx:${tx.id}`).catch(() => null);
      if (txLocationRaw) return;

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

  _findPeerByWs(ws) {
    for (const peer of this.peers.values()) {
      if (peer.ws === ws) return peer;
    }
    return null;
  }

  _requestBlocks(ws) {
    const peer = this._findPeerByWs(ws);
    if (peer) {
      this.syncingFromPeerId = peer.id;
      this.blockchain.isSyncing = true;
      this.lastSyncRequestTime = Date.now();
    }
    this._send(ws, {
      type: 'get_blocks',
      fromIndex: this.blockchain.chain.length,
    });
  }

  checkAndTriggerSync() {
    const now = Date.now();
    const localHeight = this.blockchain.chain.length;

    // Skip P2P sync only if an archive sync is explicitly in progress
    // (indicated by blockchain.isSyncing=true AND no syncingFromPeerId set)
    // This prevents P2P and archive from racing each other.
    if (this.blockchain.isSyncing && !this.syncingFromPeerId) {
      // Safety net: if isSyncing has been set for > 120s with no peer activity,
      // force reset to prevent mining from being blocked forever.
      const stalledMs = now - this.lastSyncRequestTime;
      if (this.lastSyncRequestTime > 0 && stalledMs > 120_000) {
        console.warn(`⚠️ Sync stall detected (${Math.round(stalledMs/1000)}s). Force-resetting isSyncing flag.`);
        this.blockchain.isSyncing = false;
        this.syncingFromPeerId = null;
      } else {
        return;
      }
    }

    // Check if we are currently syncing from a valid peer and the timeout hasn't elapsed
    if (this.syncingFromPeerId) {
      const activeSyncPeer = this.peers.get(this.syncingFromPeerId);
      if (activeSyncPeer && activeSyncPeer.ws.readyState === WebSocket.OPEN && (now - this.lastSyncRequestTime) < 15000) {
        // Already active sync ongoing with a healthy peer, don't trigger another parallel request
        return;
      }
      // Stalled or disconnected peer - reset sync state
      this.syncingFromPeerId = null;
      this.blockchain.isSyncing = false;
    }

    // Find the single peer with the longest chain
    let bestPeer = null;
    let maxChainHeight = localHeight;

    for (const peer of this.peers.values()) {
      if (peer.ws.readyState === WebSocket.OPEN && peer.chainHeight > maxChainHeight) {
        maxChainHeight = peer.chainHeight;
        bestPeer = peer;
      }
    }

    if (bestPeer) {
      const gap = maxChainHeight - localHeight;
      console.log(`📥 Initiating sync with best peer ${bestPeer.id.slice(0, 8)} (${gap} blocks ahead, target height: ${maxChainHeight})`);
      this.syncingFromPeerId = bestPeer.id;
      this.blockchain.isSyncing = true;
      this.lastSyncRequestTime = now;
      this._requestBlocks(bestPeer.ws);
    }
  }

  async _handleGetBlocks(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const from = msg.fromIndex || 0;
    const ourHeight = this.blockchain.chain.length;
    const gap = ourHeight - from;

    // Adaptive batch sizing:
    //   gap > 100  → 1000 blocks per batch (fast catch-up, prevents data loss)
    //   gap <= 100 → 100 blocks per batch  (fine-grained, avoids conflicts near tip)
    const BATCH = gap > 100 ? 1000 : 100;
    const blocks = [];
    const limit = Math.min(ourHeight, from + BATCH);
    for (let i = from; i < limit; i++) {
      const block = await this.blockchain.getBlock(i);
      if (block) {
        blocks.push(block);
      }
    }

    if (!blocks.length) return;

    const batch = blocks.map(b => b.toJSON ? b.toJSON() : b);
    console.log(`📤 Sending ${batch.length} blocks to peer ${peerId.slice(0,8)} (gap=${gap}, from=#${from})`);
    this._send(peer.ws, { type: 'blocks', blocks: batch });
  }

  async _handleBlocks(msg, peerId) {
    const blocks = msg.blocks;
    if (!Array.isArray(blocks) || !blocks.length) return;

    if (this.blockchain.isSyncing && !this.syncingFromPeerId) {
      // Archive sync is active — but check if it's stalled (>120s)
      const stalledMs = Date.now() - this.lastSyncRequestTime;
      if (this.lastSyncRequestTime === 0 || stalledMs < 120_000) {
        // Archive sync is genuinely running, skip to avoid race conditions
        return;
      }
      // Stalled archive sync — force-reset and let blocks through
      console.warn(`\u26a0\ufe0f Archive sync stalled (${Math.round(stalledMs/1000)}s). Allowing incoming blocks through.`);
      this.blockchain.isSyncing = false;
    }

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
          // Block is behind our tip — check for fork
          const localBlock = await this.blockchain.getBlock(blockData.index);
          if (localBlock && localBlock.hash !== blockData.hash) {
            console.warn(`⚠️ Fork detected at block #${blockData.index}`);
            // Only rollback if peer has a significantly longer chain (>5 blocks ahead)
            // and we haven't exceeded max rollback attempts
            if (peer && peer.chainHeight > ourHeight + 5 && !peer._rollbackDone) {
              const rollbackHeight = Math.max(0, blockData.index - 1);
              console.log(`🔄 Peer has longer chain (${peer.chainHeight} > ${ourHeight}). Rolling back to #${rollbackHeight}...`);
              peer._rollbackDone = true; // Prevent repeated rollbacks from same peer
              await this.blockchain._rollbackToHeight(rollbackHeight);
              this._send(peer.ws, { type: 'get_blocks', fromIndex: rollbackHeight });
              this.syncQueue = [];
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
            // Reset rollback guard on success — peer is giving us valid blocks again
            if (peer) peer._rollbackDone = false;
          } else {
            console.warn(`⚠️ addBlock rejected #${blockData.index}`);
            // Don't rollback on rejection — it causes infinite loops.
            // Instead, just request a fresh sync batch from current height.
            // This handles stateRoot mismatches gracefully without getting stuck.
            if (peer && peer.ws.readyState === 1) {
              console.log(`🔄 Requesting fresh sync from height ${ourHeight} without rollback...`);
              this._send(peer.ws, { type: 'get_blocks', fromIndex: ourHeight });
            }
            this.syncQueue = [];
            return;
          }
          continue;
        }

        console.log(`⚠️ Gap: have ${ourHeight}, next is ${blockData.index}`);
        if (peer) this._requestBlocks(peer.ws);
        this.syncQueue = [];
        return;
      }

      if (imported > 0) {
        console.log(`✅ Synced ${imported} blocks. New height: ${this.blockchain.chain.length}`);
        this._broadcastHandshake();

        // ── Reward peer reputation for contributing blocks to our sync ────────
        // Each peer that sends us valid blocks earns 2 reputation points per block.
        // Tracked locally on the P2P peer object to avoid mutating block state.
        if (peer) {
          const reputationDelta = imported * 2;
          peer.reputation = (peer.reputation || 0) + reputationDelta;
          const pid = peer.nodeId ? peer.nodeId.slice(0, 8) : 'peer';
          console.log(`⭐ Peer ${pid} earned +${reputationDelta} reputation for syncing ${imported} blocks (total: ${peer.reputation})`);
        }
      }

      // Pipeline: immediately request next batch if we're still behind peer.
      // This prevents data loss — we keep pulling until fully caught up.
      if (peer && peer.ws.readyState === 1 /* OPEN */) {
        const remaining = (peer.chainHeight || 0) - this.blockchain.chain.length;
        if (remaining > 0) {
          console.log(`📥 Still ${remaining} blocks behind peer ${peerId.slice(0,8)}. Requesting next batch...`);
          this.blockchain.isSyncing = true;
          this._requestBlocks(peer.ws);
        } else {
          this.syncingFromPeerId = null;
          this.blockchain.isSyncing = false;
          if (this.blockchain.archiveWriter) {
            this.blockchain.archiveWriter.schedulePendingChunk(1000);
          }
        }
      } else {
        this.syncingFromPeerId = null;
        this.blockchain.isSyncing = false;
        if (this.blockchain.archiveWriter) {
          this.blockchain.archiveWriter.schedulePendingChunk(1000);
        }
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
        try {
          peer.ws.send(data);
        } catch (e) {
          console.warn(`Failed to send broadcast to peer: ${e.message}`);
        }
      }
    }
  }

  _broadcastExcept(message, excludePeerId) {
    const data = JSON.stringify(message);
    for (const [id, peer] of this.peers.entries()) {
      if (id !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
        try {
          peer.ws.send(data);
        } catch (e) {
          console.warn(`Failed to send broadcastExcept to peer ${id}: ${e.message}`);
        }
      }
    }
  }

  _broadcastHandshake() {
    for (const peer of this.peers.values()) {
      if (peer.ws.readyState === WebSocket.OPEN) {
        try {
          this._sendHandshake(peer.ws);
        } catch (e) {
          console.warn(`Failed to send handshake to peer: ${e.message}`);
        }
      }
    }
  }

  _send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ─── Leader Election (PoS-based, leaderless) ─────────────────────────────
  //
  // There is NO hardcoded primary node. The block-producing slot leader is
  // chosen each slot by stake-weighted random selection over the active validator
  // set. Standby validators monitor the current leader via leader_heartbeat.
  // If the leader is silent for > PRIMARY_TIMEOUT ms, any standby validator
  // with sufficient stake may step up and produce the next block.

  _startLeaderHeartbeat() {
    if (this.isPrimaryNode) {
      // Primary broadcasts its heartbeat every 4s so standbys know it's alive.
      this.leaderHeartbeatInterval = setInterval(() => {
        this.broadcast({
          type: 'leader_heartbeat',
          nodeId: this.nodeId,
          height: this.blockchain.chain.length,
          timestamp: Date.now(),
          isPrimary: true,
        });
      }, 4_000);
      console.log('👑 Primary heartbeat broadcaster started (4s interval)');
    } else {
      // Standby: check primary liveness every 5s.
      this.leaderHeartbeatInterval = setInterval(() => {
        const elapsed = Date.now() - this.primaryLastSeen;
        const wasPrimaryAlive = this.primaryAlive;
        this.primaryAlive = this.primaryLastSeen > 0 && elapsed < this.PRIMARY_TIMEOUT;

        if (wasPrimaryAlive && !this.primaryAlive) {
          console.warn(`⚠️ PRIMARY silent for ${Math.round(elapsed / 1000)}s — STANDBY taking over block production`);
        } else if (!wasPrimaryAlive && this.primaryAlive) {
          console.log('✅ PRIMARY is back online — stepping down from block production');
        }
      }, 5_000);
    }
  }

  _handleLeaderHeartbeat(msg, peerId) {
    const peer = this.peers.get(peerId);
    this.primaryLastSeen = Date.now();
    this.primaryAlive = true;

    // If peer is ahead, immediately request missing blocks regardless of host domain.
    if (peer && msg.height > this.blockchain.chain.length) {
      console.log(`📡 Peer ${peerId} at height ${msg.height}, local chain at ${this.blockchain.chain.length}. Syncing...`);
      this._requestBlocks(peer.ws);
    }
  }

  // Returns whether this node is eligible to produce a block for the current slot
  // evaluated against on-chain Proof-of-Stake validator state.
  canProduceBlocks() {
    if (!this.blockchain) return true;
    const lastBlock = this.blockchain.getLastBlock();
    if (!lastBlock) return true;
    
    // Evaluate validator selection for current slot
    let selectedValidator = null;
    try {
      selectedValidator = this.blockchain.pos.selectValidator(lastBlock.hash);
    } catch (e) {
      selectedValidator = null;
    }
    
    if (!selectedValidator) return true; // Default fallback if no validators staked yet
    
    // Check if local node address matches selected validator address
    const localValidatorAddress = this.blockchain.config.validatorAddress || process.env.VALIDATOR_ADDRESS;
    if (localValidatorAddress && selectedValidator) {
      return localValidatorAddress.toLowerCase() === selectedValidator.toLowerCase();
    }
    
    return true; // Single node / dev mode default
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
      mode: this.isPrimaryNode ? 'primary-validator' : 'standby-validator',
      discovered: this.discoveredPeers.size,
      isPrimary: this.isPrimaryNode,
      primaryAlive: this.primaryAlive,
    };
  }

  close() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.leaderHeartbeatInterval) {
      clearInterval(this.leaderHeartbeatInterval);
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