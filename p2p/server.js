import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';
import Block from '../core/block.js';

export class P2PServer {
  constructor(blockchain, port = null) {
    this.blockchain = blockchain;
    this.port = port;
    this.peers = new Map();      // peerId (local) → peer object
    this.wss = null;
    this.nodeId = crypto.randomBytes(16).toString('hex');
    this.isSyncing = false;

    // Track outbound URLs to avoid duplicate connections and enable reconnect
    this.outboundUrls = new Set();
    this.reconnectTimers = new Map();
    this.RECONNECT_DELAY = 15_000; // 15s
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
        console.log('⚠️  P2P disabled — API-only mode');
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
    } catch (err) {
      console.error('❌ P2P startup failed:', err.message);
      console.log('📡 API-only mode');
    }
  }

  // ─── Bootstrap: connect to known peers on startup ───────────────────────────

  connectToBootstrapPeers(urls = []) {
    if (!urls.length) return;
    console.log(`\n🔗 Connecting to ${urls.length} bootstrap peer(s)...`);
    urls.forEach(url => this.connectToPeer(url));
  }

  // ─── Outbound connection (we initiate) ──────────────────────────────────────

  connectToPeer(url) {
    if (this.outboundUrls.has(url)) return; // already connecting / connected
    this.outboundUrls.add(url);

    const attempt = () => {
      // Skip if we're already connected to this URL
      for (const peer of this.peers.values()) {
        if (peer.url === url && peer.ws.readyState === WebSocket.OPEN) return;
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

      ws.on('open', () => {
        console.log(`✅ Connected to peer: ${url}`);
        this._handleOutboundConnection(ws, url);
      });

      ws.on('error', (err) => {
        console.error(`❌ Peer ${url} error:`, err.message);
      });

      ws.on('close', () => {
        console.log(`🔌 Outbound peer closed: ${url}`);
        // Remove from peers map so reconnect can re-register
        for (const [id, peer] of this.peers.entries()) {
          if (peer.url === url) {
            this.peers.delete(id);
            break;
          }
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
    console.log(`🔄 Will retry ${url} in ${this.RECONNECT_DELAY / 1000}s`);
  }

  // ─── Inbound connection handler (they connected to us) ──────────────────────

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

  // ─── Outbound connection handler (we connected to them) ─────────────────────

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
      console.log(`👋 Peer ${peerId} disconnected`);
      this.peers.delete(peerId);
      // If inbound, nothing to reconnect. Outbound reconnect is on the ws close handler above.
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

      default:
        // silently ignore unknown messages
    }
  }

  // ─── Handshake ──────────────────────────────────────────────────────────────

  async _handleHandshake(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.nodeId      = msg.nodeId;
    peer.chainHeight = msg.chainHeight || 0;
    peer.chainId     = msg.chainId;

    console.log(`🤝 Handshake: node=${msg.nodeId?.slice(0, 8)} height=${msg.chainHeight} chainId=${msg.chainId}`);

    // Chain ID mismatch — reject peer
    if (msg.chainId && this.blockchain.chainId && msg.chainId !== this.blockchain.chainId) {
      console.warn(`⚠️  Chain ID mismatch (${msg.chainId} ≠ ${this.blockchain.chainId}). Closing.`);
      peer.ws.close();
      this.peers.delete(peerId);
      return;
    }

    // If they have a longer chain, request their blocks
    if (msg.chainHeight > this.blockchain.chain.length) {
      console.log(`📥 Peer is ahead (${msg.chainHeight} > ${this.blockchain.chain.length}). Syncing...`);
      this._requestBlocks(peer.ws);
    }
  }

  _sendHandshake(ws) {
    this._send(ws, {
      type:        'handshake',
      nodeId:      this.nodeId,
      chainHeight: this.blockchain.chain.length,
      chainId:     this.blockchain.chainId,
      timestamp:   Date.now(),
    });
  }

  // ─── New block from peer ─────────────────────────────────────────────────────

  async _handleNewBlock(msg, peerId) {
    try {
      const blockData = msg.block;
      if (!blockData) return;

      const ourHeight = this.blockchain.chain.length;

      // Block we already have
      if (blockData.index < ourHeight) return;

      // Next sequential block — try to append
      if (blockData.index === ourHeight) {
        const block = await Block.fromJSON(blockData);
        const added = await this.blockchain.addBlock(block);
        if (added) {
          const peer = this.peers.get(peerId);
          if (peer) {
            peer.chainHeight = Math.max(
              peer.chainHeight || 0,
              block.index + 1
            );
          }
          console.log(`📦 Accepted block #${block.index} from peer ${peerId}`);
          // Re-broadcast to other peers (flood)
          this._broadcastExcept({ type: 'new_block', block: blockData }, peerId);
        }
        return;
      }

      // They're ahead — trigger full sync
      const peer = this.peers.get(peerId);
      if (peer) {
        console.log(`📥 Peer ${peerId} ahead (${blockData.index} > ${ourHeight - 1}). Requesting sync...`);
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

      // Already in mempool
      const mempoolDuplicate = this.blockchain.mempool.some(
        existing => existing.id === tx.id
      );

      if (mempoolDuplicate) {
        return;
      }

      // Already confirmed on-chain
      const chainDuplicate = this.blockchain.chain.some(block =>
        block.transactions.some(existing => existing.id === tx.id)
      );

      if (chainDuplicate) {
        return;
      }

      this.blockchain.mempool.push(tx);

    } catch (err) {
      console.error(
        `❌ Failed to process tx from peer ${peerId}:`,
        err.message
      );
    }
  }

  // ─── Block request / response ────────────────────────────────────────────────

  _requestBlocks(ws) {
    this._send(ws, {
      type:      'get_blocks',
      fromIndex: Math.max(0, this.blockchain.chain.length - 1),
    });
  }

  _handleGetBlocks(msg, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const from   = msg.fromIndex || 0;
    const blocks = this.blockchain.chain.slice(from);

    if (!blocks.length) return;

    // Send in batches of 50 to avoid giant messages
    const BATCH = 50;
    for (let i = 0; i < blocks.length; i += BATCH) {
      const batch = blocks.slice(i, i + BATCH).map(b => b.toJSON ? b.toJSON() : b);
      this._send(peer.ws, { type: 'blocks', blocks: batch });
    }
  }

  async _handleBlocks(msg, peerId) {
    const blocks = msg.blocks;
    if (!Array.isArray(blocks) || !blocks.length) return;
    if (this.isSyncing) return;

    this.isSyncing = true;
    console.log(`📚 Received ${blocks.length} blocks from peer ${peerId}`);

    try {
      let imported = 0;

      for (const blockData of blocks) {
        const ourHeight = this.blockchain.chain.length;

        // Already have this block
        if (blockData.index < ourHeight) {
          // Verify it matches — if not, we have a fork
          const ours = this.blockchain.chain[blockData.index];
          if (ours && ours.hash !== blockData.hash) {
            console.warn(`⚠️  Fork detected at block ${blockData.index}. Peer hash differs.`);
            // If peer chain is longer, we'll sync via replaceChain
            const peer = this.peers.get(peerId);
            if (peer && peer.chainHeight > this.blockchain.chain.length) {
              console.log('🔄 Peer has longer chain. Requesting full sync...');
              this._requestBlocks(peer.ws);
            }
          }
          continue;
        }

        // Next block in sequence
        if (blockData.index === ourHeight) {
          const block = await Block.fromJSON(blockData);
          const added = await this.blockchain.addBlock(block);
          if (added) {
            imported++;
          } else {
            console.warn(`⚠️  addBlock rejected block #${blockData.index}`);
            break; // stop processing if a block is invalid
          }
          continue;
        }

        // Gap — request missing blocks
        console.log(`⚠️  Gap: we have ${ourHeight}, next block is ${blockData.index}. Re-requesting...`);
        const peer = this.peers.get(peerId);
        if (peer) this._requestBlocks(peer.ws);
        break;
      }

      if (imported > 0) {
        console.log(`✅ Synced ${imported} blocks. New height: ${this.blockchain.chain.length}`);
        // Advertise updated height to all peers
        this._broadcastHandshake();
      }
    } catch (err) {
      console.error('❌ _handleBlocks error:', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  // ─── Broadcast helpers ───────────────────────────────────────────────────────

  broadcastBlock(block) {
    this.broadcast({
      type:  'new_block',
      block: block.toJSON ? block.toJSON() : block,
    });
    // Also update our handshake height advertised to peers
    this._broadcastHandshake();
  }

  broadcastTransaction(transaction) {
    this.broadcast({
      type:        'new_transaction',
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

  // ─── Legacy public aliases (used by server.js / routes.js) ──────────────────

  /** @deprecated use connectToBootstrapPeers */
  connectToPeerLegacy(url) { this.connectToPeer(url); }

  getStats() {
    return {
      nodeId:   this.nodeId,
      peers:    this.peers.size,
      enabled:  !!this.wss,
      peerList: Array.from(this.peers.values()).map(p => ({
        id:          p.id,
        nodeId:      p.nodeId,
        chainHeight: p.chainHeight,
        lastSeen:    p.lastSeen,
        url:         p.url,
      })),
    };
  }

  getNetworkStats() {
    return {
      ...this.getStats(),
      mode: 'validator',
    };
  }

  close() {
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