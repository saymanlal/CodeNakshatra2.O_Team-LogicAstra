/**
 * SAYMAN Chain Factory — Phase 14
 *
 * Enables anyone to create their own Layer 1, Layer 2, or
 * multi-layer chains on top of the SAYMAN ecosystem, similar
 * to how EVM chains can be spun up on Ethereum infrastructure.
 *
 * Each child chain:
 *  - Has its own chainId, networkName, token config
 *  - Uses the same PoS + contract VM engine
 *  - Can anchor state roots to L1 via the Layer2Bridge contract
 *  - Can define custom gas models and block rewards
 *
 * Usage:
 *   import { ChainFactory, ChainTemplate } from './core/chain-factory.js';
 *   const config = ChainFactory.createL2Config({ name: 'MyChain', ... });
 *   const chain = new Blockchain(config, './data/mychain');
 */

// ─── Default templates ────────────────────────────────────────────────────────

export const ChainTemplate = {
  /**
   * Basic EVM-compatible Layer 2 rollup configuration.
   * Commits state roots to L1 via Layer2Bridge contract.
   */
  L2_ROLLUP: {
    layer:          2,
    blockTime:      500,          // 0.5s blocks — fast L2
    blockReward:    0,            // L2 rewards come from L1 bridge
    minStake:       1_000_000,    // 0.01 SAYN — low entry for L2 validators
    unstakeDelay:   5,
    maxPeers:       50,
    faucetEnabled:  false,
    gasCosts: {
      TRANSFER:        5_000,
      STAKE:          10_000,
      UNSTAKE:        10_000,
      CONTRACT_DEPLOY: 50_000,
      CONTRACT_CALL:   10_000,
      CONTRACT_UPGRADE:75_000,
      STORAGE_READ:       100,
      STORAGE_WRITE:      500,
      STORAGE_BYTE:         1,
      REPORT_CREATE:    5_000,
      REPORT_VERIFY:    5_000,
      REPORT_RESOLVE:   5_000,
      DEFAULT:          5_000,
    },
    maxGasPerBlock:  10_000_000,
    maxGasPerTx:      1_000_000,
    maxSupply:             0,     // unlimited
  },

  /**
   * Sidechain — independent chain with its own tokenomics,
   * optionally bridged to L1. Good for gaming, NFT platforms,
   * or specialized dApps.
   */
  SIDECHAIN: {
    layer:          1,            // independent L1-style
    blockTime:      2000,
    blockReward:    10_000_000,   // 0.1 SAYN
    minStake:       10_000_000,   // 0.1 SAYN
    unstakeDelay:   20,
    maxPeers:       100,
    faucetEnabled:  true,
    faucetAmount:   1_000_000_000,
    maxSupply:      0,
  },

  /**
   * Private permissioned chain — validators are invited,
   * no public staking. Great for enterprise/consortium.
   */
  PERMISSIONED: {
    layer:          1,
    blockTime:      1000,
    blockReward:    0,
    minStake:       1,            // 1 base unit — effectively permissioned
    unstakeDelay:   1,
    maxPeers:       20,
    faucetEnabled:  false,
    maxSupply:      0,
  },
};

// ─── Chain Factory ────────────────────────────────────────────────────────────

export class ChainFactory {

  /**
   * Create a Layer 2 rollup configuration.
   *
   * @param {object} opts
   * @param {string} opts.name         — Human-readable chain name
   * @param {string} opts.chainId      — Unique chain ID (e.g. 'mychain-l2-1')
   * @param {number} [opts.decimals]   — Token decimal units (default 100_000_000)
   * @param {string} [opts.ticker]     — Token ticker symbol (default 'SAYN')
   * @param {number} [opts.apiPort]    — API server port
   * @param {number} [opts.p2pPort]    — P2P WebSocket port
   * @param {string} [opts.l1RpcUrl]   — L1 RPC URL for state commitment
   * @param {string} [opts.l1Bridge]   — L1 bridge contract address
   * @param {string[]} [opts.bootstrapPeers] — Bootstrap peer WS URLs
   * @param {object} [opts.genesis]    — Genesis allocations {address: amount}
   * @param {object} [opts.overrides]  — Override any template values
   * @returns {object} blockchain-compatible config object
   */
  static createL2Config({
    name,
    chainId,
    decimals        = 100_000_000,
    ticker          = 'SAYN',
    apiPort         = 11000,
    p2pPort         = null,
    l1RpcUrl        = null,
    l1Bridge        = null,
    bootstrapPeers  = [],
    genesis         = {},
    overrides       = {},
  } = {}) {
    if (!name)    throw new Error('Chain name is required');
    if (!chainId) throw new Error('Chain ID is required');

    return {
      ...ChainTemplate.L2_ROLLUP,
      ...overrides,

      networkName:    name,
      chainId,
      ticker,
      decimals,
      layer:          2,

      apiPort:        parseInt(process.env.PORT) || apiPort,
      p2pPort:        parseInt(process.env.P2P_PORT) || p2pPort,

      bootstrapPeers: process.env.BOOTSTRAP_PEERS
        ? process.env.BOOTSTRAP_PEERS.split(',').map(s => s.trim()).filter(Boolean)
        : bootstrapPeers,

      // L2 rollup config — for submitRollupToL1()
      l1RpcUrl:      process.env.L1_RPC_URL   || l1RpcUrl,
      l1Bridge:      process.env.L1_BRIDGE_CONTRACT || l1Bridge,

      faucetEnabled:  false,
      faucetAmount:   0,
      faucetCooldown: 0,

      genesis: {
        timestamp: Date.now(),
        allocations: genesis,
      },

      defaultGasPrice:  1,
      minGasPrice:      1,
      slashPercentage:  0.10,
      maxMissedBlocks:  3,
      maxContractSize:  500_000,
      maxStateSize:     512_000,
      maxExecutionTime: 5_000,
      maxInstructions:  100_000,
    };
  }

