/**
 * ContractEngine — SAYMAN Chain
 *
 * Key improvements over previous version:
 *
 * 1. STATE PERSISTENCE — the single most critical fix.
 *    Previously contract.state mutations inside the sandbox were not written
 *    back to the chain's state store. setState() now calls both
 *    state.setContractState() AND updates contract.state in-memory so both
 *    the persistent store and the in-memory contracts Map stay in sync.
 *    On next call, state is loaded from the persistent store first.
 *
 * 2. SPONSORSHIP / FEE POLICY
 *    Contracts declare feePolicy at deploy time:
 *      'user'    — gas paid by tx sender (default)
 *      'sponsor' — gas paid from deployer's sponsor balance
 *      'free'    — no gas charged at all (testnet / internal apps)
 *    GasCalculator.resolveFeePolicy() handles routing.
 *
 * 3. CLEAN CONTRACT FORMAT
 *    Contracts are plain JS classes or objects. The VM wraps them safely.
 *    Three styles supported (backward compatible):
 *      A. Class: class MyContract { createReport(args) { ... } }
 *      B. Object: const contract = { methods: { createReport(args){} } }
 *      C. Flat functions: function createReport(args) { ... }
 *
 * 4. RETURN VALUES & EVENTS
 *    Method return values are captured and passed back to the caller.
 *    emit() logs events to both in-memory array and persistent state store.
 *
 * 5. READABLE LOGS
 *    Every deploy and call logs name, method, gas used, and events emitted.
 */

import crypto from 'crypto';
import vm from 'vm';

class ContractEngine {
  constructor(state, gas) {
    this.state    = state;
    this.gas      = gas;
    this.contracts = new Map();   // in-memory cache
    this.events    = [];          // global event log (in-memory)
  }

  // ─── Deploy ────────────────────────────────────────────────────────────────

  /**
   * @param {string} from - deployer address
   * @param {object|string} payload - { name, version, abi, code, feePolicy? } or raw string
   * @param {number} timestamp
   * @param {object} gasTracker
   * @returns {string} contractAddress
   */
  deploy(from, payload, timestamp, gasTracker) {
    let name, version, abi, code, feePolicy;

    if (typeof payload === 'string') {
      code       = payload;
      name       = 'Contract';
      version    = '1.0.0';
      abi        = this._extractABI(code);
      feePolicy  = 'user';
    } else {
      code       = payload.code;
      name       = payload.name       || 'Contract';
      version    = payload.version    || '1.0.0';
      abi        = payload.abi        || this._extractABI(code);
      feePolicy  = payload.feePolicy  || 'user';   // 'user' | 'sponsor' | 'free'
    }

    if (!code) throw new Error('Contract code is required');

    // Validate feePolicy value
    if (!['user', 'sponsor', 'free'].includes(feePolicy)) {
      throw new Error(`Invalid feePolicy: ${feePolicy}. Must be 'user', 'sponsor', or 'free'`);
    }

    const contractAddress = this._generateAddress(from, timestamp);
    const codeHash        = crypto.createHash('sha256').update(code).digest('hex');

    // Charge gas: base deploy cost + 1 gas unit per 10 bytes of code
    const deployGas = this.gas.costs.contractDeploy + Math.floor(code.length / 10);
    gasTracker.gasUsed += deployGas;

    const contract = {
      address:     contractAddress,
      name,
      version,
      abi,
      code,
      codeHash,
      creator:     from,
      feePolicy,
      state:       {},              // persistent state — key/value store
      sponsorBalance: 0,           // base units available for 'sponsor' policy
      createdAt:   timestamp,
    };

    // Save to in-memory cache
    this.contracts.set(contractAddress, contract);

    // Save to persistent state store
    this.state.deployContract(contractAddress, code, from, {
      name, version, abi, codeHash, feePolicy,
    });

    console.log(
      `📜 Deployed [${name} v${version}] ${contractAddress.slice(0, 8)}...` +
      ` by ${from.slice(0, 8)}... | policy: ${feePolicy} | gas: ${deployGas}`
    );

    return contractAddress;
  }

  // ─── Call ──────────────────────────────────────────────────────────────────

