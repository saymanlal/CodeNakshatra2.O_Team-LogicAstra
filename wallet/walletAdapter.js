/**
 * SAYMAN External Component Adaptation — Phase F1: Wallet Adapter
 *
 * Connects the SAYMAN Wallet logic to the redesigned Layer-1 Core Network via
 * the SaymanProtocolAdapter and DynamicClientTransport.
 *
 * Eliminates hardcoded reliance on sayman.onrender.com or any single VPS.
 */

import Wallet from './wallet.js';
import { DynamicClientTransport, PROTOCOL_METHODS } from '../core/protocol/interfaceAdapter.js';

export class SaymanWalletAdapter {
  /**
   * @param {Wallet} walletInstance
   * @param {object} options - { primaryEndpoint, peerEndpoints }
   */
  constructor(walletInstance = new Wallet(), options = {}) {
    this.wallet = walletInstance;
    this.transport = new DynamicClientTransport(options);
  }

  /**
   * Update known peer endpoints dynamically from P2P mesh discovery.
   * @param {string[]} endpoints
   */
  updatePeerEndpoints(endpoints) {
    this.transport.setPeerEndpoints(endpoints);
  }

  /**
   * Fetch wallet account balance via JSON-RPC.
   * @returns {Promise<number>} balance in SAY units
   */
  async getBalance() {
    const resHex = await this.transport.request({
      jsonrpc: '2.0',
      method: PROTOCOL_METHODS.ETH_GET_BALANCE,
      params: [this.wallet.address],
      id: Date.now(),
    });
    return parseInt(resHex, 16);
  }

  /**
   * Fetch current network block height via JSON-RPC.
   * @returns {Promise<number>}
   */
  async getBlockHeight() {
    const resHex = await this.transport.request({
      jsonrpc: '2.0',
      method: PROTOCOL_METHODS.ETH_BLOCK_NUMBER,
      params: [],
      id: Date.now(),
    });
    return parseInt(resHex, 16);
  }

  /**
   * Sign and send a transaction to the decentralized core mempool.
   * @param {string} recipientAddress
   * @param {number} amount
   * @returns {Promise<{ txHash: string, from: string, to: string, amount: number }>}
   */
  async sendTransaction(recipientAddress, amount) {
    const payload = {
      from: this.wallet.address,
      to: recipientAddress,
      amount,
      nonce: Date.now(),
    };
    
    // Sign payload hash using wallet private key
    const hash = Buffer.from(JSON.stringify(payload)).toString('hex');
    const signature = this.wallet.sign(hash);

    const rawTxPayload = JSON.stringify({ payload, signature, publicKey: this.wallet.publicKey });

    const txHash = await this.transport.request({
      jsonrpc: '2.0',
      method: PROTOCOL_METHODS.ETH_SEND_RAW_TRANSACTION,
      params: [Buffer.from(rawTxPayload).toString('hex')],
      id: Date.now(),
    });

    return {
      txHash,
      from: this.wallet.address,
      to: recipientAddress,
      amount,
    };
  }

  /**
   * Query storage mesh status for a specific data blob.
   * @param {string} blobId
   * @returns {Promise<object>}
   */
  async getBlobStatus(blobId) {
    return await this.transport.request({
      jsonrpc: '2.0',
      method: PROTOCOL_METHODS.SAYMAN_GET_STORAGE_BLOB,
      params: [blobId],
      id: Date.now(),
    });
  }
}

export default SaymanWalletAdapter;
