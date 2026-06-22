/**
 * SAYMAN Testnet Configuration
 *
 * Token: SAYN  |  1 SAYN = 10,000 base units (4 decimal places)
 * All balances, rewards, fees stored as integers in base units.
 * UI layer divides by DECIMALS (10000) for display.
 *
 * Block time: 5s  →  17,280 blocks/day  →  6,307,200 blocks/year
 * Block reward: 5000 base units = 0.5 SAYN/block
 *   → ~3,153,600 SAYN/year on testnet (dev faucet-level, intentionally high)
 *
 * Gas price: 1 base unit per gas unit (nearly free for developers)
 * Transfer cost: 21,000 gas × 1 = 21,000 base units = 0.0021 SAYN
 */

export const DECIMALS     = 10000;           // 1 SAYN = 10,000 base units
export const TICKER       = 'SAYN';
export const DISPLAY_NAME = 'SAYMAN';

export default {
  networkName:  'SAYMAN Testnet',
  chainId:      'sayman-testnet-1',
  ticker:       TICKER,
  decimals:     DECIMALS,                    // always pass this through config

  apiPort:      parseInt(process.env.PORT)    || 10000,
  p2pPort:      parseInt(process.env.P2P_PORT) || null,

  // ─── Block production ────────────────────────────────────────────────────
  blockTime:    5000,                        // 5 seconds

  // 0.5 SAYN per block = 5000 base units
  // Testnet is intentionally generous so developers get tokens fast.
  blockReward:  5000,

  // ─── Staking ─────────────────────────────────────────────────────────────
  // 10 SAYN minimum stake on testnet (= 100,000 base units)
  minStake:         100_000,
  unstakeDelay:     10,                      // blocks (fast on testnet)
  slashPercentage:  0.10,
  maxMissedBlocks:  3,

  // ─── Network ─────────────────────────────────────────────────────────────
  maxPeers:         50,
  bootstrapPeers:   [],

  // ─── Faucet ──────────────────────────────────────────────────────────────
  faucetEnabled:    true,
  faucetAmount:     10_000_000,              // 1000 SAYN per drip
  faucetCooldown:   60_000,                  // 1 minute

  // ─── Genesis allocations (all in base units) ─────────────────────────────
  // faucet1:    100,000 SAYN  — testnet faucet reservoir
  // genesis1:   10,000 SAYN   — dev wallet 1
  // genesis2:   5,000 SAYN    — dev wallet 2
  // validator1: 1,000 SAYN    — genesis validator stake
  genesis: {
    timestamp: 1704067200000,
    allocations: {
      faucet1:    1_000_000_000,             // 100,000 SAYN
      genesis1:     100_000_000,             // 10,000 SAYN
      genesis2:      50_000_000,             // 5,000 SAYN
      validator1:    10_000_000,             // 1,000 SAYN (staked in genesis)
    }
  },

  // ─── Gas model ───────────────────────────────────────────────────────────
  // gasPrice: base units per gas unit
  // Testnet is 1 base unit/gas so developers can test without worrying about fees.
  defaultGasPrice:  1,
  minGasPrice:      1,

  // Gas units per operation type (same across testnet/mainnet — only price differs)
  gasCosts: {
    // Wallet ops
    TRANSFER:         21_000,
    STAKE:            50_000,
    UNSTAKE:          50_000,

    // Contract ops
    CONTRACT_DEPLOY:  200_000,              // base; +1 gas per 10 bytes of code
    CONTRACT_CALL:     50_000,              // base; +state read/write charges
    CONTRACT_UPGRADE: 300_000,

    // Storage (per operation inside contracts)
    STORAGE_READ:         500,
    STORAGE_WRITE:       2_000,
    STORAGE_BYTE:            1,             // per byte of code stored

    // Native tx types
    REPORT_CREATE:    21_000,
    REPORT_VERIFY:    21_000,
    REPORT_RESOLVE:   21_000,

    // Fallback
    DEFAULT:          21_000,
  },

  // Block gas cap
  maxGasPerBlock:    50_000_000,
  maxGasPerTx:       10_000_000,
  maxExecutionTime:  5_000,                 // ms per contract call
  maxInstructions:   100_000,

  // ─── Contract limits ─────────────────────────────────────────────────────
  maxContractSize:   500_000,               // bytes
  maxStateSize:      512_000,               // 500 KB per contract state

  // ─── Supply ──────────────────────────────────────────────────────────────
  maxSupply:         0,                     // 0 = unlimited on testnet
};