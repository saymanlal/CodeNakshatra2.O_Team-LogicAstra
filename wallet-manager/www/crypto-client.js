// ============================================================
//  Sayman Crypto Client — Elliptic Curve & Wallet Core
//  Uses elliptic.js for secp256k1 operations.
// ============================================================

class SaymanWallet {
  /**
   * @param {string|null} privateKey - hex private key (optional)
   */
  constructor(privateKey = null) {
      this.privateKey = privateKey;
      this.publicKey = null;
      this.address = null;
      // elliptic is loaded globally via CDN
      this.ec = new elliptic.ec('secp256k1');
  }

  /**
   * Initialize wallet: generate or import keypair, derive address.
   * @returns {Promise<SaymanWallet>}
   */
  async initialize() {
      if (this.privateKey) {
          // Import existing private key
          const keyPair = this.ec.keyFromPrivate(this.privateKey, 'hex');
          this.publicKey = keyPair.getPublic('hex');
      } else {
          // Generate new keypair
          const keyPair = this.ec.genKeyPair();
          this.privateKey = keyPair.getPrivate('hex');
          this.publicKey = keyPair.getPublic('hex');
      }

      // Derive address: SHA-256 of public key, take first 40 hex chars
      const encoder = new TextEncoder();
      const data = encoder.encode(this.publicKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      this.address = hashHex.substring(0, 40);

      return this;
  }

  /**
   * Sign a transaction payload.
   * @param {Object} txData - transaction fields (type, timestamp, data, gasLimit, gasPrice, nonce)
   * @returns {Promise<string>} DER signature hex
   */
  async signTransaction(txData) {
      const keyPair = this.ec.keyFromPrivate(this.privateKey, 'hex');

      // Hash must match Transaction.calculateHash() on the backend
      const dataToHash = JSON.stringify({
          type: txData.type,
          timestamp: txData.timestamp,
          data: txData.data,
          gasLimit: txData.gasLimit,
          gasPrice: txData.gasPrice,
          nonce: txData.nonce,
      });

      const encoder = new TextEncoder();
      const data = encoder.encode(dataToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const signature = keyPair.sign(hash);
      return signature.toDER('hex');
  }

  /**
   * Verify a signature against a public key and hash.
   * @param {string} publicKey - hex public key
   * @param {string} signature - DER signature hex
   * @param {string} hash - hex hash
   * @returns {boolean}
   */
  static verifySignature(publicKey, signature, hash) {
      const ec = new elliptic.ec('secp256k1');
      const key = ec.keyFromPublic(publicKey, 'hex');
      return key.verify(hash, signature);
  }

  /**
   * Export wallet data as plain object.
   * @returns {Object}
   */
  export() {
      return {
          privateKey: this.privateKey,
          publicKey: this.publicKey,
          address: this.address,
      };
  }

  /**
   * Create a wallet from a JSON export.
   * @param {Object} json - { privateKey, publicKey, address?, name?, transactions?, balance? }
   * @param {string} name - wallet name
   * @returns {Promise<Object>} wallet object for app state
   */
  static async fromJSON(json, name) {
      if (!json.privateKey) {
          throw new Error('Missing privateKey in JSON');
      }
      const wallet = new SaymanWallet(json.privateKey);
      await wallet.initialize();
      return {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: name || json.name || 'Imported Wallet',
          privateKey: wallet.privateKey,
          publicKey: wallet.publicKey,
          address: wallet.address,
          balance: json.balance || 0,
          transactions: json.transactions || [],
      };
  }
}

// Expose globally
window.SaymanWallet = SaymanWallet;

console.log('🔐 Sayman Crypto Client loaded.');