  /**
   * @param {string} from - caller address
   * @param {string} contractAddress
   * @param {string} method
   * @param {object} args
   * @param {object} gasTracker
   * @param {number} gasLimit - caller's declared gasLimit
   * @returns {*} return value from method
   */
  call(from, contractAddress, method, args, gasTracker, gasLimit) {
    // Load contract — persistent store is source of truth, in-memory is cache
    const contract = this._loadContract(contractAddress);
    if (!contract) throw new Error(`Contract not found: ${contractAddress}`);

    // Resolve fee policy
    const feeInfo = this.gas.resolveFeePolicy(contract, from);

    // Base call gas charge
    gasTracker.gasUsed += this.gas.costs.contractCall;

    const callEvents = [];
    let returnValue  = undefined;

    // ─── Sandbox ────────────────────────────────────────────────────────────
    // Load current persistent state snapshot for this contract
    const persistedState = this.state.getContractFullState(contractAddress) || {};
    // Merge with in-memory (persistent is authoritative)
    const stateSnapshot  = { ...contract.state, ...persistedState };

    const sandbox = {
      // msg — standard across all contract calls
      msg: { sender: from, caller: from },

      // args passed to this method call
      args: args || {},

      // blockTimestamp — available for contracts that need it
      blockTimestamp: Date.now(),

      // Safe console inside contract VM
      console: {
        log:   (...a) => console.log(`  [${contract.name}]`, ...a),
        error: (...a) => console.error(`  [${contract.name}]`, ...a),
      },

      // ── State access ──────────────────────────────────────────────────────
      // getState / setState persist through both in-memory AND state store.
      // This is the core fix: mutations inside the VM are not lost.
      getState: (key) => {
        gasTracker.gasUsed += this.gas.costs.storageRead;
        gasTracker.stateReads++;
        const value = this.state.getContractState(contractAddress, key)
                   ?? stateSnapshot[key];
        return value;
      },

      setState: (key, value) => {
        gasTracker.gasUsed += this.gas.costs.storageWrite;
        gasTracker.stateWrites++;
        // Write to persistent store
        this.state.setContractState(contractAddress, key, value);
        // Keep in-memory contract in sync
        contract.state[key]    = value;
        stateSnapshot[key]     = value;
      },

      // ── Token transfers from contract ────────────────────────────────────
      transfer: (to, amount) => {
        gasTracker.gasUsed += this.gas.costs.transfer;
        const bal = this.state.getBalance(contractAddress);
        if (bal < amount) throw new Error(`Contract balance too low: has ${bal}, needs ${amount}`);
        this.state.subtractBalance(contractAddress, amount);
        this.state.addBalance(to, amount);
      },

      getBalance: (address) => {
        gasTracker.gasUsed += this.gas.costs.storageRead;
        return this.state.getBalance(address);
      },

      // ── Events ───────────────────────────────────────────────────────────
      emit: (eventName, data) => {
        const event = {
          contract:     contractAddress,
          contractName: contract.name,
          event:        eventName,
          data:         data || {},
          timestamp:    Date.now(),
        };
        callEvents.push(event);
        this.events.push(event);
        this.state.addEvent(event);
      },

      // ── Utility ──────────────────────────────────────────────────────────
      require: (condition, message) => {
        if (!condition) throw new Error(message || 'Requirement failed');
      },

      hash: (data) =>
        crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),

      // For contracts that need to generate addresses (e.g. sub-contracts)
      generateAddress: (seed) =>
        crypto.createHash('sha256').update(seed + Date.now()).digest('hex').slice(0, 40),

      // Internal — captured return value
      __returnValue: undefined,
    };

    const context = vm.createContext(sandbox);

    // ─── Execution ──────────────────────────────────────────────────────────
    try {
      const script = new vm.Script(`
        (function() {
          ${contract.code}

          // Style A: class MyContract { methodName(args) {} }
          // Instantiate with current state so 'this' works normally
          const _classes = Object.keys(globalThis).filter(k => {
            try { return typeof globalThis[k] === 'function' && /^[A-Z]/.test(k); } catch { return false; }
          });
          for (const _cls of _classes) {
            try {
              const _inst = new globalThis[_cls]();
              if (typeof _inst['${method}'] === 'function') {
                // Give instance access to state helpers via 'this.state'
                _inst.getState  = getState;
                _inst.setState  = setState;
                _inst.emit      = emit;
                _inst.transfer  = transfer;
                _inst.getBalance = getBalance;
                _inst.require   = require;
                _inst.msg       = msg;
                __returnValue   = _inst['${method}'](args);
                return;
              }
            } catch (_e) {}
          }

          // Style B: const contract = { methods: { methodName(args){} } }
          if (typeof contract !== 'undefined' && contract && contract.methods &&
              typeof contract.methods['${method}'] === 'function') {
            __returnValue = contract.methods['${method}'](args);
            return;
          }

          // Style C: flat function methodName(args) {}
          if (typeof ${method} === 'function') {
            __returnValue = ${method}(args);
            return;
          }

          throw new Error('Method not found: ${method}');
        })();
      `);

      script.runInContext(context, {
        timeout:       this.gas.limits.maxExecutionTime || 5000,
        breakOnSigint: true,
      });

      returnValue = sandbox.__returnValue;

    } catch (err) {
      throw new Error(`${contract.name}::${method} failed — ${err.message}`);
    }

    // ─── Gas limit check ────────────────────────────────────────────────────
    if (gasTracker.gasUsed > gasLimit) {
      throw new Error(
        `Out of gas: used ${gasTracker.gasUsed}, limit ${gasLimit}`
      );
    }

    console.log(
      `📞 ${contract.name}::${method} | gas: ${gasTracker.gasUsed}` +
      ` | reads: ${gasTracker.stateReads} | writes: ${gasTracker.stateWrites}` +
      ` | events: ${callEvents.length} | fee: ${feeInfo.payer}`
    );

