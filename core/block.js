import crypto from 'crypto';
import Transaction from './transaction.js';

class Block {
  constructor(index, timestamp, transactions, previousHash, validator, nonce = 0) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.validator = validator;
    this.nonce = nonce;
    this.chainId = null;
    this.gasUsed = 0;
    this.stateRoot = null; // ✅ Phase 8: Merkle state root
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
        this.timestamp +
        JSON.stringify(this.transactions) +
        this.previousHash +
        this.validator +
        (this.chainId || '') +
        this.gasUsed +
        (this.stateRoot || '') // ✅ Phase 8: Include state root in block hash
      )
      .digest('hex');
  }

  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions.map(tx => tx.toJSON()),
      previousHash: this.previousHash,
      validator: this.validator,
      chainId: this.chainId,
      gasUsed: this.gasUsed,
      stateRoot: this.stateRoot, // ✅ Phase 8: Export state root
      hash: this.hash
    };
  }

  static async fromJSON(data) {
    const Transaction = (await import('./transaction.js')).default;
    const transactions = data.transactions.map(tx => Transaction.fromJSON(tx));
    const block = new Block(
      data.index,
      data.timestamp,
      transactions,
      data.previousHash,
      data.validator,
      data.nonce || 0
    );
    block.chainId = data.chainId;
    block.gasUsed = data.gasUsed || 0;
    block.stateRoot = data.stateRoot || null; // ✅ Phase 8: Import state root
    block.hash = data.hash;
    return block;
  }
}

export default Block;
