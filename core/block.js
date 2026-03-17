import crypto from 'crypto';
import Transaction from './transaction.js';

class Block {
  constructor(index, timestamp, transactions, previousHash, validator, chainId) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions || [];
    this.previousHash = previousHash;
    this.validator = validator;
    this.chainId = chainId;
    this.hash = this.calculateHash();
    this.gasUsed = 0;
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.index +
        this.timestamp +
        JSON.stringify(this.transactions.map(tx => tx.toJSON ? tx.toJSON() : tx)) +
        this.previousHash +
        this.validator +
        this.chainId
      )
      .digest('hex');
  }

  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      transactions: Array.isArray(this.transactions) 
        ? this.transactions.map(tx => tx.toJSON ? tx.toJSON() : tx)
        : [],
      previousHash: this.previousHash,
      validator: this.validator,
      chainId: this.chainId,
      hash: this.hash,
      gasUsed: this.gasUsed || 0
    };
  }

  static async fromJSON(data) {
    const transactions = [];
    for (const txData of data.transactions || []) {
      transactions.push(new Transaction(txData));
    }
    
    const block = new Block(
      data.index,
      data.timestamp,
      transactions,
      data.previousHash,
      data.validator,
      data.chainId
    );
    
    block.hash = data.hash;
    block.gasUsed = data.gasUsed || 0;
    
    return block;
  }
}

export default Block;