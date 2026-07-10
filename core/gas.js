/**
 * GasCalculator — SAYN token model, 4 decimals
 *
 * Token: 1 SAYN = 10,000 base units
 * Gas unit costs are in raw gas units (dimensionless).
 * Actual fee = gasUsed × gasPrice (base units per gas unit).
 *
 * Testnet gasPrice: 1 base unit/gas → transfer costs 0.0021 SAYN
 * Mainnet gasPrice: 5 base units/gas → transfer costs 0.0105 SAYN
 *
 * Sponsorship / fee policy (per contract, set at deploy time):
 *   'user'    — normal: gas deducted from tx sender (default)
 *   'sponsor' — gas deducted from contract deployer's sponsor balance
 *   'free'    — no gas deducted anywhere (testnet / internal dApps only)
 *
 * Gas unit table is identical on testnet and mainnet.
 * Only gasPrice differs between networks.
 */

class GasCalculator {
  constructor(config) {
    this.config = config;

    // ─── Gas unit table ───────────────────────────────────────────────────
    // One source of truth. Both camelCase (ContractEngine) and UPPER_SNAKE
    // (legacy callers) provided. Numbers are gas units, not base units.
    this.costs = {
      // Wallet operations
      transfer:           21_000,
      TRANSFER:           21_000,

      stake:              50_000,
      STAKE:              50_000,

      unstake:            50_000,
      UNSTAKE:            50_000,

      // Contract operations
      contractDeploy:    200_000,   // base; +1 per 10 code bytes
      CONTRACT_DEPLOY:   200_000,

      contractCall:       50_000,   // base; +storage charges during execution
      CONTRACT_CALL:      50_000,
      CONTRACT_CALL_BASE: 50_000,

      contractUpgrade:   300_000,
      CONTRACT_UPGRADE:  300_000,

      // Storage — charged inside ContractEngine per operation
      storageRead:           500,
      STORAGE_READ:          500,

      storageWrite:        2_000,
      STORAGE_WRITE:       2_000,

      storageByte:             1,   // per byte of contract code stored
      STORAGE_BYTE:            1,



      // Fallback
      defaultMin:         21_000,
      DEFAULT:            21_000,
    };

    // Legacy alias — some old callers may read this.gasCosts
    this.gasCosts = this.costs;

    // ─── Limits ──────────────────────────────────────────────────────────
    this.limits = {
      maxGasPerBlock:    config.maxGasPerBlock    || 50_000_000,
      maxGasPerTx:       config.maxGasPerTx       || 10_000_000,
      minGasPrice:       config.minGasPrice        || 1,
      maxExecutionTime:  config.maxExecutionTime   || 5_000,    // ms
      maxStateSize:      config.maxStateSize       || 512_000,  // bytes
      maxInstructions:   config.maxInstructions    || 100_000,
    };

    // Base units per gas unit (from config — differs testnet vs mainnet)
    this.defaultGasPrice = config.defaultGasPrice || 1;
  }

  // ─── Pre-flight gas estimate ──────────────────────────────────────────────
  // Returns the minimum gas units this tx type must declare as gasLimit.
  // Execution may use more (storage ops inside contracts) but never less.
  calculateTransactionGas(tx) {
    switch (tx.type) {
      case 'TRANSFER':
        return this.costs.transfer;

      case 'STAKE':
      case 'UNSTAKE':
        return this.costs.stake;

      case 'CONTRACT_DEPLOY': {
        const code = tx.data?.code || '';
        // +1 gas unit per 10 bytes of code (matches ContractEngine storageByte billing)
        return this.costs.contractDeploy + Math.floor(code.length / 10);
      }

      case 'CONTRACT_CALL':
        return this.costs.contractCall;

      case 'CONTRACT_UPGRADE': {
        const code = tx.data?.newCode || '';
        return this.costs.contractUpgrade + Math.floor(code.length / 10);
      }



      default:
        return this.costs.defaultMin;
    }
  }

  // ─── Fee calculation ──────────────────────────────────────────────────────
  // Returns fee in base units. This is what gets deducted from wallet balance.
  calculateFee(gasUsed, gasPrice) {
    return gasUsed * (gasPrice || this.defaultGasPrice);
  }

  // ─── Sponsorship ──────────────────────────────────────────────────────────
  // Determine who pays gas for a contract call based on contract's feePolicy.
  // Returns: { payer: 'user'|'sponsor'|'none', payerAddress: string }
  resolveFeePolicy(contract, callerAddress) {
    const policy = contract?.feePolicy || 'user';

    switch (policy) {
      case 'free':
        return { payer: 'none', payerAddress: null };

      case 'sponsor':
        // Gas comes from contract deployer's sponsor balance.
        // If sponsor balance is exhausted, fall back to user.
        return { payer: 'sponsor', payerAddress: contract.creator };

      case 'user':
      default:
        return { payer: 'user', payerAddress: callerAddress };
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────────
  validateGasParams(tx) {
    if (tx.gasLimit === undefined || tx.gasLimit === null) {
      throw new Error('gasLimit is required');
    }
    if (tx.gasPrice === undefined || tx.gasPrice === null) {
      throw new Error('gasPrice is required');
    }
    if (tx.gasPrice < this.limits.minGasPrice) {
      throw new Error(`gasPrice too low. Minimum: ${this.limits.minGasPrice} base units/gas`);
    }
    if (tx.gasLimit > this.limits.maxGasPerTx) {
      throw new Error(`gasLimit too high. Maximum: ${this.limits.maxGasPerTx}`);
    }
    return true;
  }

  // ─── Execution tracker ───────────────────────────────────────────────────
  trackExecution() {
    return {
      gasUsed:      0,
      stateReads:   0,
      stateWrites:  0,
      instructions: 0,
      startTime:    Date.now(),
    };
  }

  chargeGas(tracker, amount) {
    tracker.gasUsed      += amount;
    tracker.instructions += 1;

    if (tracker.instructions > this.limits.maxInstructions) {
      throw new Error('Execution limit exceeded: too many instructions');
    }
    if (Date.now() - tracker.startTime > this.limits.maxExecutionTime) {
      throw new Error('Execution limit exceeded: timeout');
    }

    return tracker;
  }

  // ─── Display helpers ─────────────────────────────────────────────────────
  // Convert base units → SAYN string with 4 decimal places.
  // e.g. formatSAYN(105000) → "0.0105 SAYN"
  formatSAYN(baseUnits) {
    const decimals = this.config.decimals || 10_000;
    return (baseUnits / decimals).toFixed(4) + ' SAYN';
  }

  // Human-readable fee string for a transaction.
  describeFee(gasUsed, gasPrice) {
    const fee = this.calculateFee(gasUsed, gasPrice);
    return `${gasUsed.toLocaleString()} gas × ${gasPrice} = ${this.formatSAYN(fee)}`;
  }
}

export default GasCalculator;