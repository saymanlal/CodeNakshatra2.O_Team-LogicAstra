export default {
  networkName: 'Sayman Public Testnet',
  chainId: 'sayman-public-testnet-1',
  apiPort: parseInt(process.env.PORT) || 10000,
  p2pPort: parseInt(process.env.P2P_PORT) || null,
  blockTime: 5000,
  blockReward: 10,
  minStake: 100,
  unstakeDelay: 50,
  slashPercentage: 0.10,
  maxMissedBlocks: 3,
  maxPeers: 50,
  bootstrapPeers: [],
  faucetEnabled: true,
  faucetAmount: 1000,
  faucetCooldown: 60000,

  genesis: {
    timestamp: 1704067200000,
    allocations: {
      'faucet1': 10000000,
      'genesis1': 100000,
      'validator1': 10000
    }
  },

  gasLimits: {
    maxGasPerBlock: 10000000,
    minGasPrice: 1
  },

  // ✅ Realistic gas costs — total deploy costs ~5-10 SAYM, not 100,000
  gasCosts: {
    TRANSFER:        6,
    STAKE:           10,
    UNSTAKE:         10,
    CONTRACT_DEPLOY: 5,
    CONTRACT_CALL:   2,
    REPORT_CREATE:   3,
    REPORT_VERIFY:   2,
    REPORT_RESOLVE:  2
  },

  maxContractSize: 100000,
  maxExecutionSteps: 50000,
  maxSupply: 21000000
};
