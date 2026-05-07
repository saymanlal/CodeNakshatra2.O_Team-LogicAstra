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
  faucetAmount: 100,
  faucetCooldown: 600000,
  
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