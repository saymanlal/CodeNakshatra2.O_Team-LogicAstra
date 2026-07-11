/**
 * contracts/dex.js — Phase 14
 *
 * Automated Market Maker (AMM) DEX — Uniswap V2-style constant-product formula.
 * Enables permissionless on-chain token swaps on SAYMAN without an order book.
 *
 * Features:
 *  - Create liquidity pools for any two token addresses
 *  - Add/remove liquidity (LP tokens tracked internally)
 *  - Swap token A → token B using x*y=k invariant
 *  - 0.3% swap fee distributed to liquidity providers
 *  - Works with any tokens deployed via token-factory.js
 *
 * Usage (SDK):
 *   // Add liquidity
 *   client.callContract({ contractAddress: DEX_ADDR, method: 'addLiquidity',
 *     args: { tokenA: 'ADDR_A', tokenB: 'ADDR_B', amountA: 1000, amountB: 2000 }
 *   });
 *   // Swap
 *   client.callContract({ contractAddress: DEX_ADDR, method: 'swap',
 *     args: { tokenIn: 'ADDR_A', tokenOut: 'ADDR_B', amountIn: 100, minAmountOut: 190 }
 *   });
 */

const contract = {
  methods: {

    /**
     * Add liquidity to a token pair pool.
     * Returns the LP shares minted to msg.sender.
     */
    addLiquidity(args) {
      const { tokenA, tokenB, amountA, amountB } = args;
      require(tokenA && tokenB,       'Both token addresses required');
      require(amountA > 0 && amountB > 0, 'Amounts must be positive');
      require(tokenA !== tokenB,       'Cannot create pool for same token');

      // Canonical pool key (sorted so tokenA < tokenB always gives same pool)
      const [t0, t1, a0, a1] = tokenA < tokenB
        ? [tokenA, tokenB, amountA, amountB]
        : [tokenB, tokenA, amountB, amountA];

      const poolKey = `pool_${t0}_${t1}`;
      const pool = getState(poolKey) || { reserve0: 0, reserve1: 0, totalLp: 0 };

      let lpMinted;
      if (pool.totalLp === 0) {
        // Initial liquidity — LP = sqrt(a0 * a1) (integer approximation)
        lpMinted = Math.floor(Math.sqrt(a0 * a1));
        require(lpMinted > 0, 'Insufficient initial liquidity');
      } else {
        // Proportional LP minting — use the smaller ratio to prevent manipulation
        const lp0 = Math.floor((a0 * pool.totalLp) / pool.reserve0);
        const lp1 = Math.floor((a1 * pool.totalLp) / pool.reserve1);
        lpMinted  = Math.min(lp0, lp1);
        require(lpMinted > 0, 'Insufficient liquidity minted');
      }

      pool.reserve0   += a0;
      pool.reserve1   += a1;
      pool.totalLp    += lpMinted;
      setState(poolKey, pool);

      // Track LP balance per provider
      const lpKey = `lp_${poolKey}_${msg.sender}`;
      setState(lpKey, (getState(lpKey) || 0) + lpMinted);

      emit('LiquidityAdded', { token0: t0, token1: t1, amount0: a0, amount1: a1, lpMinted, provider: msg.sender });
      return lpMinted;
    },

    /**
     * Remove liquidity and redeem LP shares.
     * Returns { amount0, amount1 } of tokens redeemed.
     */
    removeLiquidity(args) {
      const { tokenA, tokenB, lpAmount } = args;
      require(tokenA && tokenB, 'Both token addresses required');
      require(lpAmount > 0,     'LP amount must be positive');

      const [t0, t1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
      const poolKey  = `pool_${t0}_${t1}`;
      const pool     = getState(poolKey);
      require(pool && pool.totalLp > 0, 'Pool does not exist or has no liquidity');

      const lpKey  = `lp_${poolKey}_${msg.sender}`;
      const lpBal  = getState(lpKey) || 0;
      require(lpBal >= lpAmount, 'Insufficient LP shares');

      const amount0 = Math.floor((lpAmount * pool.reserve0) / pool.totalLp);
      const amount1 = Math.floor((lpAmount * pool.reserve1) / pool.totalLp);
      require(amount0 > 0 && amount1 > 0, 'Amounts too small');

      pool.reserve0 -= amount0;
      pool.reserve1 -= amount1;
      pool.totalLp  -= lpAmount;
      setState(poolKey, pool);
      setState(lpKey, lpBal - lpAmount);

      emit('LiquidityRemoved', { token0: t0, token1: t1, amount0, amount1, lpBurned: lpAmount, provider: msg.sender });
      return { amount0, amount1 };
    },

    /**
     * Swap exact tokens in for tokens out.
     * Uses x*y=k with 0.3% fee.
     * Returns the actual amountOut received.
     */
    swap(args) {
      const { tokenIn, tokenOut, amountIn, minAmountOut } = args;
      require(tokenIn && tokenOut, 'Both token addresses required');
      require(amountIn > 0,        'Amount must be positive');
      require(tokenIn !== tokenOut,'Cannot swap token for itself');

      const [t0, t1] = tokenIn < tokenOut ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
      const poolKey  = `pool_${t0}_${t1}`;
      const pool     = getState(poolKey);
      require(pool && pool.reserve0 > 0 && pool.reserve1 > 0, 'Pool has no liquidity');

      const zeroForOne = tokenIn < tokenOut;
      const reserveIn  = zeroForOne ? pool.reserve0 : pool.reserve1;
      const reserveOut = zeroForOne ? pool.reserve1 : pool.reserve0;

      // 0.3% fee: effective amountIn = amountIn * 997 / 1000
      const amountInWithFee = Math.floor(amountIn * 997);
      const amountOut = Math.floor(
        (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee)
      );

      require(amountOut > 0, 'Insufficient output amount');
      require(!minAmountOut || amountOut >= minAmountOut, `Slippage: got ${amountOut}, need ${minAmountOut}`);

      if (zeroForOne) {
        pool.reserve0 += amountIn;
        pool.reserve1 -= amountOut;
      } else {
        pool.reserve1 += amountIn;
        pool.reserve0 -= amountOut;
      }
      setState(poolKey, pool);

      emit('Swap', { tokenIn, tokenOut, amountIn, amountOut, trader: msg.sender });
      return amountOut;
    },

    /**
     * Get the current price of tokenA in units of tokenB.
     * Returns amountOut you'd get for 1 unit of tokenA (before fees).
     */
    getPrice(args) {
      const { tokenA, tokenB } = args;
      require(tokenA && tokenB, 'Both token addresses required');

      const [t0, t1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
      const pool     = getState(`pool_${t0}_${t1}`);
      if (!pool || pool.reserve0 === 0) return null;

      return tokenA < tokenB
        ? pool.reserve1 / pool.reserve0
        : pool.reserve0 / pool.reserve1;
    },

    /** Get pool reserves */
    getPool(args) {
      const { tokenA, tokenB } = args;
      const [t0, t1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
      const pool     = getState(`pool_${t0}_${t1}`);
      return pool ? { token0: t0, token1: t1, ...pool } : null;
    },

    /** Get LP balance for an address in a pool */
    getLPBalance(args) {
      const { tokenA, tokenB, address } = args;
      const [t0, t1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
      return getState(`lp_pool_${t0}_${t1}_${address || msg.sender}`) || 0;
    },
  }
};
