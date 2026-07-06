// contracts/token.js
// Simple Token Contract — Phase 9 style
// Deploy: Transaction.createContractDeploy(from, { name: 'SAYMToken', version: '1.0.0', code: <this file> })
//
// FIX: the VM sandbox in core/contracts.js does not inject a bare global
// `state` object — persistent storage is only reachable through
// getState(key) / setState(key, value). The previous version referenced
// `state.owner` directly, which is undefined and threw a ReferenceError on
// every call to mint() and setOwner(). Fixed below to read/write the owner
// through getState/setState like every other piece of contract state.

const contract = {
  methods: {

    mint(args) {
      const owner = getState('owner');
      require(msg.sender === owner || !owner, 'Only owner can mint');

      const { to, amount } = args;
      require(to,          'Recipient address required');
      require(amount > 0,  'Amount must be positive');

      const balances = getState('balances') || {};
      balances[to]   = (balances[to] || 0) + amount;
      setState('balances', balances);

      const supply = (getState('totalSupply') || 0) + amount;
      setState('totalSupply', supply);

      emit('MINT', { to, amount, totalSupply: supply });
      return supply;
    },

    transfer(args) {
      const from = msg.sender;
      const { to, amount } = args;

      require(to,         'Recipient address required');
      require(amount > 0, 'Amount must be positive');

      const balances = getState('balances') || {};
      require((balances[from] || 0) >= amount, 'Insufficient token balance');

      balances[from] -= amount;
      balances[to]    = (balances[to] || 0) + amount;
      setState('balances', balances);

      emit('TRANSFER', { from, to, amount });
      return true;
    },

    balanceOf(args) {
      const balances = getState('balances') || {};
      return balances[args.address] || 0;
    },

    totalSupply(_args) {
      return getState('totalSupply') || 0;
    },

    setOwner(args) {
      const owner = getState('owner');
      require(!owner || msg.sender === owner, 'Not authorized');
      setState('owner', args.owner);
      emit('OWNER_SET', { owner: args.owner });
    }

  }
};