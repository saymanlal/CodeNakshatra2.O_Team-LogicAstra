/**
 * SAYMAN Mainnet Configuration
 *
 * Token: SAYN  |  1 SAYN = 10,000 base units (4 decimal places)
 * All balances, rewards, fees stored as integers in base units.
 * UI layer divides by 10,000 for display.
 *
 * ─── Tokenomics ────────────────────────────────────────────────────────────
 * Max supply:      100,000,000 SAYN  (100M)
 * Block time:      5 seconds
 * Blocks/year:     ~6,307,200
 *
 * Block reward schedule (halving every 2 years = ~12,614,400 blocks):
 *   Year  1–2:   0.2 SAYN/block  → ~1,261,440 SAYN/year  → ~2,522,880 SAYN total
 *   Year  3–4:   0.1 SAYN/block  → ~630,720  SAYN/year   → ~1,261,440 SAYN total
 *   Year  5–6:   0.05 SAYN/block → ~315,360  SAYN/year   → ~630,720  SAYN total
 *   ...halving continues until reward < 1 base unit (effectively 0)
 *
 * Total emissions over ~15 years ≈ 7.2M SAYN from block rewards.
 * Remaining 92.8M SAYN from genesis allocations (treasury, team, ecosystem).
 * This keeps inflation low and token value healthy long-term.
 *
 * ─── Gas pricing ───────────────────────────────────────────────────────────
 * gasPrice: 5 base units per gas unit  (0.0005 SAYN per 1000 gas)
 * Transfer: 21,000 gas × 5 = 105,000 base units = 0.0105 SAYN ≈ very cheap
 * Contract call: ~250,000 gas × 5 = 0.125 SAYN
 * Cheaper than Ethereum by orders of magnitude, comparable to early Solana.
 *
 * Validators earn: block reward + all gas fees from transactions in the block.
 * At 100 txs/block average: ~0.2 SAYN reward + ~1.05 SAYN fees = ~1.25 SAYN/block
 * At current token value this provides meaningful validator income.
 */

export const DECIMALS     = 10000;
export const TICKER       = 'SAYN';
export const DISPLAY_NAME = 'SAYMAN';

// Halving schedule — block heights at which reward halves
// Every ~2 years at 5s blocks = 12,614,400 blocks per period
const HALVING_INTERVAL = 12_614_400;

export function getBlockReward(blockHeight) {
  // Base reward: 2000 base units = 0.2 SAYN
  // Halves every HALVING_INTERVAL blocks
  const halvings = Math.floor(blockHeight / HALVING_INTERVAL);
  if (halvings >= 20) return 0;                    // effectively zero after 40 years
  return Math.floor(2000 / Math.pow(2, halvings)); // integer base units
}

export default {
  networkName:  'SAYMAN Mainnet',
  chainId:      'sayman-mainnet-1',
  ticker:       TICKER,
  decimals:     DECIMALS,

  apiPort:      parseInt(process.env.PORT)     || 3000,
  p2pPort:      parseInt(process.env.P2P_PORT) || null,

  // ─── Block production ────────────────────────────────────────────────────
  blockTime:    5000,

  // blockReward is dynamic via getBlockReward(height) — this is the Year 1 value.
  // blockchain.js should call getBlockReward(block.index) when minting reward tx.
  blockReward:  2000,                            // 0.2 SAYN in base units

  halvingInterval: HALVING_INTERVAL,
  getBlockReward,                                // expose function for blockchain.js

  // ─── Staking ─────────────────────────────────────────────────────────────
  // 500 SAYN minimum stake mainnet (= 5,000,000 base units)
  minStake:        5_000_000,
  unstakeDelay:    100,                          // ~8 minutes at 5s blocks
  slashPercentage: 0.15,                         // 15% slash for downtime
  maxMissedBlocks: 5,

  // ─── Network ─────────────────────────────────────────────────────────────
  maxPeers:        100,
  bootstrapPeers:  [],

  // ─── Faucet ──────────────────────────────────────────────────────────────
  faucetEnabled:   false,
  faucetAmount:    0,
  faucetCooldown:  0,

  // ─── Genesis allocations (all in base units) ─────────────────────────────
  // Total genesis supply: 50,000,000 SAYN (50M)
  // Remaining 50M emitted via block rewards over decades.
  //
  // treasury:    30,000,000 SAYN — ecosystem fund, exchange listings, partnerships
  // team:         8,000,000 SAYN — founding team (subject to 2yr vesting off-chain)
  // validator1:   2,000,000 SAYN — genesis validator (1000 staked, rest as operating budget)
  // reserve:     10,000,000 SAYN — Cybokrafts reserve fund
  genesis: {
    timestamp: 1704067200000,
    allocations: {
      treasury:   300_000_000_000,               // 30,000,000 SAYN
      team:        80_000_000_000,               // 8,000,000 SAYN
      validator1:  20_000_000_000,               // 2,000,000 SAYN
      reserve:    100_000_000_000,               // 10,000,000 SAYN
    }
  },

  // ─── Gas model ───────────────────────────────────────────────────────────
  // gasPrice: 5 base units per gas unit
  // 5× more expensive than testnet but still very cheap in SAYN terms.
  // Validators earn meaningful fee income at high tx volume.
  defaultGasPrice:  5,
  minGasPrice:      5,

  // Gas units (identical to testnet — only price changes between networks)
  gasCosts: {
    TRANSFER:         21_000,
    STAKE:            50_000,
    UNSTAKE:          50_000,
    CONTRACT_DEPLOY:  200_000,
    CONTRACT_CALL:     50_000,
    CONTRACT_UPGRADE: 300_000,
    STORAGE_READ:         500,
    STORAGE_WRITE:       2_000,
    STORAGE_BYTE:            1,
    REPORT_CREATE:    21_000,
    REPORT_VERIFY:    21_000,
    REPORT_RESOLVE:   21_000,
    DEFAULT:          21_000,
  },

  maxGasPerBlock:   50_000_000,
  maxGasPerTx:      10_000_000,
  maxExecutionTime: 5_000,
  maxInstructions:  100_000,

  // ─── Contract limits ─────────────────────────────────────────────────────
  maxContractSize:  500_000,
  maxStateSize:     512_000,

  // ─── Supply ──────────────────────────────────────────────────────────────
  // 100,000,000 SAYN hard cap = 1,000,000,000,000 base units
  maxSupply:        1_000_000_000_000,
};