// cli/wallet-cli.js

import crypto from 'crypto';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

export class SaymanWalletCLI {
  constructor(privateKey = null) {
    this.keyPair = null;
    this.privateKey = privateKey;
    this.publicKey = null;
    this.address = null;
  }

  async initialize() {
    if (this.privateKey) {
      if (!/^[a-fA-F0-9]{64}$/.test(this.privateKey)) {
        throw new Error('Invalid private key format');
      }

      this.keyPair = ec.keyFromPrivate(this.privateKey, 'hex');
    } else {
      this.keyPair = ec.genKeyPair();
      this.privateKey = this.keyPair.getPrivate('hex');
    }

    this.publicKey = this.keyPair.getPublic('hex');
    this.address = this.deriveAddress(this.publicKey);

    return this;
  }

  deriveAddress(publicKey) {
    const hash = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex');

    return hash.substring(0, 40);
  }

  calculateTransactionHash(txData) {
    // MUST MATCH:
    // frontend/crypto-client.js
    // wallet/wallet.js
    // core/transaction.js

    const normalizedTx = {
      type: txData.type,
      timestamp: txData.timestamp,
      data: txData.data,
      gasLimit: txData.gasLimit,
      gasPrice: txData.gasPrice,
      nonce: txData.nonce
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalizedTx))
      .digest('hex');
  }

  async signTransaction(txData) {
    if (!this.keyPair) {
      throw new Error('Wallet not initialized');
    }

    const hash = this.calculateTransactionHash(txData);

    const signature = this.keyPair.sign(hash);

    return {
      r: signature.r.toString('hex'),
      s: signature.s.toString('hex')
    };
  }

  verifySignature(signature, txData) {
    const hash = this.calculateTransactionHash(txData);

    return this.keyPair.verify(hash, signature);
  }

  export() {
    return {
      address: this.address,
      publicKey: this.publicKey,
      privateKey: this.privateKey
    };
  }
}