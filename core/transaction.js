import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

/**
 * Transaction — Phase 9: Smart Contract Platform
 *
 * New in Phase 9:
 *  - REPORT_CREATE, REPORT_VERIFY, REPORT_RESOLVE   — native CrowdPulse tx types
 *  - REPUTATION_UPDATE                              — native reputation tx type
 *  - CONTRACT_UPGRADE                               — upgrade contract code
 *  - All new factory methods
 *  - isValid() updated to allow new system tx types
 *  - CONTRACT_DEPLOY now accepts { name, version, abi, code } payload
 */

// ✅ Phase 9: All valid transaction types
const TX_TYPES = {
  // System
  GENESIS:          'GENESIS',
  REWARD:           'REWARD',
  REWARD_FEE:       'REWARD_FEE',
  SLASH:            'SLASH',

  // Wallet
  TRANSFER:         'TRANSFER',
  STAKE:            'STAKE',
  UNSTAKE:          'UNSTAKE',

  // Smart Contracts
  CONTRACT_DEPLOY:  'CONTRACT_DEPLOY',
  CONTRACT_CALL:    'CONTRACT_CALL',
  CONTRACT_UPGRADE: 'CONTRACT_UPGRADE',

  // ✅ Phase 9: Native CrowdPulse types
  REPORT_CREATE:    'REPORT_CREATE',
  REPORT_VERIFY:    'REPORT_VERIFY',
  REPORT_RESOLVE:   'REPORT_RESOLVE',

  // ✅ Phase 9: Native reputation type
  REPUTATION_UPDATE: 'REPUTATION_UPDATE',
};

// System transactions that skip signature + gas validation
const SYSTEM_TX_TYPES = new Set([
  TX_TYPES.GENESIS,
  TX_TYPES.REWARD,
  TX_TYPES.REWARD_FEE,
  TX_TYPES.SLASH,
  TX_TYPES.REPUTATION_UPDATE, // issued by chain, not users
]);

class Transaction {
  constructor(type, data) {
    this.id        = uuidv4();
    this.type      = type;
    this.timestamp = Date.now();
    this.data      = data;
    this.signature = null;
    this.gasLimit  = 0;
    this.gasPrice  = 0;
    this.nonce     = 0;
    this.gasUsed   = 0;
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({
        type:      this.type,
        timestamp: this.timestamp,
        data:      this.data,
        gasLimit:  this.gasLimit,
        gasPrice:  this.gasPrice,
        nonce:     this.nonce
      }))
      .digest('hex');
  }

  sign(wallet) {
    const hash = this.calculateHash();
    this.signature = wallet.sign(hash);
  }

  isValid(publicKeys) {
    if (SYSTEM_TX_TYPES.has(this.type)) {
      return true;
    }

    if (!this.signature) return false;
    if (!this.gasLimit || !this.gasPrice) return false;

    const publicKey = publicKeys.get(this.data.from);
    if (!publicKey) return false;

    try {
      const key    = ec.keyFromPublic(publicKey, 'hex');
      const isValid = key.verify(this.calculateHash(), this.signature);
      if (!isValid) {
        console.error(`❌ Signature verification failed for ${this.data.from}`);
      }
      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error.message);
      return false;
    }
  }

  toJSON() {
    return {
      id:        this.id,
      type:      this.type,
      timestamp: this.timestamp,
      data:      this.data,
      signature: this.signature,
      gasLimit:  this.gasLimit,
      gasPrice:  this.gasPrice,
      nonce:     this.nonce,
      gasUsed:   this.gasUsed
    };
  }

  static fromJSON(json) {
    const tx       = new Transaction(json.type, json.data);
    tx.id          = json.id;
    tx.timestamp   = json.timestamp;
    tx.signature   = json.signature;
    tx.gasLimit    = json.gasLimit  || 0;
    tx.gasPrice    = json.gasPrice  || 0;
    tx.nonce       = json.nonce     || 0;
    tx.gasUsed     = json.gasUsed   || 0;
    return tx;
  }

  // ─── Factory methods ────────────────────────────────────────────────────────

  static createTransfer(from, to, amount) {
    return new Transaction(TX_TYPES.TRANSFER, { from, to, amount });
  }

  static createStake(from, amount) {
    return new Transaction(TX_TYPES.STAKE, { from, amount });
  }

  static createUnstake(from) {
    return new Transaction(TX_TYPES.UNSTAKE, { from });
  }

  static createReward(to, amount) {
    return new Transaction(TX_TYPES.REWARD, { to, amount });
  }

  static createRewardFee(to, amount) {
    return new Transaction(TX_TYPES.REWARD_FEE, { to, amount });
  }

  static createSlash(validator, amount, reason) {
    return new Transaction(TX_TYPES.SLASH, { validator, amount, reason });
  }

  /**
   * Deploy a smart contract.
   * @param {string} from
   * @param {string|object} contractPayload - raw code string OR { name, version, abi, code }
   */
  static createContractDeploy(from, contractPayload) {
    const data = typeof contractPayload === 'string'
      ? { from, code: contractPayload }
      : { from, ...contractPayload };
    return new Transaction(TX_TYPES.CONTRACT_DEPLOY, data);
  }

  static createContractCall(from, contractAddress, method, args) {
    return new Transaction(TX_TYPES.CONTRACT_CALL, {
      from, contractAddress, method, args: args || {}
    });
  }

  static createContractUpgrade(from, contractAddress, newCode) {
    return new Transaction(TX_TYPES.CONTRACT_UPGRADE, {
      from, contractAddress, newCode
    });
  }

  // ✅ Phase 9: Native CrowdPulse factories

  /**
   * Create a civic report on-chain.
   * @param {string} from - reporter wallet address
   * @param {object} report - { category, location: {lat,lng}, severity, evidenceHash, description }
   */
  static createReport(from, report) {
    return new Transaction(TX_TYPES.REPORT_CREATE, {
      from,
      category:     report.category,
      location:     report.location || {},
      severity:     report.severity || 'MEDIUM',
      evidenceHash: report.evidenceHash || null,
      description:  report.description || '',
      timestamp:    Date.now()
    });
  }

  /**
   * AI or validator verifies a report.
   * @param {string} verifier
   * @param {string} reportId - original REPORT_CREATE tx id
   * @param {object} result - { confidence, isValid, aiCategory }
   */
  static verifyReport(verifier, reportId, result) {
    return new Transaction(TX_TYPES.REPORT_VERIFY, {
      verifier,
      reportId,
      confidence: result.confidence || 0,
      isValid:    result.isValid !== false,
      aiCategory: result.aiCategory || null
    });
  }

  /**
   * Authority resolves a report.
   * @param {string} authority
   * @param {string} reportId
   * @param {string} resolution - 'RESOLVED' | 'REJECTED' | 'IN_PROGRESS'
   * @param {string} [note]
   */
  static resolveReport(authority, reportId, resolution, note = '') {
    return new Transaction(TX_TYPES.REPORT_RESOLVE, {
      authority,
      reportId,
      resolution,
      note,
      resolvedAt: Date.now()
    });
  }

  /**
   * System-issued reputation update (no gas, no signature).
   */
  static updateReputation(address, delta, reason) {
    return new Transaction(TX_TYPES.REPUTATION_UPDATE, {
      address, delta, reason
    });
  }
}

export { TX_TYPES };
export default Transaction;