// contracts/token.js
// Fully-featured Token (ERC-20 equivalent) Contract — Phase 14
// Deploy: Transaction.createContractDeploy(from, { name: 'SAYNToken', version: '1.0.0', code: <this file> })

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

    burn(args) {
      const from = msg.sender;
      const { amount } = args;
      require(amount > 0, 'Amount must be positive');

      const balances = getState('balances') || {};
      require((balances[from] || 0) >= amount, 'Insufficient token balance');

      balances[from] -= amount;
      setState('balances', balances);

      const supply = (getState('totalSupply') || 0) - amount;
      setState('totalSupply', supply);

      emit('BURN', { from, amount, totalSupply: supply });
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

    approve(args) {
      const owner = msg.sender;
      const { spender, amount } = args;

      require(spender, 'Spender address required');
      require(amount >= 0, 'Amount must be non-negative');

      const allowances = getState('allowances') || {};
      if (!allowances[owner]) allowances[owner] = {};
      allowances[owner][spender] = amount;
      setState('allowances', allowances);

      emit('APPROVAL', { owner, spender, amount });
      return true;
    },

    transferFrom(args) {
      const spender = msg.sender;
      const { from, to, amount } = args;

      require(from, 'Sender address required');
      require(to,   'Recipient address required');
      require(amount > 0, 'Amount must be positive');

      const balances = getState('balances') || {};
      require((balances[from] || 0) >= amount, 'Insufficient balance');

      const allowances = getState('allowances') || {};
      const allowed = (allowances[from] || {})[spender] || 0;
      require(allowed >= amount, 'Transfer amount exceeds allowance');

      balances[from] -= amount;
      balances[to]    = (balances[to] || 0) + amount;
      setState('balances', balances);

      allowances[from][spender] = allowed - amount;
      setState('allowances', allowances);

      emit('TRANSFER', { from, to, amount });
      return true;
    },

    allowance(args) {
      const { owner, spender } = args;
      const allowances = getState('allowances') || {};
      return (allowances[owner] || {})[spender] || 0;
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
      return true;
    }

  }
};