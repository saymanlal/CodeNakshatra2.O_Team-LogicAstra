class ContractEngine {
  constructor() {
    this.contracts = new Map();
  }

  deploy(address, code, owner) {
    this.contracts.set(address, {
      code,
      owner,
      state: {}
    });
    
    console.log(`📜 Contract deployed at ${address.substring(0, 8)}...`);
  }

  getContract(address) {
    return this.contracts.get(address);
  }

  execute(address, method, args, sender, gasLimit) {
    const contract = this.contracts.get(address);
    
    if (!contract) {
      throw new Error('Contract not found');
    }

    // Simple execution (can be enhanced)
    const context = {
      state: contract.state,
      msg: { sender },
      contract: { address }
    };

    try {
      const fn = new Function('context', 'args', `
        with(context) {
          ${contract.code}
          if (typeof ${method} === 'function') {
            return ${method}(args);
          }
          throw new Error('Method not found');
        }
      `);

      return fn(context, args);
    } catch (error) {
      throw new Error(`Contract execution failed: ${error.message}`);
    }
  }

  getAllContracts() {
    return Array.from(this.contracts.entries()).map(([address, contract]) => ({
      address,
      owner: contract.owner,
      codeSize: contract.code.length
    }));
  }
}

export default ContractEngine;