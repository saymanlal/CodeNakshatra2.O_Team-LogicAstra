/**
 * SAYMAN Public Testnet Configuration
 *
 * Token: SAYN  |  1 SAYN = 10,000 base units (4 decimal places)
 * All balances, rewards, fees stored as integers in base units.
 * UI divides by 10,000 for display.
 *
 * Block time: 5s → 17,280 blocks/day → ~6.3M blocks/year
 * Block reward: 5000 base units = 0.5 SAYN/block (generous for testnet devs)
 *
 * Gas price: 1 base unit per gas unit (nearly free on testnet)
 * Transfer: 21,000 gas × 1 = 21,000 base units = 0.0021 SAYN
 *
 * Bootstrap peers: set BOOTSTRAP_PEERS env var as comma-separated wss:// URLs.
 * Example: BOOTSTRAP_PEERS=wss://sayman.onrender.com/p2p,wss://sayman.up.railway.app/p2p
 */

export const DECIMALS     = 100_000_000;
export const TICKER       = 'SAYN';
export const DISPLAY_NAME = 'SAYMAN';

// ── Bootstrap peers from environment variable ─────────────────────────────────
// Set BOOTSTRAP_PEERS=wss://host1/p2p,wss://host2/p2p in Railway/Render env vars.
// On Render, point to Railway. On Railway, point to Render.
const envPeers = process.env.BOOTSTRAP_PEERS
  ? process.env.BOOTSTRAP_PEERS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

export default {
  networkName:  'Sayman Public Testnet',
  chainId:      'sayman-public-testnet-1',
  layer:        1,                           // Layer 1 — SAYMAN base chain
  ticker:       TICKER,
  decimals:     DECIMALS,

  apiPort:      parseInt(process.env.PORT)     || 10000,
  p2pPort:      parseInt(process.env.P2P_PORT) || null,

  // ─── Block production ────────────────────────────────────────────────────
  blockTime:    5000,

  // 0.5 SAYN/block = 50,000,000 base units
  blockReward:  50_000_000,

  // ─── Staking ─────────────────────────────────────────────────────────────
  // 10 SAYN minimum stake = 1,000,000,000 base units
  minStake:         1_000_000_000,
  unstakeDelay:     50,
  slashPercentage:  0.10,
  maxMissedBlocks:  3,

  // ─── Network ─────────────────────────────────────────────────────────────
  maxPeers:         50,

  // ✅ Bootstrap peers — loaded from BOOTSTRAP_PEERS env var automatically
  // Deploy Railway → set BOOTSTRAP_PEERS=wss://sayman.onrender.com/p2p
  // Deploy Render  → set BOOTSTRAP_PEERS=wss://sayman.up.railway.app/p2p
  bootstrapPeers:   envPeers,

  // ─── Faucet ──────────────────────────────────────────────────────────────
  faucetEnabled:    true,
  faucetAmount:     100_000_000_000,   // 1000 SAYN per drip
  faucetCooldown:   60_000,

  // ─── Genesis (all in base units) ─────────────────────────────────────────
  genesis: {
    timestamp: 1704067200000,
    allocations: {
      faucet1:    10_000_000_000_000,  // 100,000 SAYN
      genesis1:    1_000_000_000_000,  // 10,000 SAYN
      validator1:    100_000_000_000,  // 1,000 SAYN staked in genesis
    }
  },

  // ─── Gas model ───────────────────────────────────────────────────────────
  defaultGasPrice:  1,
  minGasPrice:      1,

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

    DEFAULT:          21_000,
  },

  maxGasPerBlock:    100_000_000,
  maxGasPerTx:       10_000_000,
  maxExecutionTime:  5_000,
  maxInstructions:   100_000,

  // ─── Contract limits ─────────────────────────────────────────────────────
  maxContractSize:   500_000,
  maxStateSize:      512_000,

  // ─── Supply ──────────────────────────────────────────────────────────────
  maxSupply:         0,   // unlimited on testnet
};