import crypto from 'crypto';
import vm from 'vm';

/**
 * Contract Engine with Storage Root
 * Phase 8: Deterministic contract storage with Merkle verification
 */

class ContractEngine {
  constructor(state, gas) {
    this.state = state;
    this.gas = gas;
    this.contracts = new Map();
  }

  deploy(from, code, timestamp, gasTracker) {
    const contractAddress = this.generateContractAddress(from, timestamp);
    
    // Calculate code hash for state tree
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const contract = {
      address: contractAddress,
      code,
      codeHash, // ✅ Phase 8: Store code hash
      creator: from,
      state: {},
      createdAt: timestamp
    };

    this.contracts.set(contractAddress, contract);
    this.state.deployContract(contractAddress, code, from);

    gasTracker.gasUsed += this.gas.costs.contractDeploy + (code.length * this.gas.costs.storageByte);

    console.log(`📜 Contract deployed: ${contractAddress.substring(0, 8)}... by ${from.substring(0, 8)}... | CodeHash: ${codeHash.substring(0, 8)}...`);

    return contractAddress;
  }

  call(from, contractAddress, method, args, gasTracker, gasLimit) {
    const contract = this.contracts.get(contractAddress) || this.state.getContract(contractAddress);

    if (!contract) {
      throw new Error('Contract not found');
    }

    gasTracker.gasUsed += this.gas.costs.contractCall;

    const sandbox = {
      contract: {
        state: contract.state,
        address: contractAddress,
        creator: contract.creator
      },
      caller: from,
      args: args || {},
      method,
      blockTimestamp: Date.now(),
      console: {
        log: (...args) => console.log('[Contract Log]', ...args)
      },
      getState: (key) => {
        gasTracker.gasUsed += this.gas.costs.storageRead;
        return this.state.getContractState(contractAddress, key);
      },
      setState: (key, value) => {
        gasTracker.gasUsed += this.gas.costs.storageWrite;
        this.state.setContractState(contractAddress, key, value);
        contract.state[key] = value;
        
        // ✅ Phase 8: Storage root will be computed in state.js
      },
      transfer: (to, amount) => {
        gasTracker.gasUsed += this.gas.costs.transfer;
        const contractBalance = this.state.getBalance(contractAddress);
        if (contractBalance < amount) {
          throw new Error('Insufficient contract balance');
        }
        this.state.subtractBalance(contractAddress, amount);
        this.state.addBalance(to, amount);
      },
      getBalance: (address) => {
        gasTracker.gasUsed += this.gas.costs.storageRead;
        return this.state.getBalance(address);
      }
    };

    const context = vm.createContext(sandbox);

    try {
      const script = new vm.Script(`
        ${contract.code}
        if (typeof ${method} === 'function') {
          ${method}(args);
        } else {
          throw new Error('Method ${method} not found');
        }
      `);

      script.runInContext(context, {
        timeout: 5000,
        breakOnSigint: true
      });

      if (gasTracker.gasUsed > gasLimit) {
        throw new Error('Out of gas');
      }

      console.log(`📞 Contract call: ${contractAddress.substring(0, 8)}...::${method} | Gas: ${gasTracker.gasUsed}`);

    } catch (error) {
      console.error(`Contract execution error: ${error.message}`);
      throw new Error(`Contract execution failed: ${error.message}`);
    }
  }

  generateContractAddress(from, timestamp) {
    return crypto
      .createHash('sha256')
      .update(from + timestamp.toString())
      .digest('hex')
      .substring(0, 40);
  }

  getContract(address) {
    return this.contracts.get(address) || this.state.getContract(address);
  }

  getAllContracts() {
    const stateContracts = this.state.getAllContracts();
    const combined = new Map(this.contracts);
    
    stateContracts.forEach(contract => {
      if (!combined.has(contract.address)) {
        combined.set(contract.address, contract);
      }
    });

    return Array.from(combined.values());
  }
}
export default ContractEngine;
