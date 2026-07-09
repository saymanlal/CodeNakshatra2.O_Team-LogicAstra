/**
 * contracts/memecoin-factory.js — Phase 14
 *
 * One-click memecoin/community token launcher for SAYMAN.
 * Anyone can create a fully-featured token with:
 *   - Custom name, ticker, supply, icon URL
 *   - Optional burn mechanism (deflationary)
 *   - Optional max wallet limit (anti-whale)
 *   - Optional transfer tax routed to treasury address
 *   - Auto-listing in a global registry
 *
 * Usage (SDK):
 *   client.callContract({
 *     contractAddress: MEMECOIN_FACTORY_ADDR,
 *     method: 'launch',
 *     args: {
 *       name: 'DOGE ON SAYMAN',
 *       symbol: 'SDOGE',
 *       totalSupply: 1000000000,
 *       iconUrl: 'https://example.com/sdoge.png',
 *       maxWalletPercent: 2,       // 2% max wallet (anti-whale). 0 = disabled
 *       transferTaxPercent: 1,     // 1% tax to treasury. 0 = disabled
 *       treasury: '<ADDR>',        // where tax goes
 *       burnOnTransfer: false,     // burn 0.5% of each transfer
 *     }
 *   });
 */

const contract = {
  methods: {

    /**
     * Launch a new memecoin/community token.
     * Returns the token address.
     */
    launch(args) {
      const {
        name, symbol, totalSupply,
        iconUrl,
        maxWalletPercent,
        transferTaxPercent,
        treasury,
        burnOnTransfer,
      } = args;

      require(name,          'Token name is required');
      require(symbol,        'Token symbol is required');
      require(totalSupply > 0, 'Total supply must be > 0');

      const tokenAddr = generateAddress(`memecoin:${msg.sender}:${symbol}:${Date.now()}`);
      require(!getState('exists_' + tokenAddr), 'Token already exists');

      // Store token config
      setState('name_'         + tokenAddr, name);
      setState('symbol_'       + tokenAddr, symbol);
      setState('supply_'       + tokenAddr, totalSupply);
      setState('owner_'        + tokenAddr, msg.sender);
      setState('icon_'         + tokenAddr, iconUrl || '');
      setState('maxWallet_'    + tokenAddr, maxWalletPercent || 0);
      setState('transferTax_'  + tokenAddr, transferTaxPercent || 0);
      setState('treasury_'     + tokenAddr, treasury || msg.sender);
      setState('burn_'         + tokenAddr, !!burnOnTransfer);
      setState('exists_'       + tokenAddr, true);

      // Mint full supply to creator
      setState(`bal_${tokenAddr}_${msg.sender}`, totalSupply);

      // Add to global registry
      const registry = getState('registry') || [];
      registry.push({
        address: tokenAddr, name, symbol, creator: msg.sender,
        totalSupply, createdAt: blockTimestamp
      });
      setState('registry', registry);

      const count = (getState('count') || 0) + 1;
      setState('count', count);

      emit('MemecoinLaunched', {
        address: tokenAddr, name, symbol, totalSupply,
        creator: msg.sender, iconUrl, transferTaxPercent,
        maxWalletPercent, burnOnTransfer
      });
      return tokenAddr;
    },

    /** Transfer tokens with tax/burn mechanics applied */
    transfer(args) {
      const { tokenAddr, to, amount } = args;
      require(tokenAddr, 'Token address required');
      require(to,        'Recipient required');
      require(amount > 0,'Amount must be positive');

      require(getState('exists_' + tokenAddr), 'Token does not exist');

      const fromKey = `bal_${tokenAddr}_${msg.sender}`;
      const fromBal = getState(fromKey) || 0;
      require(fromBal >= amount, 'Insufficient balance');

      let taxAmt  = 0;
      let burnAmt = 0;

      // Transfer tax
      const taxPct = getState('transferTax_' + tokenAddr) || 0;
      if (taxPct > 0) {
        taxAmt = Math.floor(amount * taxPct / 100);
        const treasury = getState('treasury_' + tokenAddr);
        if (treasury && taxAmt > 0) {
          setState(`bal_${tokenAddr}_${treasury}`, (getState(`bal_${tokenAddr}_${treasury}`) || 0) + taxAmt);
        }
      }

      // Burn on transfer (0.5%)
      const burnEnabled = getState('burn_' + tokenAddr);
      if (burnEnabled) {
        burnAmt = Math.floor(amount * 5 / 1000); // 0.5%
        const supply = (getState('supply_' + tokenAddr) || 0) - burnAmt;
        setState('supply_' + tokenAddr, Math.max(0, supply));
      }

      const netAmount = amount - taxAmt - burnAmt;
      require(netAmount > 0, 'Amount too small after fees');

      // Anti-whale check
      const maxWalletPct = getState('maxWallet_' + tokenAddr) || 0;
      if (maxWalletPct > 0) {
        const supply     = getState('supply_' + tokenAddr) || 1;
        const toNewBal   = (getState(`bal_${tokenAddr}_${to}`) || 0) + netAmount;
        const maxAllowed = Math.floor(supply * maxWalletPct / 100);
        require(toNewBal <= maxAllowed, `Anti-whale: max wallet is ${maxWalletPct}% of supply`);
      }

      setState(fromKey, fromBal - amount);
      setState(`bal_${tokenAddr}_${to}`, (getState(`bal_${tokenAddr}_${to}`) || 0) + netAmount);

      emit('Transfer', { tokenAddr, from: msg.sender, to, amount, netAmount, taxAmt, burnAmt });
      return netAmount;
    },

    /** Query token balance */
    balanceOf(args) {
      return getState(`bal_${args.tokenAddr}_${args.address}`) || 0;
    },

    /** Get token metadata */
    getToken(args) {
      const t = args.tokenAddr;
      if (!getState('exists_' + t)) return null;
      return {
        address:           t,
        name:              getState('name_'        + t),
        symbol:            getState('symbol_'      + t),
        totalSupply:       getState('supply_'      + t),
        owner:             getState('owner_'       + t),
        iconUrl:           getState('icon_'        + t),
        maxWalletPercent:  getState('maxWallet_'   + t),
        transferTaxPercent:getState('transferTax_' + t),
        treasury:          getState('treasury_'    + t),
        burnOnTransfer:    getState('burn_'        + t),
      };
    },

    /** List all launched tokens */
    listTokens(_args) {
      return getState('registry') || [];
    },

    /** Total number of tokens launched */
    tokenCount(_args) {
      return getState('count') || 0;
    },
  }
};
