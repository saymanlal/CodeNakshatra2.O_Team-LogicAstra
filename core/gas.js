class GasCalculator {
  constructor(config) {
    this.config = config;
    
    // Gas costs (deterministic)
    this.gasCosts = {
      TRANSFER: 6,
      STAKE: 50,
      UNSTAKE: 50,
      CONTRACT_DEPLOY: 500,
      CONTRACT_CALL_BASE: 100,
      STATE_READ: 5,
      STATE_WRITE: 20,
      COMPUTATION: 1
    };
    
    // Limits
    this.limits = {
      maxGasPerBlock: 10000000,
      maxGasPerTx: 5000000,
      minGasPrice: 1, // 1 wei per gas unit
      maxExecutionTime: 50, // ms
      maxStateSize: 51200, // 50KB
      maxInstructions: 10000
    };
  }

  calculateTransactionGas(tx) {
    switch (tx.type) {
      case 'TRANSFER':
        return this.gasCosts.TRANSFER;
      
      case 'STAKE':
      case 'UNSTAKE':
        return this.gasCosts.STAKE;
      
      case 'CONTRACT_DEPLOY':
        const codeSize = tx.data.code.length;
        return this.gasCosts.CONTRACT_DEPLOY + Math.floor(codeSize / 10);
      
      case 'CONTRACT_CALL':
        // Base cost + estimated execution
        return this.gasCosts.CONTRACT_CALL_BASE;
      
      default:
        return 6; // Default minimum
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
      gasUsed: 0,
      stateReads: 0,
      stateWrites: 0,
      instructions: 0,
      startTime: Date.now()
    };
  }

  chargeGas(tracker, amount) {
    tracker.gasUsed += amount;
    tracker.instructions++;
    
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