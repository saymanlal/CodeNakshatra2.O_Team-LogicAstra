import crypto from 'crypto';

class PeerManager {
  constructor(nodeId, chainId, version) {
    this.nodeId = nodeId;
    this.chainId = chainId;
    this.version = version;
    this.peers = new Map(); // nodeId -> peer info
    this.maxPeers = 50;
    this.peerTimeout = 60000; // 60 seconds
    this.cleanupInterval = null;
  }

  start() {
    // Cleanup stale peers every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePeers();
    }, 30000);
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  addPeer(socket, nodeId, ip, port, chainId, version) {
    // Validate chain ID
    if (chainId !== this.chainId) {
      console.log(`❌ Rejected peer ${nodeId} - wrong chain ID: ${chainId}`);
      return false;
    }

    // Check max peers
    if (this.peers.size >= this.maxPeers && !this.peers.has(nodeId)) {
      console.log(`❌ Rejected peer ${nodeId} - max peers reached`);
      return false;
    }

    const peer = {
      nodeId,
      ip,
      port,
      chainId,
      version,
      socket,
      lastSeen: Date.now(),
      connected: true
    };

    this.peers.set(nodeId, peer);
    console.log(`✓ Connected to peer: ${nodeId} (${ip}:${port}) - Chain: ${chainId}`);
    
    return true;
  }

  removePeer(nodeId) {
    const peer = this.peers.get(nodeId);
    if (peer) {
      peer.connected = false;
      try {
        if (peer.socket && (peer.socket.readyState === 1 || peer.socket.readyState === 0)) {
          peer.socket.close();
        }
      } catch (err) {}
      this.peers.delete(nodeId);
      console.log(`✗ Disconnected from peer: ${nodeId}`);
    }
  }

  updatePeerActivity(nodeId) {
    const peer = this.peers.get(nodeId);
    if (peer) {
      peer.lastSeen = Date.now();
    }
  }

  cleanupStalePeers() {
    const now = Date.now();
    const staleNodeIds = [];

    for (const [nodeId, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > this.peerTimeout) {
        staleNodeIds.push(nodeId);
      }
    }

    staleNodeIds.forEach(nodeId => {
      console.log(`⚠ Removing stale peer: ${nodeId}`);
      this.removePeer(nodeId);
    });
  }

  getPeerList() {
    return Array.from(this.peers.values()).map(peer => ({
      nodeId: peer.nodeId,
      ip: peer.ip,
      port: peer.port,
      chainId: peer.chainId,
      version: peer.version,
      lastSeen: peer.lastSeen
    }));
  }

  getActivePeers() {
    return Array.from(this.peers.values()).filter(p => p.connected);
  }

  broadcast(message, excludeNodeId = null) {
    let sent = 0;
    for (const peer of this.peers.values()) {
      if (peer.connected && peer.nodeId !== excludeNodeId && peer.socket.readyState === 1) {
        try {
          peer.socket.send(JSON.stringify(message));
          sent++;
        } catch (error) {
          console.error(`Error broadcasting to ${peer.nodeId}:`, error.message);
        }
      }
    }
    return sent;
  }

  sendToPeer(nodeId, message) {
    const peer = this.peers.get(nodeId);
    if (peer && peer.connected && peer.socket.readyState === 1) {
      try {
        peer.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending to ${nodeId}:`, error.message);
        return false;
      }
    }
    return false;
  }

  getPeerCount() {
    return this.peers.size;
  }

  static generateNodeId() {
    return crypto.randomBytes(16).toString('hex');
  }
}

export default PeerManager;