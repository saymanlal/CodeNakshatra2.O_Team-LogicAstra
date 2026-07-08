/**
 * SAYMAN SDK Client — Phase 9 (fixed)
 *
 * This version is rewired to match the ACTUAL routes registered in
 * api/routes.js. The previous version called endpoints that do not
 * exist on the server (/api/account/*, /api/transactions, /api/events,
 * /api/reputation/*, /api/reports) and would 404 on every call.
 *
 * Real endpoints used below:
 *   GET  /api/address/:address          (balance, stake, nonce, tx history)
 *   POST /api/broadcast                 (submit a signed transaction)
 *   GET  /api/contracts/:address        (full contract object incl. state)
 *   GET  /api/contracts                 (registry of all contracts)
 *   GET  /api/stats                     (chain stats)
 *   GET  /api/block/:index              (single block)
 *
 * Usage (from any external repo):
 *
 *   import { SaymanClient } from '@sayman/sdk';
 *   const client = new SaymanClient({ rpcUrl: 'http://localhost:10000' });
 *
 *   const address = await client.deployContract({ name, version, code, wallet });
 *   const result  = await client.callContract({ contractAddress, method, args, wallet });
 *   const value   = await client.readState(contractAddress, key);
 */

import crypto from 'crypto';

class SaymanClient {
  /**
   * @param {object} options
   * @param {string|string[]} options.rpcUrl - e.g. 'http://localhost:10000' or an array/list of endpoints
   */
  constructor({ rpcUrl, rpcUrls } = {}) {
    let urls = [];
    if (Array.isArray(rpcUrls)) {
      urls = rpcUrls;
    } else if (Array.isArray(rpcUrl)) {
      urls = rpcUrl;
    } else if (rpcUrl) {
      urls = rpcUrl.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (urls.length === 0) {
      urls = ['http://localhost:10000', 'https://sayman.up.railway.app', 'https://sayman.onrender.com'];
    }
    this.rpcUrls = urls.map(u => u.replace(/\/$/, ''));
    this.activeUrlIndex = 0;
  }

  // ─── Internal fetch helpers ─────────────────────────────────────────────────

  async _post(endpoint, body) {
    let lastError = new Error('No working peers');
    for (let i = 0; i < this.rpcUrls.length; i++) {
      const idx = (this.activeUrlIndex + i) % this.rpcUrls.length;
      const baseUrl = this.rpcUrls[idx];
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
          this.activeUrlIndex = idx;
          return data;
        }
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ SDK: Peer ${baseUrl} failed: ${err.message}. Trying next...`);
      }
    }
    throw lastError;
  }

  async _get(endpoint) {
    let lastError = new Error('No working peers');
    for (let i = 0; i < this.rpcUrls.length; i++) {
      const idx = (this.activeUrlIndex + i) % this.rpcUrls.length;
      const baseUrl = this.rpcUrls[idx];
      try {
        const res = await fetch(`${baseUrl}${endpoint}`);
        const data = await res.json();
        if (res.ok) {
          this.activeUrlIndex = idx;
          return data;
        }
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ SDK: Peer ${baseUrl} failed: ${err.message}. Trying next...`);
      }
    }
    throw lastError;
  }

  // ─── Wallet helpers ────────────────────────────────────────────────────────

  /** Get current nonce for an address. Uses the real /api/address/:address route. */
  async getNonce(address) {
    const data = await this._get(`/api/address/${address}`);
    return data.nonce || 0;
  }

  /** Get SAYN balance (in base units). */
  async getBalance(address) {
    const data = await this._get(`/api/address/${address}`);
    return data.balance || 0;
  }

  /** Full account info: balance, stake, nonce, unstaking status, tx history. */
  async getAccount(address) {
    return await this._get(`/api/address/${address}`);
  }

  // ─── Contract deployment ───────────────────────────────────────────────────

  /**
   * Deploy a JavaScript smart contract to SAYMAN.
   *
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.version
   * @param {string} options.code       - full JS source of the contract
   * @param {string[]} [options.abi]
   * @param {'user'|'sponsor'|'free'} [options.feePolicy] - default 'user'
   * @param {object} options.wallet     - object with .address, .publicKey, .sign(hash)
   * @param {number} [options.gasLimit] - default 200000 (matches CONTRACT_DEPLOY base cost)
   * @param {number} [options.gasPrice] - default 1
   * @returns {Promise<string>} txId (contract address is derived server-side; fetch via getContractRegistry)
   */
  async deployContract({ name, version, code, abi, feePolicy, wallet, gasLimit = 200000, gasPrice = 1 }) {
    const nonce = await this.getNonce(wallet.address);

    const txData = {
      type: 'CONTRACT_DEPLOY',
      data: {
        from:      wallet.address,
        name:      name    || 'UnnamedContract',
        version:   version || '1.0.0',
        abi:       abi     || [],
        feePolicy: feePolicy || 'user',
        code
      },
      timestamp: Date.now(),
      nonce,
      gasLimit,
      gasPrice
    };

    return await this._broadcast(txData, wallet);
  }

  /**
   * Call a deployed contract method (state-changing).
   *
   * @param {object} options
   * @param {string} options.contractAddress
   * @param {string} options.method
   * @param {object} [options.args]
   * @param {object} options.wallet
   * @param {number} [options.gasLimit] - default 50000
   * @param {number} [options.gasPrice] - default 1
   */
  async callContract({ contractAddress, method, args, wallet, gasLimit = 50000, gasPrice = 1 }) {
    const nonce = await this.getNonce(wallet.address);

    const txData = {
      type: 'CONTRACT_CALL',
      data: {
        from: wallet.address,
        contractAddress,
        method,
        args: args || {}
      },
      timestamp: Date.now(),
      nonce,
      gasLimit,
      gasPrice
    };

    return await this._broadcast(txData, wallet);
  }

  /**
   * Send a plain SAYN transfer.
   */
  async transfer({ to, amount, wallet, gasLimit = 21000, gasPrice = 1 }) {
    const nonce = await this.getNonce(wallet.address);

    const txData = {
      type: 'TRANSFER',
      data: { from: wallet.address, to, amount },
      timestamp: Date.now(),
      nonce,
      gasLimit,
      gasPrice
    };

    return await this._broadcast(txData, wallet);
  }

  /**
   * Read contract state. There is no dedicated per-key state route on the
   * server, so this fetches the full contract object and reads the key
   * client-side.
   *
   * @param {string} contractAddress
   * @param {string} key
   */
  async readState(contractAddress, key) {
    const contract = await this._get(`/api/contracts/${contractAddress}`);
    return contract?.state?.[key];
  }

  /** Read all contract state. */
  async readAllState(contractAddress) {
    const contract = await this._get(`/api/contracts/${contractAddress}`);
    return contract?.state || {};
  }

  // ─── Registry / chain data ──────────────────────────────────────────────────

  async getContractRegistry() {
    const data = await this._get('/api/contracts');
    return data.contracts || [];
  }

  async getContract(contractAddress) {
    return await this._get(`/api/contracts/${contractAddress}`);
  }

  async getNetworkStats() {
    return await this._get('/api/stats');
  }

  async getBlock(index) {
    return await this._get(`/api/block/${index}`);
  }

  async getValidators() {
    return await this._get('/api/validators');
  }

  // ─── Internal: sign + broadcast ─────────────────────────────────────────────

  async _broadcast(txData, wallet) {
    const hash = await this._hashTx(txData);
    const signature = wallet.sign(hash);

    return await this._post('/api/broadcast', {
      ...txData,
      signature,
      publicKey: wallet.publicKey
    });
  }

  /**
   * Deterministic tx hash — MUST exactly match core/transaction.js
   * calculateHash() and cli/wallet-cli.js calculateTransactionHash().
   * All three hash the same field set in the same order.
   */
  async _hashTx(tx) {
    const str = JSON.stringify({
      type:      tx.type,
      timestamp: tx.timestamp,
      data:      tx.data,
      gasLimit:  tx.gasLimit,
      gasPrice:  tx.gasPrice,
      nonce:     tx.nonce
    });

    // Node.js / bundlers with a crypto polyfill
    if (typeof process !== 'undefined' && process.versions?.node) {
      return crypto.createHash('sha256').update(str).digest('hex');
    }

    // Browser fallback via SubtleCrypto
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const buf = new TextEncoder().encode(str);
      const digest = await window.crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    throw new Error('No SHA-256 implementation available in this environment');
  }
}

export { SaymanClient };
export default SaymanClient;