    return returnValue;
  }

  // ─── Query (read-only, no gas) ────────────────────────────────────────────

  /**
   * Read-only contract call — no gas charged, state writes are silently ignored.
   * Use for frontend queries like getBalance(), getReport(), etc.
   */
  query(contractAddress, method, args) {
    const contract = this._loadContract(contractAddress);
    if (!contract) throw new Error(`Contract not found: ${contractAddress}`);

    const persistedState = this.state.getContractFullState(contractAddress) || {};
    const stateSnapshot  = { ...contract.state, ...persistedState };

    const sandbox = {
      msg:            { sender: '0x0', caller: '0x0' },
      args:           args || {},
      blockTimestamp: Date.now(),
      console:        { log: () => {}, error: () => {} },

      getState:       (key) => stateSnapshot[key] ?? this.state.getContractState(contractAddress, key),
      setState:       () => {},   // no-op in query mode
      emit:           () => {},
      transfer:       () => { throw new Error('transfer not allowed in query'); },
      getBalance:     (address) => this.state.getBalance(address),
      require:        (cond, msg) => { if (!cond) throw new Error(msg || 'Requirement failed'); },
      hash:           (data) => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      __returnValue:  undefined,
    };

    const context = vm.createContext(sandbox);

    new vm.Script(`
      (function() {
        ${contract.code}

        const _classes = Object.keys(globalThis).filter(k => {
          try { return typeof globalThis[k] === 'function' && /^[A-Z]/.test(k); } catch { return false; }
        });
        for (const _cls of _classes) {
          try {
            const _inst = new globalThis[_cls]();
            if (typeof _inst['${method}'] === 'function') {
              _inst.getState = getState; _inst.setState = setState;
              _inst.emit = emit; _inst.require = require;
              _inst.msg = msg;
              __returnValue = _inst['${method}'](args);
              return;
            }
          } catch {}
        }
        if (typeof contract !== 'undefined' && contract?.methods?.['${method}']) {
          __returnValue = contract.methods['${method}'](args); return;
        }
        if (typeof ${method} === 'function') {
          __returnValue = ${method}(args); return;
        }
        throw new Error('Method not found: ${method}');
      })();
    `).runInContext(context, { timeout: 2000 });

    return sandbox.__returnValue;
  }

  // ─── Sponsor balance management ───────────────────────────────────────────

  /**
   * Deployer tops up the contract's sponsor gas tank.
   * Called when feePolicy is 'sponsor' and deployer sends SAYN to fund user txs.
   */
  topUpSponsorBalance(contractAddress, amountBaseUnits) {
    const contract = this._loadContract(contractAddress);
    if (!contract) throw new Error(`Contract not found: ${contractAddress}`);
    contract.sponsorBalance = (contract.sponsorBalance || 0) + amountBaseUnits;
    this.state.setContractMeta(contractAddress, 'sponsorBalance', contract.sponsorBalance);
    console.log(`💰 Sponsor balance topped up: ${contractAddress.slice(0, 8)}... +${amountBaseUnits} base units`);
  }

  getSponsorBalance(contractAddress) {
    const contract = this._loadContract(contractAddress);
    return contract?.sponsorBalance || 0;
  }

  // ─── Event queries ────────────────────────────────────────────────────────

  getEvents({ contractAddress, eventName, limit } = {}) {
    let results = [...this.events];
    if (contractAddress) results = results.filter(e => e.contract === contractAddress);
    if (eventName)       results = results.filter(e => e.event   === eventName);
    if (limit)           results = results.slice(-limit);
    return results;
  }

  getContractEvents(contractAddress) {
    return this.events.filter(e => e.contract === contractAddress);
  }

  // ─── Registry ─────────────────────────────────────────────────────────────

  getContract(address) {
    return this._loadContract(address);
  }

  getAllContracts() {
    const stateContracts = this.state.getAllContracts?.() || [];
    const combined = new Map(this.contracts);
    stateContracts.forEach(c => {
      if (!combined.has(c.address)) combined.set(c.address, c);
    });
    return Array.from(combined.values());
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  // Load from in-memory cache first, fall back to persistent state store.
  _loadContract(address) {
    if (this.contracts.has(address)) return this.contracts.get(address);
    const persisted = this.state.getContract(address);
    if (persisted) {
      this.contracts.set(address, persisted); // warm the cache
      return persisted;
    }
    return null;
  }

  _generateAddress(from, timestamp) {
    return crypto
      .createHash('sha256')
      .update(from + timestamp.toString())
      .digest('hex')
      .slice(0, 40);
  }

  // Extracts method names from flat-function style contracts for ABI generation.
  _extractABI(code) {
    const methods   = [];
    const fnRegex   = /function\s+(\w+)\s*\(/g;
    let match;
    const reserved  = new Set(['if', 'for', 'while', 'switch', 'catch', 'function']);
    while ((match = fnRegex.exec(code)) !== null) {
      if (!reserved.has(match[1])) methods.push(match[1]);
    }
    return [...new Set(methods)];
  }
}

export default ContractEngine;