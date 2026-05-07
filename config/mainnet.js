export default {
  networkName: 'Sayman Mainnet',
  chainId: 'sayman-mainnet-1',
  apiPort: parseInt(process.env.PORT) || 3000,
  p2pPort: parseInt(process.env.P2P_PORT) || null,
  blockTime: 10000,
  blockReward: 5,
  minStake: 5000,
  unstakeDelay: 100,
  slashPercentage: 0.20,
  maxMissedBlocks: 5,
  maxPeers: 100,
  bootstrapPeers: [],
  faucetEnabled: false,
  faucetAmount: 0,
  faucetCooldown: 0,
  
  genesis: {
    timestamp: 1704067200000,
    allocations: {
      'validator1': 50000,
      'treasury': 1000000,
      'genesis1': 500000
    }
  },
  
  gasLimits: {
    maxGasPerBlock: 10000000,
    minGasPrice: 1
  },
  
  gasCosts: {
    TRANSFER: 21000,
    STAKE: 50000,
    UNSTAKE: 50000,
    CONTRACT_DEPLOY: 100000,
    CONTRACT_CALL: 50000
  },
  
  maxContractSize: 100000,
  maxExecutionSteps: 50000,
  maxSupply: 21000000
};