  /**
   * Create a Sidechain (independent L1-style) configuration.
   *
   * @param {object} opts  — Same shape as createL2Config opts
   * @returns {object}
   */
  static createSidechainConfig({
    name,
    chainId,
    decimals       = 100_000_000,
    ticker         = 'SAYN',
    apiPort        = 12000,
    p2pPort        = null,
    blockReward    = 10_000_000,
    minStake       = 10_000_000,
    maxSupply      = 0,
    bootstrapPeers = [],
    genesis        = {},
    overrides      = {},
  } = {}) {
    if (!name)    throw new Error('Chain name is required');
    if (!chainId) throw new Error('Chain ID is required');

    return {
      ...ChainTemplate.SIDECHAIN,
      ...overrides,

      networkName:   name,
      chainId,
      ticker,
      decimals,
      layer:         1,

      apiPort:       parseInt(process.env.PORT) || apiPort,
      p2pPort:       parseInt(process.env.P2P_PORT) || p2pPort,

      bootstrapPeers: process.env.BOOTSTRAP_PEERS
        ? process.env.BOOTSTRAP_PEERS.split(',').map(s => s.trim()).filter(Boolean)
        : bootstrapPeers,

      blockReward,
      minStake,
      maxSupply,

      genesis: {
        timestamp: Date.now(),
        allocations: genesis,
      },

      defaultGasPrice:  1,
      minGasPrice:      1,
      unstakeDelay:     20,
      slashPercentage:  0.10,
      maxMissedBlocks:  3,
      maxContractSize:  500_000,
      maxStateSize:     512_000,
      maxExecutionTime: 5_000,
      maxInstructions:  100_000,
      maxGasPerBlock:   100_000_000,
      maxGasPerTx:       10_000_000,
      gasCosts: ChainTemplate.SIDECHAIN.gasCosts || ChainTemplate.L2_ROLLUP.gasCosts,
    };
  }

  /**
   * Create a Permissioned/Private chain configuration.
   *
   * @param {object} opts
   * @param {string[]} opts.validators  — Pre-approved validator addresses
   */
  static createPermissionedConfig({
    name,
    chainId,
    decimals       = 100_000_000,
    ticker         = 'SAYN',
    apiPort        = 13000,
    p2pPort        = null,
    validators     = [],
    genesis        = {},
    overrides      = {},
  } = {}) {
    if (!name)    throw new Error('Chain name is required');
    if (!chainId) throw new Error('Chain ID is required');

    const genAlloc = { ...genesis };
    // Give each validator a small working balance
    validators.forEach((addr, i) => {
      if (!genAlloc[addr]) genAlloc[addr] = 100_000_000; // 1 SAYN
    });

    return {
      ...ChainTemplate.PERMISSIONED,
      ...overrides,

      networkName:      name,
      chainId,
      ticker,
      decimals,
      layer:            1,

      apiPort:          parseInt(process.env.PORT) || apiPort,
      p2pPort:          parseInt(process.env.P2P_PORT) || p2pPort,

      bootstrapPeers:   [],
      permissionedValidators: validators,

      genesis: {
        timestamp: Date.now(),
        allocations: genAlloc,
      },

      defaultGasPrice:  1,
      minGasPrice:      1,
      unstakeDelay:     1,
      slashPercentage:  0.05,
      maxMissedBlocks:  10,
      maxContractSize:  500_000,
      maxStateSize:     512_000,
      maxExecutionTime: 10_000,
      maxInstructions:  200_000,
      maxGasPerBlock:   100_000_000,
      maxGasPerTx:       10_000_000,
      gasCosts: ChainTemplate.L2_ROLLUP.gasCosts,
    };
  }

  /**
   * Validate that a config object is complete and usable.
   * @param {object} config
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validate(config) {
    const errors = [];
    if (!config.networkName) errors.push('networkName is required');
    if (!config.chainId)     errors.push('chainId is required');
    if (!config.decimals)    errors.push('decimals is required');
    if (!config.blockTime)   errors.push('blockTime is required');
    if (!config.genesis)     errors.push('genesis is required');
    if (!config.gasCosts)    errors.push('gasCosts is required');
    return { valid: errors.length === 0, errors };
  }
}

export default ChainFactory;
