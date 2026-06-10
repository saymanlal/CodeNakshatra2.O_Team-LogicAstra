/**
 * SAYMAN SDK Client — Phase 9
 *
 * Usage (from any external repo like crowdpulse/):
 *
 *   import { SaymanClient } from '@sayman/sdk';
 *   const client = new SaymanClient({ rpcUrl: 'http://localhost:10000' });
 *
 *   const address = await client.deployContract({ name, version, code, wallet });
 *   const result  = await client.callContract({ contractAddress, method, args, wallet });
 *   const data    = await client.readState(contractAddress, key);
 *   const events  = await client.getEvents({ contractAddress, eventName });
 */

class SaymanClient {
    /**
     * @param {object} options
     * @param {string} options.rpcUrl  - e.g. 'http://localhost:10000' or 'https://testnet.sayman.io'
     */
    constructor({ rpcUrl } = {}) {
      this.rpcUrl = (rpcUrl || 'http://localhost:10000').replace(/\/$/, '');
    }
  
    // ─── Internal fetch helper ─────────────────────────────────────────────────
  
    async _post(endpoint, body) {
      const res = await fetch(`${this.rpcUrl}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
  
      return data;
    }
  
    async _get(endpoint) {
      const res  = await fetch(`${this.rpcUrl}${endpoint}`);
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }
  
      return data;
    }
  
    // ─── Wallet helpers ────────────────────────────────────────────────────────
  
    /**
     * Get current nonce for an address.
     */
    async getNonce(address) {
      const data = await this._get(`/api/account/${address}`);
      return data.nonce || 0;
    }
  
    /**
     * Get SAYM balance.
     */
    async getBalance(address) {
      const data = await this._get(`/api/account/${address}`);
      return data.balance || 0;
    }
  
    // ─── Contract deployment ───────────────────────────────────────────────────
  
    /**
     * Deploy a JavaScript smart contract to SAYMAN.
     *
     * @param {object} options
     * @param {string} options.name        - Contract name (e.g. 'ReportRegistry')
     * @param {string} options.version     - Semver string (e.g. '1.0.0')
     * @param {string} options.code        - Full JS source of the contract
     * @param {string} [options.abi]       - Optional array of method names
     * @param {object} options.wallet      - Wallet object with .address, .publicKey, .sign()
     * @param {number} [options.gasLimit]  - Default: 100000
     * @param {number} [options.gasPrice]  - Default: 1
     * @returns {Promise<string>} contractAddress
     */
    async deployContract({ name, version, code, abi, wallet, gasLimit = 100000, gasPrice = 1 }) {
      const nonce = await this.getNonce(wallet.address);
  
      const tx = {
        type:      'CONTRACT_DEPLOY',
        timestamp: Date.now(),
        nonce,
        gasLimit,
        gasPrice,
        data: {
          from:    wallet.address,
          name:    name    || 'UnnamedContract',
          version: version || '1.0.0',
          abi:     abi     || [],
          code
        }
      };
  
      // Sign transaction
      const hash = this._hashTx(tx);
      tx.signature = wallet.sign(hash);
  
      const result = await this._post('/api/transactions', {
        transaction: tx,
        publicKey:   wallet.publicKey
      });
  
      return result.contractAddress || result.txId;
    }
  
    /**
     * Call a deployed contract method (state-changing).
     *
     * @param {object} options
     * @param {string} options.contractAddress
     * @param {string} options.method
     * @param {object} [options.args]
     * @param {object} options.wallet
     * @param {number} [options.gasLimit]
     * @param {number} [options.gasPrice]
     * @returns {Promise<*>} return value from the method
     */
    async callContract({ contractAddress, method, args, wallet, gasLimit = 50000, gasPrice = 1 }) {
      const nonce = await this.getNonce(wallet.address);
  
      const tx = {
        type:      'CONTRACT_CALL',
        timestamp: Date.now(),
        nonce,
        gasLimit,
        gasPrice,
        data: {
          from: wallet.address,
          contractAddress,
          method,
          args: args || {}
        }
      };
  
      const hash = this._hashTx(tx);
      tx.signature = wallet.sign(hash);
  
      return await this._post('/api/transactions', {
        transaction: tx,
        publicKey:   wallet.publicKey
      });
    }
  
    /**
     * Read contract state (read-only, no gas).
     *
     * @param {string} contractAddress
     * @param {string} key
     * @returns {Promise<*>}
     */
    async readState(contractAddress, key) {
      const data = await this._get(`/api/contracts/${contractAddress}/state/${key}`);
      return data.value;
    }
  
    /**
     * Read all contract state.
     */
    async readAllState(contractAddress) {
      const data = await this._get(`/api/contracts/${contractAddress}/state`);
      return data.state || {};
    }
  
    // ─── Events ─────────────────────────────────────────────────────────────────
  
    /**
     * Query emitted events.
     *
     * @param {object} [filter]
     * @param {string} [filter.contractAddress]
     * @param {string} [filter.eventName]
     * @param {number} [filter.limit]
     */
    async getEvents({ contractAddress, eventName, limit } = {}) {
      const params = new URLSearchParams();
      if (contractAddress) params.set('contract',  contractAddress);
      if (eventName)       params.set('event',     eventName);
      if (limit)           params.set('limit',     limit);
  
      const qs   = params.toString();
      const data = await this._get(`/api/events${qs ? '?' + qs : ''}`);
      return data.events || [];
    }
  
    // ─── Reports ────────────────────────────────────────────────────────────────
  
    /**
     * Submit a native REPORT_CREATE transaction.
     *
     * @param {object} report - { category, location: {lat, lng}, severity, evidenceHash, description }
     * @param {object} wallet
     */
    async submitReport(report, wallet, gasLimit = 30000, gasPrice = 1) {
      const nonce = await this.getNonce(wallet.address);
  
      const tx = {
        type:      'REPORT_CREATE',
        timestamp: Date.now(),
        nonce,
        gasLimit,
        gasPrice,
        data: {
          from:         wallet.address,
          category:     report.category,
          location:     report.location || {},
          severity:     report.severity || 'MEDIUM',
          evidenceHash: report.evidenceHash || null,
          description:  report.description || ''
        }
      };
  
      const hash = this._hashTx(tx);
      tx.signature = wallet.sign(hash);
  
      return await this._post('/api/transactions', {
        transaction: tx,
        publicKey:   wallet.publicKey
      });
    }
  
    /**
     * Get all civic reports.
     */
    async getReports({ category, status, limit } = {}) {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (status)   params.set('status',   status);
      if (limit)    params.set('limit',    limit);
  
      const qs   = params.toString();
      const data = await this._get(`/api/reports${qs ? '?' + qs : ''}`);
      return data.reports || [];
    }
  
    // ─── Reputation ─────────────────────────────────────────────────────────────
  
    async getReputation(address) {
      const data = await this._get(`/api/reputation/${address}`);
      return data.reputation || 0;
    }
  
    // ─── Registry ───────────────────────────────────────────────────────────────
  
    async getContractRegistry() {
      const data = await this._get('/api/contracts');
      return data.contracts || [];
    }
  
    async getContract(contractAddress) {
      return await this._get(`/api/contracts/${contractAddress}`);
    }
  
    // ─── Network ────────────────────────────────────────────────────────────────
  
    async getNetworkStats() {
      return await this._get('/api/stats');
    }
  
    async getBlock(indexOrHash) {
      return await this._get(`/api/blocks/${indexOrHash}`);
    }
  
    // ─── Helpers ────────────────────────────────────────────────────────────────
  
    /**
     * Simple deterministic tx hash (mirrors Transaction.calculateHash())
     * Uses SubtleCrypto in browser, or a simple JSON hash for Node/bundler use.
     * The actual signing is done by the wallet object passed by the caller.
     */
    _hashTx(tx) {
      const str = JSON.stringify({
        type:      tx.type,
        timestamp: tx.timestamp,
        data:      tx.data,
        gasLimit:  tx.gasLimit,
        gasPrice:  tx.gasPrice,
        nonce:     tx.nonce
      });
  
      // In Node.js
      if (typeof process !== 'undefined' && process.versions?.node) {
        const { createHash } = await import('crypto').catch(() => ({ createHash: null }));
        if (createHash) return createHash('sha256').update(str).digest('hex');
      }
  
      // Fallback: return the raw string (wallet.sign() should hash internally if needed)
      return str;
    }
  }
  
  export { SaymanClient };
  export default SaymanClient;