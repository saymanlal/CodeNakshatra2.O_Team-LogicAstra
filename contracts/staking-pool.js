/**
 * contracts/staking-pool.js — Phase 14
 *
 * A delegated staking pool contract for SAYMAN.
 * Anyone can delegate SAYN to this pool and earn a share of block rewards
 * proportional to their contribution — without running a validator node themselves.
 *
 * The pool operator (owner) runs the validator node.
 * Rewards flow: Block Reward → Pool Contract → Distributed to delegators pro-rata.
 *
 * Usage (SDK):
 *   // Delegate stake to pool
 *   client.callContract({ contractAddress: POOL_ADDR, method: 'delegate',
 *     args: { amount: 1000000 }
 *   });
 *   // Claim pending rewards
 *   client.callContract({ contractAddress: POOL_ADDR, method: 'claimRewards', args: {} });
 *   // Undelegate
 *   client.callContract({ contractAddress: POOL_ADDR, method: 'undelegate',
 *     args: { amount: 500000 }
 *   });
 */

const contract = {
  methods: {

    /** Initialize the pool (called by owner on first use) */
    initialize(args) {
      const owner = getState('owner');
      require(!owner || msg.sender === owner, 'Already initialized');
      setState('owner',           msg.sender);
      setState('operatorFee',     args.operatorFee || 10); // 10% default
      setState('totalDelegated',  0);
      setState('totalRewards',    0);
      setState('rewardPerShare',  0);
      emit('Initialized', { owner: msg.sender });
      return true;
    },

    /**
     * Delegate SAYN to this staking pool.
     * The amount must have already been transferred to this contract's balance.
     */
    delegate(args) {
      const { amount } = args;
      require(amount > 0, 'Amount must be positive');

      const rewardPerShare = getState('rewardPerShare') || 0;

      // Update delegator state
      const delKey    = `del_${msg.sender}`;
      const delDebt   = `debt_${msg.sender}`;
      const existing  = getState(delKey) || 0;
      const oldDebt   = getState(delDebt) || 0;

      // Settle pending rewards at current rewardPerShare before adding more
      const pending = existing > 0
        ? Math.floor(existing * (rewardPerShare - oldDebt) / 1e12)
        : 0;
      if (pending > 0) {
        setState(`pending_${msg.sender}`, (getState(`pending_${msg.sender}`) || 0) + pending);
      }

      setState(delKey,  existing + amount);
      setState(delDebt, rewardPerShare);

      const total = (getState('totalDelegated') || 0) + amount;
      setState('totalDelegated', total);

      emit('Delegated', { delegator: msg.sender, amount, totalDelegated: total });
      return total;
    },

    /**
     * Called by the pool owner when block rewards arrive.
     * Distributes rewards proportionally to all delegators.
     */
    distributeRewards(args) {
      const owner = getState('owner');
      require(msg.sender === owner, 'Only owner can distribute rewards');

      const { amount } = args;
      require(amount > 0, 'Amount must be positive');

      const total = getState('totalDelegated') || 0;
      require(total > 0, 'No delegators in pool');

      const operatorFee = getState('operatorFee') || 10;
      const ownerCut    = Math.floor(amount * operatorFee / 100);
      const toShare     = amount - ownerCut;

      // Accumulate reward per share (scaled by 1e12 for precision)
      const rps = getState('rewardPerShare') || 0;
      setState('rewardPerShare', rps + Math.floor(toShare * 1e12 / total));
      setState('totalRewards', (getState('totalRewards') || 0) + amount);

      emit('RewardsDistributed', { amount, operatorCut: ownerCut, shared: toShare });
      return true;
    },

    /**
     * Claim pending rewards.
     * Returns the amount of SAYN rewards credited.
     */
    claimRewards(_args) {
      const rps      = getState('rewardPerShare') || 0;
      const delKey   = `del_${msg.sender}`;
      const delDebt  = `debt_${msg.sender}`;
      const staked   = getState(delKey) || 0;
      const debt     = getState(delDebt) || 0;

      const pending = (getState(`pending_${msg.sender}`) || 0)
        + Math.floor(staked * (rps - debt) / 1e12);

      require(pending > 0, 'No rewards to claim');

      setState(delDebt, rps);
      setState(`pending_${msg.sender}`, 0);

      emit('RewardsClaimed', { delegator: msg.sender, amount: pending });
      return pending;
    },

    /**
     * Undelegate (withdraw) staked tokens from the pool.
     */
    undelegate(args) {
      const { amount } = args;
      require(amount > 0, 'Amount must be positive');

      const delKey  = `del_${msg.sender}`;
      const delDebt = `debt_${msg.sender}`;
      const rps     = getState('rewardPerShare') || 0;
      const staked  = getState(delKey) || 0;
      require(staked >= amount, 'Insufficient delegated balance');

      // Settle pending before withdrawing
      const debt    = getState(delDebt) || 0;
      const pending = Math.floor(staked * (rps - debt) / 1e12);
      if (pending > 0) {
        setState(`pending_${msg.sender}`, (getState(`pending_${msg.sender}`) || 0) + pending);
      }

      setState(delKey,  staked - amount);
      setState(delDebt, rps);

      const total = (getState('totalDelegated') || 0) - amount;
      setState('totalDelegated', Math.max(0, total));

      emit('Undelegated', { delegator: msg.sender, amount, remaining: staked - amount });
      return staked - amount;
    },

    /** Query delegator info */
    getDelegatorInfo(args) {
      const addr   = args.address || msg.sender;
      const delKey = `del_${addr}`;
      const rps    = getState('rewardPerShare') || 0;
      const staked = getState(delKey) || 0;
      const debt   = getState(`debt_${addr}`) || 0;
      const pending = (getState(`pending_${addr}`) || 0)
        + Math.floor(staked * (rps - debt) / 1e12);
      return {
        address: addr,
        staked,
        pendingRewards: pending,
        rewardPerShare: rps,
      };
    },

    /** Get pool overview */
    getPoolInfo(_args) {
      return {
        owner:          getState('owner'),
        operatorFee:    getState('operatorFee') || 10,
        totalDelegated: getState('totalDelegated') || 0,
        totalRewards:   getState('totalRewards') || 0,
        rewardPerShare: getState('rewardPerShare') || 0,
      };
    },
  }
};
