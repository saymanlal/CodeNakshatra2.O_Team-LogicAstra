/**
 * contracts/token-factory.js — Phase 14
 *
 * A factory contract that lets anyone deploy their own ERC-20–style
 * token contracts ON-CHAIN without needing to write raw JS.
 *
 * Deploy this factory once on the L1. Then anyone can call
 * `createToken(name, symbol, totalSupply)` to mint their own token
 * contract whose address is deterministically derived.
 *
 * Usage (SDK):
 *   client.callContract({
 *     contractAddress: FACTORY_ADDRESS,
 *     method: 'createToken',
 *     args: { name: 'My Token', symbol: 'MTK', totalSupply: 1000000 }
 *   });
 */

const contract = {
  methods: {

    /**
     * Create a new token and register it in the factory.
     * @param {{ name: string, symbol: string, totalSupply: number }} args
     * @returns {string} The new token contract's deterministic address
     */
    createToken(args) {
      const { name, symbol, totalSupply } = args;
      require(name,   'Token name is required');
      require(symbol, 'Token symbol is required');
      require(totalSupply > 0, 'Total supply must be positive');

      // Derive unique deterministic contract address
      const tokenAddr = generateAddress(`token:${msg.sender}:${symbol}:${Date.now()}`);

      // Prevent double-creation with same address
      require(!getState('token_exists_' + tokenAddr), 'Token already exists');

      // Register token metadata
      setState('token_name_' + tokenAddr,   name);
      setState('token_symbol_' + tokenAddr, symbol);
      setState('token_supply_' + tokenAddr, totalSupply);
      setState('token_owner_' + tokenAddr,  msg.sender);
      setState('token_exists_' + tokenAddr, true);

      // Mint full supply to creator
      setState(`token_balance_${tokenAddr}_${msg.sender}`, totalSupply);

      // Maintain token registry
      const tokens = getState('all_tokens') || [];
      tokens.push({ address: tokenAddr, name, symbol, creator: msg.sender, supply: totalSupply });
      setState('all_tokens', tokens);

      const count = (getState('token_count') || 0) + 1;
      setState('token_count', count);

      emit('TokenCreated', { address: tokenAddr, name, symbol, creator: msg.sender, totalSupply });
      return tokenAddr;
    },

    /**
     * Transfer tokens within the factory's state.
     */
    transferToken(args) {
      const { tokenAddr, to, amount } = args;
      require(tokenAddr, 'Token address is required');
      require(to,        'Recipient is required');
      require(amount > 0, 'Amount must be positive');

      const fromBal = getState(`token_balance_${tokenAddr}_${msg.sender}`) || 0;
      require(fromBal >= amount, 'Insufficient token balance');

      setState(`token_balance_${tokenAddr}_${msg.sender}`, fromBal - amount);
      const toBal = getState(`token_balance_${tokenAddr}_${to}`) || 0;
      setState(`token_balance_${tokenAddr}_${to}`, toBal + amount);

      emit('TokenTransfer', { tokenAddr, from: msg.sender, to, amount });
      return true;
    },

    /** Query token balance */
    balanceOf(args) {
      return getState(`token_balance_${args.tokenAddr}_${args.address}`) || 0;
    },

    /** Get token metadata */
    getToken(args) {
      const addr = args.tokenAddr;
      if (!getState('token_exists_' + addr)) return null;
      return {
        address: addr,
        name:    getState('token_name_'   + addr),
        symbol:  getState('token_symbol_' + addr),
        supply:  getState('token_supply_' + addr),
        owner:   getState('token_owner_'  + addr),
      };
    },

    /** List all tokens */
    listTokens(_args) {
      return getState('all_tokens') || [];
    },

    /** Count of tokens created */
    tokenCount(_args) {
      return getState('token_count') || 0;
    },
  }
};
