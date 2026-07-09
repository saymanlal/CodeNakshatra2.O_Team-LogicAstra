// contracts/layer2Bridge.js
// Layer 2 Bridge and Anchor Contract for SAYMAN Blockchain
// Deploy: Transaction.createContractDeploy(from, { name: 'Layer2Bridge', version: '1.0.0', code: <this file> })

const contract = {
  methods: {
    // Register a new Layer 2/Multi-layer chain
    registerChain(args) {
      const owner = getState('owner');
      require(msg.sender === owner || !owner, 'Only owner can register a chain');
      if (!owner) {
        setState('owner', msg.sender);
      }

      const { chainId, name, sequencer } = args;
      require(chainId, 'Chain ID is required');
      require(name, 'Chain name is required');
      require(sequencer, 'Sequencer address is required');

      setState('name_' + chainId, name);
      setState('sequencer_' + chainId, sequencer);
      setState('height_' + chainId, 0);
      setState('registered_' + chainId, true);

      emit('ChainRegistered', { chainId, name, sequencer, creator: msg.sender });
      return true;
    },

    // Commit L2 state root to L1 anchor
    commitState(args) {
      const { chainId, blockIndex, stateRoot, txCount } = args;
      require(chainId, 'Chain ID is required');
      require(stateRoot, 'State root is required');
      require(blockIndex > 0, 'Block index must be positive');

      const isRegistered = getState('registered_' + chainId);
      require(isRegistered, 'Chain is not registered');

      const sequencer = getState('sequencer_' + chainId);
      require(msg.sender === sequencer, 'Only the designated sequencer can commit L2 state');

      const currentHeight = getState('height_' + chainId) || 0;
      require(blockIndex === currentHeight + 1, 'Block index must be sequential');

      setState('state_' + chainId + '_' + blockIndex, stateRoot);
      setState('height_' + chainId, blockIndex);

      emit('StateCommitted', { chainId, blockIndex, stateRoot, txCount, committer: msg.sender });
      return blockIndex;
    },

    // Deposit L1 tokens (SAYN) to bridge into Layer 2
    // User transfers L1 tokens to this contract and then calls deposit()
    deposit(args) {
      const { chainId, toAddress, amount } = args;
      require(chainId, 'Chain ID is required');
      require(toAddress, 'L2 recipient address is required');
      require(amount > 0, 'Amount must be positive');

      const isRegistered = getState('registered_' + chainId);
      require(isRegistered, 'Chain is not registered');

      emit('Deposit', { chainId, depositor: msg.sender, L2Address: toAddress, amount });
      return true;
    },

    // Withdraw tokens from L2 back to L1
    // Called by L2 sequencer after processing L2 burn/withdrawal
    withdraw(args) {
      const { chainId, to, amount } = args;
      require(chainId, 'Chain ID is required');
      require(to, 'Recipient address is required');
      require(amount > 0, 'Amount must be positive');

      const isRegistered = getState('registered_' + chainId);
      require(isRegistered, 'Chain is not registered');

      const sequencer = getState('sequencer_' + chainId);
      require(msg.sender === sequencer, 'Only the designated sequencer can authorize withdrawals');

      // Transfer tokens from the contract L1 balance to the recipient
      transfer(to, amount);

      emit('Withdrawal', { chainId, recipient: to, amount });
      return true;
    },

    // Query helper for current height of L2 chain
    getChainHeight(args) {
      const { chainId } = args;
      return getState('height_' + chainId) || 0;
    },

    // Query helper for L2 state root at block index
    getStateRoot(args) {
      const { chainId, blockIndex } = args;
      return getState('state_' + chainId + '_' + blockIndex) || null;
    }
  }
};
