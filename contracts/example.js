// contracts/example.js
// Example Counter Contract — Phase 9 style
// Deploy: Transaction.createContractDeploy(from, { name: 'Counter', version: '1.0.0', code: <this file> })

const contract = {
  methods: {

    increment(_args) {
      const count = (getState('count') || 0) + 1;
      setState('count', count);
      emit('COUNT_CHANGED', { count, action: 'increment', by: caller });
      return count;
    },

    decrement(_args) {
      const count = (getState('count') || 0) - 1;
      setState('count', count);
      emit('COUNT_CHANGED', { count, action: 'decrement', by: caller });
      return count;
    },

    setValue(args) {
      require(typeof args.value === 'number', 'value must be a number');
      setState('count', args.value);
      emit('COUNT_CHANGED', { count: args.value, action: 'set', by: caller });
      return args.value;
    },

    getCount(_args) {
      return getState('count') || 0;
    }

  }
};