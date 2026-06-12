/**
 * GasCalculator — Phase 9 (fixed)
 *
 * Fixes applied:
 *  1. Renamed this.gasCosts → this.costs so ContractEngine (this.gas.costs.contractDeploy,
 *     this.gas.costs.storageByte, this.gas.costs.storageRead, this.gas.costs.storageWrite,
 *     this.gas.costs.contractCall, this.gas.costs.transfer) can resolve the table correctly.
 *     Previously `this.gas.costs` was undefined in ContractEngine, making every gas charge NaN,
 *     which bypassed the pre-flight balance check and caused "Insufficient balance for gas".
 *
 *  2. Added storageByte cost (0.01) — used by ContractEngine deploy formula.
 *
 *  3. calculateTransactionGas() now uses this.costs (not this.gasCosts) and uses /100
 *     instead of /1000 for CONTRACT_DEPLOY so the pre-flight gasLimit estimate
 *     actually covers what ContractEngine will charge at execution time.
 *
 *  4. Added REPORT_CREATE / REPORT_VERIFY / REPORT_RESOLVE cases so the pre-flight
 *     balance check in blockchain.js uses the same value that createBlock() charges.
 *
 *  5. Null-safe code.length in CONTRACT_DEPLOY case (guards against missing code key).
 */

class GasCalculator {
  constructor(config) {
    this.config = config;

    // ─── Single source of truth for all gas costs ────────────────────────────
    // Previously named `gasCosts`; ContractEngine accesses this as `this.gas.costs`
    // so the property MUST be named `costs`.  Both camelCase keys (used by
    // ContractEngine) and UPPER_SNAKE keys (legacy callers) are provided.
    this.costs = {
      // Wallet operations
      transfer:           6,
      TRANSFER:           6,

      stake:              50,
      STAKE:              50,

      unstake:            50,
      UNSTAKE:            50,

      // Contract operations
      contractDeploy:     500,   // ContractEngine: this.gas.costs.contractDeploy
      CONTRACT_DEPLOY:    500,

      contractCall:       100,   // ContractEngine: this.gas.costs.contractCall (unused directly but kept for symmetry)
      CONTRACT_CALL_BASE: 100,

      contractUpgrade:    300,
      CONTRACT_UPGRADE:   300,

      // Storage — ContractEngine charges per read/write/byte
      storageRead:        5,     // ContractEngine: this.gas.costs.storageRead
      STATE_READ:         5,

      storageWrite:       20,    // ContractEngine: this.gas.costs.storageWrite
      STATE_WRITE:        20,

      storageByte:        0.01,  // ContractEngine deploy: code.length * storageByte

      // Native CrowdPulse tx types (blockchain.js createBlock charges this.gas.costs.transfer)
      reportCreate:       6,
      REPORT_CREATE:      6,

      reportVerify:       6,
      REPORT_VERIFY:      6,

      reportResolve:      6,
      REPORT_RESOLVE:     6,

      // Misc
      COMPUTATION:        1,
      defaultMin:         6
    };

    // Keep a `gasCosts` alias so any legacy code that still reads this.gasCosts
    // doesn't break silently.
    this.gasCosts = this.costs;

    // ─── Limits ──────────────────────────────────────────────────────────────
    this.limits = {
      maxGasPerBlock:   10_000_000,
      maxGasPerTx:       5_000_000,
      minGasPrice:       1,       // 1 wei per gas unit
      maxExecutionTime:  50,      // ms
      maxStateSize:      51_200,  // 50 KB
      maxInstructions:   10_000
    };
  }

  /**
   * Pre-flight gas estimate used by addTransaction() to validate gasLimit.
   * Must be ≤ what execution will actually charge (execution gets billed on top
   * of this via gasTracker; we just need the floor here).
   */
  calculateTransactionGas(tx) {
    switch (tx.type) {
      case 'TRANSFER':
        return this.costs.transfer;

      case 'STAKE':
      case 'UNSTAKE':
        return this.costs.stake;

      case 'CONTRACT_DEPLOY': {
        // Guard against payload styles: tx.data.code may be top-level or nested
        const code = tx.data.code || '';
        // Base cost + 1 gas per 100 bytes of code (ContractEngine bills per byte
        // at storageByte=0.01, so 100 bytes = 1 gas unit — same formula, consistent)
        return this.costs.contractDeploy + Math.floor(code.length / 100);
      }

      case 'CONTRACT_CALL':
        return this.costs.CONTRACT_CALL_BASE;

      case 'CONTRACT_UPGRADE': {
        const code = tx.data.newCode || '';
        return this.costs.contractUpgrade + Math.floor(code.length / 100);
      }

      // ✅ Phase 9 native types — must match what blockchain.js createBlock() charges
      case 'REPORT_CREATE':
        return this.costs.reportCreate;

      case 'REPORT_VERIFY':
        return this.costs.reportVerify;

      case 'REPORT_RESOLVE':
        return this.costs.reportResolve;

      default:
        return this.costs.defaultMin;
    }
  }

  validateGasParams(tx) {
    if (!tx.gasLimit || !tx.gasPrice) {
      throw new Error('Missing gas parameters');
    }

    if (tx.gasPrice < this.limits.minGasPrice) {
      throw new Error(`Gas price too low. Minimum: ${this.limits.minGasPrice}`);
    }

    if (tx.gasLimit > this.limits.maxGasPerTx) {
      throw new Error(`Gas limit too high. Maximum: ${this.limits.maxGasPerTx}`);
    }

    return true;
  }

  calculateGasCost(gasUsed, gasPrice) {
    return gasUsed * gasPrice;
  }

  trackExecution() {
    return {
      gasUsed:      0,
      stateReads:   0,
      stateWrites:  0,
      instructions: 0,
      startTime:    Date.now()
    };
  }

  chargeGas(tracker, amount) {
    tracker.gasUsed      += amount;
    tracker.instructions += 1;

    if (tracker.instructions > this.limits.maxInstructions) {
      throw new Error('Execution limit exceeded: too many instructions');
    }

    const elapsed = Date.now() - tracker.startTime;
    if (elapsed > this.limits.maxExecutionTime) {
      throw new Error('Execution limit exceeded: timeout');
    }

    return tracker;
  }
}

export default GasCalculator;