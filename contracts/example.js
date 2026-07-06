// contracts/example.js
// Example Counter Contract — Phase 9 style
// Deploy: Transaction.createContractDeploy(from, { name: 'Counter', version: '1.0.0', code: <this file> })
//
// FIX: the VM sandbox in core/contracts.js only injects `msg` (with
// `msg.sender` / `msg.caller`), not a bare global `caller`. The previous
// version of this file referenced `caller`, which is undefined inside the
// sandbox and threw a ReferenceError on every call. Fixed below.

const contract = {
  methods: {

    increment(_args) {
      const count = (getState('count') || 0) + 1;
      setState('count', count);
      emit('COUNT_CHANGED', { count, action: 'increment', by: msg.sender });
      return count;
    },

    decrement(_args) {
      const count = (getState('count') || 0) - 1;
      setState('count', count);
      emit('COUNT_CHANGED', { count, action: 'decrement', by: msg.sender });
      return count;
    },

    setValue(args) {
      require(typeof args.value === 'number', 'value must be a number');
      setState('count', args.value);
      emit('COUNT_CHANGED', { count: args.value, action: 'set', by: msg.sender });
      return args.value;
    },

    getCount(_args) {
      return getState('count') || 0;
    }

  }
};