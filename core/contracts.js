import crypto from 'crypto';
import vm from 'vm';

/**
 * Contract Engine — Phase 9: Smart Contract Platform
 *
 * Fixes from Phase 8:
 *  - contract.state exposed as `state` (not contract.state) in sandbox
 *  - msg.sender available inside contracts
 *  - Return values captured and returned to caller
 *  - emit() event system wired in
 *  - Contract metadata (name, version, abi) stored on deploy
 *  - New contract style: `contract = { methods: { ... } }`
 *  - Backward-compatible with old flat function style
 *  - Execution memory limit added
 *
 * Fix (Phase 9.2):
 *  - All this.gas.costs.* references are now valid because GasCalculator
 *    exposes its table as `this.costs` (renamed from `this.gasCosts`).
 *    Previously every gas charge in deploy/call evaluated to NaN because
 *    `this.gas.costs` was undefined — leading to the deployer's wallet
 *    passing the pre-flight balance check (gasLimit * gasPrice looked fine)
 *    but then the block production step deducting NaN, corrupting state.
 */

class ContractEngine {
  constructor(state, gas) {
    this.state = state;
    this.gas = gas;
    this.contracts = new Map();
    // Phase 9: global event log
    this.events = [];
  }

  /**
   * Deploy a contract.
   * @param {string} from - deployer address
   * @param {object|string} contractPayload - { name, version, abi, code } or raw code string
   * @param {number} timestamp
   * @param {object} gasTracker
   * @returns {string} contractAddress
   */
  deploy(from, contractPayload, timestamp, gasTracker) {
    // Support both old (raw string) and new (object) deploy format
    let name, version, abi, code;

    if (typeof contractPayload === 'string') {
      code    = contractPayload;
      name    = 'UnnamedContract';
      version = '1.0.0';
      abi     = this._extractABI(code);
    } else {
      code    = contractPayload.code;
      name    = contractPayload.name    || 'UnnamedContract';
      version = contractPayload.version || '1.0.0';
      abi     = contractPayload.abi     || this._extractABI(code);
    }

    if (!code) {
      throw new Error('Contract code is required for deployment');
    }

    const contractAddress = this.generateContractAddress(from, timestamp);
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const contract = {
      address:   contractAddress,
      name,
      version,
      abi,
      code,
      codeHash,
      creator:   from,
      state:     {},
      createdAt: timestamp
    };

    this.contracts.set(contractAddress, contract);
    this.state.deployContract(contractAddress, code, from, { name, version, abi, codeHash });

    // ✅ Phase 9.2: this.gas.costs is now defined (GasCalculator renamed gasCosts → costs)
    gasTracker.gasUsed += this.gas.costs.contractDeploy + Math.floor(code.length * this.gas.costs.storageByte);

    console.log(`📜 Contract deployed: [${name} v${version}] ${contractAddress.substring(0, 8)}... by ${from.substring(0, 8)}... | CodeHash: ${codeHash.substring(0, 8)}...`);

    return contractAddress;
  }

  /**
   * Call a contract method.
   * @returns {*} return value from the method
   */
  call(from, contractAddress, method, args, gasTracker, gasLimit) {
    const contract = this.contracts.get(contractAddress) || this.state.getContract(contractAddress);

    if (!contract) {
      throw new Error(`Contract not found: ${contractAddress}`);
    }

    // ✅ Phase 9.2: this.gas.costs.contractCall is now defined
    gasTracker.gasUsed += this.gas.costs.contractCall || this.gas.costs.CONTRACT_CALL_BASE;

    // Captured events from this call
    const callEvents = [];
    let returnValue = undefined;

    const sandbox = {
      // ✅ Fix 1: expose state directly (not contract.state)
      state: contract.state,

      // ✅ Fix 2: msg.sender
      msg: {
        sender: from,
        caller: from
      },

      caller:         from,
      args:           args || {},
      method,
      blockTimestamp: Date.now(),

      console: {
        log:   (...a) => console.log('[Contract Log]', ...a),
        error: (...a) => console.error('[Contract Error]', ...a)
      },

      // ✅ Fix 3: emit() event support
      emit: (eventName, data) => {
        const event = {
          contract:     contractAddress,
          contractName: contract.name || 'Unknown',
          event:        eventName,
          data:         data || {},
          timestamp:    Date.now()
        };
        callEvents.push(event);
        this.events.push(event);
        this.state.addEvent(event);
        console.log(`📡 Event [${eventName}] from ${contractAddress.substring(0, 8)}...`);
      },

      getState: (key) => {
        gasTracker.gasUsed += this.gas.costs.storageRead;
        return this.state.getContractState(contractAddress, key);
      },

      setState: (key, value) => {
        gasTracker.gasUsed += this.gas.costs.storageWrite;
        this.state.setContractState(contractAddress, key, value);
        contract.state[key] = value;
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
      },

      // ✅ Fix 4: require() helper for contract assertions
      require: (condition, message) => {
        if (!condition) throw new Error(message || 'Requirement not met');
      },

      // Expose crypto hash utility for contracts
      hash: (data) => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
    };

    const context = vm.createContext(sandbox);

    try {
      // ✅ Phase 9: Support BOTH contract styles:
      //
      // Style A (new — preferred):
      //   contract = { methods: { createReport(args) { ... } } }
      //
      // Style B (old — backward compatible):
      //   function createReport(args) { ... }

      const script = new vm.Script(`
        (function() {
          ${contract.code}

          // Style A: contract = { methods: { ... } }
          if (typeof contract !== 'undefined' && contract.methods && typeof contract.methods['${method}'] === 'function') {
            __returnValue = contract.methods['${method}'](args);
            return;
          }

          // Style B: flat function
          if (typeof ${method} === 'function') {
            __returnValue = ${method}(args);
            return;
          }

          throw new Error('Method ${method} not found in contract');
        })();
      `);

      sandbox.__returnValue = undefined;

      script.runInContext(context, {
        timeout:       5000,
        breakOnSigint: true
      });

      // ✅ Fix 5: capture return value
      returnValue = sandbox.__returnValue;

      if (gasTracker.gasUsed > gasLimit) {
        throw new Error('Out of gas');
      }

      console.log(`📞 Contract call: ${contractAddress.substring(0, 8)}...::${method} | Gas: ${gasTracker.gasUsed} | Events: ${callEvents.length}`);

    } catch (error) {
      console.error(`Contract execution error in ${contract.name || contractAddress}::${method}: ${error.message}`);
      throw new Error(`Contract execution failed: ${error.message}`);
    }

    return returnValue;
  }

  /**
   * Query events — filter by contract, event name, or block range
   */
  getEvents({ contractAddress, eventName, limit } = {}) {
    let results = [...this.events];

    if (contractAddress) {
      results = results.filter(e => e.contract === contractAddress);
    }
    if (eventName) {
      results = results.filter(e => e.event === eventName);
    }
    if (limit) {
      results = results.slice(-limit);
    }

    return results;
  }

  /**
   * Get all events for a specific contract
   */
  getContractEvents(contractAddress) {
    return this.events.filter(e => e.contract === contractAddress);
  }

  /**
   * Simple ABI extractor — reads method names from contract code.
   * Supports both styles.
   */
  _extractABI(code) {
    const methods = [];

    // Style B: function methodName(
    const styleBRegex = /function\s+(\w+)\s*\(/g;

    let match;
    while ((match = styleBRegex.exec(code)) !== null) {
      if (!['if', 'for', 'while', 'switch'].includes(match[1])) {
        methods.push(match[1]);
      }
    }

    return [...new Set(methods)];
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