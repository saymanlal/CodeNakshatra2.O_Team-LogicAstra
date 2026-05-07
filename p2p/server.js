import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';

export class P2PServer {
  constructor(blockchain, port = null) {
    this.blockchain = blockchain;
    this.port = port;
    this.peers = new Map();
    this.wss = null;
    this.nodeId = crypto.randomBytes(16).toString('hex');
  }

  normalizePeerUrl(address) {
    if (!address) {
      return null;
    }

    if (address.startsWith('ws://') || address.startsWith('wss://')) {
      return address;
    }

    return `ws://${address}/p2p`;
  }

  listen(httpServer = null) {
    try {
      if (httpServer) {
        this.wss = new WebSocketServer({ 
          server: httpServer,
          path: '/p2p'
        });
        console.log('✅ P2P WebSocket attached to HTTP server at /p2p');
      } else if (this.port) {
        this.wss = new WebSocketServer({ port: this.port });
        console.log(`✅ P2P server on port ${this.port}`);
      } else {
        console.log('⚠️  P2P disabled - API only mode');
        return;
      }

      this.wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        console.log(`🤝 P2P peer from ${ip}`);
        this.handleConnection(ws);
      });

      this.wss.on('error', (error) => {
        console.error('❌ P2P error:', error.message);
      });

      console.log(`📡 Node ID: ${this.nodeId}`);

    } catch (error) {
      console.error('❌ P2P startup failed:', error.message);
      console.log('📡 API-only mode');
    }
  }

  handleConnection(ws) {
    const peerId = crypto.randomBytes(8).toString('hex');
    
    this.peers.set(peerId, {
      ws,
      id: peerId,
      lastSeen: Date.now(),
      chainHeight: 0
    });

    console.log(`👤 Peer ${peerId} connected (Total: ${this.peers.size})`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message, peerId);
      } catch (error) {
        console.error('P2P message error:', error);
      }
    });

    ws.on('close', () => {
      console.log(`👋 Peer ${peerId} disconnected`);
      this.peers.delete(peerId);
    });

    ws.on('error', (error) => {
      console.error(`Peer ${peerId} error:`, error.message);
      this.peers.delete(peerId);
    });

    this.sendMessage(ws, {
      type: 'handshake',
      nodeId: this.nodeId,
      chainHeight: this.blockchain.chain.length,
      timestamp: Date.now()
    });

    this.syncWithPeer(ws);
  }

  handleMessage(message, peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }

    switch (message.type) {
      case 'handshake':
        console.log(`🤝 Handshake from ${message.nodeId}, height: ${message.chainHeight}`);
        if (peer) {
          peer.nodeId = message.nodeId;
          peer.chainHeight = message.chainHeight;
        }
        break;

      case 'new_block':
        console.log(`📦 New block from peer ${peerId}`);
        this.blockchain.addBlock(message.block);
        break;

      case 'new_transaction':
        console.log(`💸 New transaction from peer ${peerId}`);
        this.blockchain.addTransaction(message.transaction);
        break;

      case 'get_blocks':
        this.handleGetBlocks(message, peerId);
        break;

      case 'blocks':
        this.handleBlocks(message.blocks);
        break;

      default:
        console.log(`Unknown P2P message: ${message.type}`);
    }
  }

  handleGetBlocks(message, peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    const blocks = this.blockchain.chain.slice(message.fromIndex || 0);
    this.sendMessage(peer.ws, {
      type: 'blocks',
      blocks: blocks.map(b => b.toJSON())
    });
  }

  handleBlocks(blocks) {
    console.log(`📚 Received ${blocks.length} blocks for sync`);
  }

  syncWithPeer(ws) {
    this.sendMessage(ws, {
      type: 'get_blocks',
      fromIndex: this.blockchain.chain.length
    });
  }

  broadcastBlock(block) {
    if (!this.wss) return;
    
    this.broadcast({
      type: 'new_block',
      block: block.toJSON()
    });
  }

  broadcastTransaction(transaction) {
    if (!this.wss) return;
    
    this.broadcast({
      type: 'new_transaction',
      transaction
    });
  }

  broadcast(message) {
    if (!this.wss) return;
    
    const data = JSON.stringify(message);
    this.peers.forEach(peer => {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(data);
      }
    });
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  connectToPeer(url) {
    try {
      const peerUrl = this.normalizePeerUrl(url);
      console.log(`🔗 Connecting to peer: ${peerUrl}`);
      const ws = new WebSocket(peerUrl);

      ws.on('open', () => {
        console.log(`✅ Connected to peer: ${peerUrl}`);
        this.handleConnection(ws);
      });

      ws.on('error', (error) => {
        console.error(`❌ Peer connection failed ${peerUrl}:`, error.message);
      });

    } catch (error) {
      console.error(`Peer connection error ${url}:`, error);
    }
  }

  getStats() {
    return {
      nodeId: this.nodeId,
      peers: this.peers.size,
      enabled: !!this.wss,
      peerList: Array.from(this.peers.values()).map(p => ({
        id: p.id,
        nodeId: p.nodeId,
        chainHeight: p.chainHeight,
        lastSeen: p.lastSeen
      }))
    };
  }

  // ✅ ADD THIS MISSING METHOD
  getNetworkStats() {
    return {
      nodeId: this.nodeId,
      peers: this.peers.size,
      enabled: !!this.wss,
      peerList: Array.from(this.peers.values()).map(p => ({
        id: p.id,
        nodeId: p.nodeId,
        chainHeight: p.chainHeight,
        lastSeen: p.lastSeen
      })),
      mode: 'validator'
    };
  }

  close() {
    if (this.wss) {
      this.peers.forEach(peer => {
        peer.ws.close();
      });
      this.wss.close();
      console.log('🔌 P2P server closed');
    }
  }
}
