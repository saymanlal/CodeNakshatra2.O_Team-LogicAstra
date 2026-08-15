import crypto from 'crypto';

class PeerManager {
  constructor(nodeId, chainId, version) {
    this.nodeId = nodeId;
    this.chainId = chainId;
    this.version = version;
    this.peers = new Map(); // nodeId -> peer info
    this.maxPeers = 50;
    this.reputationScores = new Map(); // nodeId -> score (0 to 100)
    this.bannedPeers = new Set(); // banned nodeIds / IPs
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

  getReputation(nodeId) {
    return this.reputationScores.get(nodeId) ?? 50; // default initial score: 50
  }

  adjustReputation(nodeId, delta) {
    const current = this.getReputation(nodeId);
    const updated = Math.max(0, Math.min(100, current + delta));
    this.reputationScores.set(nodeId, updated);
    if (updated <= 0) {
      console.log(`⛔ Peer ${nodeId} reputation dropped to 0. Banning peer...`);
      this.bannedPeers.add(nodeId);
      this.removePeer(nodeId);
    }
    return updated;
  }

  addPeer(socket, nodeId, ip, port, chainId, version, pubKey = null, transport = 'websocket') {
    if (this.bannedPeers.has(nodeId) || this.bannedPeers.has(ip)) {
      console.log(`❌ Rejected banned peer: ${nodeId} (${ip})`);
      return false;
    }

    // Validate chain ID
    if (chainId !== this.chainId) {
      console.log(`❌ Rejected peer ${nodeId} - wrong chain ID: ${chainId}`);
      this.adjustReputation(nodeId, -20);
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
      pubKey,
      transport,
      socket,
      lastSeen: Date.now(),
      connected: true,
      score: this.getReputation(nodeId)
    };

    this.peers.set(nodeId, peer);
    this.adjustReputation(nodeId, 5); // reward successful handshake
    console.log(`✓ Connected to peer: ${nodeId} (${ip}:${port}) via ${transport} - Chain: ${chainId} | Rep: ${this.getReputation(nodeId)}`);
    
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