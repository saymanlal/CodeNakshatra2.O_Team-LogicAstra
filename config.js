export default {
    network: process.env.NETWORK || 'testnet',
    port: parseInt(process.env.PORT) || 3000,
    p2pPort: parseInt(process.env.P2P_PORT) || 6001,
    peers: process.env.PEERS ? process.env.PEERS.split(',') : [],
    
    // Token Symbols
    tokenSymbol: 'SAYN',
    testnetTokenSymbol: 'tSAYN',
    symbol: (process.env.NETWORK || 'testnet') === 'mainnet' ? 'SAYN' : 'tSAYN',

    nativeCurrency: { name: 'SAYMAN', symbol: 'SAYN', decimals: 8 },

    // Blockchain
    blockTime: 5000, // 5 seconds
    blockReward: 10,
    
    // Staking
    minStake: 1000000000,
    unstakeDelay: 20, // blocks
    maxMissedBlocks: 3,
    slashPercentage: 0.1, // 10%
    
    // Genesis
    genesisAllocations: {
      'faucet': 1000000,
      'validator1': 1000
    },
    genesisStakes: {
      'validator1': 500
    },
    
    // Contracts
    maxContractSize: 10000, // characters
    maxExecutionSteps: 1000,
    gasLimit: 1000000
  };