# ⛓️ SAYMAN BLOCKCHAIN — PHASE 14: MULTI-LAYER WEB3 PLATFORM

**JavaScript-native Smart Contracts · Proof-of-Stake · Multi-Layer Chains · Custom Tokens · NFTs · DEX · Memecoins · Staking Pools**

[![Phase](https://img.shields.io/badge/Phase-14-brightgreen)](https://github.com/saymanlal/SAYMAN)
[![Network](https://img.shields.io/badge/Network-Public%20Testnet-blue)](https://sayman.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 What's New in Phase 14

Phase 14 transforms SAYMAN from a civic-intelligence blockchain into a **full Web3 platform** — anyone can now deploy their own chain, token, NFT collection, memecoin, DEX pool, or staking contract.

| Feature | Status |
|---|---|
| **Multi-Layer Chains** | ✅ L2 Rollup, Sidechain, Permissioned — via `ChainFactory` |
| **Custom Tokens (ERC-20)** | ✅ `token-factory.js` — deploy a token in one call |
| **NFT Collections (ERC-721)** | ✅ `nft-factory.js` — collections with mint, transfer, approve |
| **Memecoin Launcher** | ✅ `memecoin-factory.js` — burn, tax, anti-whale, open registry |
| **DEX / AMM** | ✅ `dex.js` — Uniswap V2-style x\*y=k, 0.3% fee, LP tokens |
| **Staking Pools** | ✅ `staking-pool.js` — delegate SAYN, earn block rewards without a node |
| **L2 Rollup Sequencer** | ✅ `core/rollup.js` — commits state roots to L1 bridge every 5 blocks |
| **Layer2Bridge Contract** | ✅ Deposit, withdraw, state anchoring L1 ↔ L2 |
| **TPS Tracking** | ✅ `GET /api/tps` — live transactions-per-second metric |
| **Denomination Clarity** | ✅ `GET /api/denomination` + explorer card — no more SAYN/base-unit confusion |
| **Peer Reputation** | ✅ Peers earn +2 rep per synced block; validators earn +10 per block |
| **Explorer Layers Page** | ✅ Multi-chain dashboard + how-to-create-your-own-chain guide |
| **New API Endpoints** | ✅ `/api/tokens`, `/api/nfts`, `/api/staking-pools`, `/api/tps`, `/api/denomination` |

---

## 🏗️ Architecture

```
sayman/
├── core/
│   ├── blockchain.js       # PoS engine (TPS, gasLimits/gasCosts in getStats)
│   ├── chain-factory.js    # 🆕 ChainFactory: L2/Sidechain/Permissioned config builder
│   ├── rollup.js           # 🆕 L2 state root commitment to L1
│   ├── state.js            # StateEngine: balances, stakes, reputation, contracts
│   ├── contracts.js        # Sandboxed JS VM
│   ├── gas.js              # Gas calculator
│   └── ...
├── contracts/
│   ├── token.js            # ERC-20 style token
│   ├── nft.js              # ERC-721 style NFT
│   ├── token-factory.js    # Token factory
│   ├── nft-factory.js      # NFT collection factory
│   ├── memecoin-factory.js # 🆕 Memecoin launcher (burn/tax/anti-whale)
│   ├── dex.js              # 🆕 AMM DEX (Uniswap V2 style)
│   ├── staking-pool.js     # 🆕 Delegated staking pool
│   └── layer2Bridge.js     # 🆕 L1 bridge for L2 deposits/withdrawals
├── p2p/server.js           # P2P sync + peer reputation points
├── api/routes.js           # REST API (12+ endpoints added in Phase 14)
├── frontend/               # Explorer UI (Layers page, TPS card, denomination card)
├── config/                 # Network configs (testnet, public-testnet, mainnet)
└── server.js               # Server (validator + sequencer modes)
```

---

## 🪙 Tokenomics & Denomination

| Property | Value |
|---|---|
| Ticker | `SAYN` |
| Base Unit | sprinkle (1 SAYN = 100,000,000 sprinkles) |
| Decimals | 8 |
| Block Time | 5 seconds |
| Block Reward (Testnet) | 0.5 SAYN = 50,000,000 sprinkles |
| Block Reward (Mainnet) | 0.2 SAYN = 20,000,000 sprinkles |
| Min Stake (Testnet) | 10 SAYN = 1,000,000,000 sprinkles |
| Min Stake (Mainnet) | 500 SAYN = 50,000,000,000 sprinkles |

> **API Clarity**: All on-chain amounts are integers in base units (sprinkles).
> Call `GET /api/denomination` for the conversion table, or check `/api/tps` which always returns `decimals` and `ticker`.

---

## 🔗 Multi-Layer Chains

Anyone can spin up their own chain using the `ChainFactory`:

```javascript
import { ChainFactory } from './core/chain-factory.js';
import Blockchain from './core/blockchain.js';

// Layer 2 Rollup (anchored to SAYMAN L1)
const config = ChainFactory.createL2Config({
  name: 'MyL2Chain',
  chainId: 'my-l2-1',
  l1RpcUrl: 'https://sayman.onrender.com',
  l1Bridge: '<BRIDGE_CONTRACT_ADDRESS>',
  genesis: { '<YOUR_ADDRESS>': 1_000_000_000 }
});

// Independent Sidechain
const sideConfig = ChainFactory.createSidechainConfig({
  name: 'GameChain',
  chainId: 'gamechain-1',
  blockReward: 10_000_000,
});

// Permissioned (private consortium)
const permConfig = ChainFactory.createPermissionedConfig({
  name: 'EnterpriseChain',
  chainId: 'ent-1',
  validators: ['<ADDR1>', '<ADDR2>']
});
```

---

## 💻 Running Locally

### Quick Start
```bash
git clone https://github.com/saymanlal/SAYMAN
cd SAYMAN
npm install

# Start validator node
node server.js --network testnet --mode validator

# Start L2 sequencer (commits to L1 every 5 blocks)
node server.js --network testnet --mode sequencer

# Sync-only node
node server.js --network testnet --mode observer
```

### Environment Variables
```env
PORT=10000
NETWORK=public-testnet
MODE=validator
BOOTSTRAP_PEERS=wss://peer1.example.com/p2p,wss://peer2.example.com/p2p
DB_PATH=./data/node-10000

# For L2 sequencer mode:
L1_RPC_URL=https://sayman.onrender.com
L1_BRIDGE_CONTRACT=<contract_address>
L1_SEQUENCER_PRIVATE_KEY=<hex_private_key>
```

### Explorer
Open `http://localhost:10000` after starting the node. The built-in explorer includes:
- 📊 Dashboard with TPS, denomination guide, APR, mempool
- 🔍 Block Explorer with search + pagination
- 👥 Validators with stake (SAYN + base units), reputation, missed blocks
- 📄 Smart Contracts registry
- 🧩 Layers page — how to create your own chain
- 🌐 Network — peers, node info, uptime

---

## 🌐 REST API

Full reference is in `AI.md`. Key endpoints:

```bash
# Network info (layer, decimals, denomination)
curl https://sayman.onrender.com/api/network

# SAYN/base-unit conversion guide
curl https://sayman.onrender.com/api/denomination

# Live TPS
curl https://sayman.onrender.com/api/tps

# Custom tokens
curl https://sayman.onrender.com/api/tokens

# NFT collections
curl https://sayman.onrender.com/api/nfts

# Staking pools
curl https://sayman.onrender.com/api/staking-pools

# Account (balance in base units + reputation)
curl https://sayman.onrender.com/api/address/<address>

# Submit transaction
curl -X POST https://sayman.onrender.com/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"type":"TRANSFER","data":{...},"signature":"...","publicKey":"..."}'
```

---

## 📝 Smart Contracts

Write contracts in plain JavaScript. See `contracts/` for full examples.

```javascript
// Deploy token factory, then create your own token:
client.callContract({
  contractAddress: TOKEN_FACTORY_ADDR,
  method: 'createToken',
  args: { name: 'DOGE ON SAYMAN', symbol: 'SDOGE', totalSupply: 1_000_000_000 }
});

// Launch a memecoin with tax + anti-whale:
client.callContract({
  contractAddress: MEMECOIN_FACTORY_ADDR,
  method: 'launch',
  args: {
    name: 'PepeSAYN', symbol: 'PSAYN', totalSupply: 420_000_000_000,
    transferTaxPercent: 2, maxWalletPercent: 1, burnOnTransfer: true
  }
});

// Add liquidity to DEX:
client.callContract({
  contractAddress: DEX_ADDR,
  method: 'addLiquidity',
  args: { tokenA: 'ADDR_A', tokenB: 'ADDR_B', amountA: 1000, amountB: 2000 }
});
```

---

## 📱 PUKY Mobile Wallet

Available as an Android APK at `/apk/base.apk`. Features:
- Multi-RPC failover (Railway + Render + local)
- Real-time GitHub APK update checker
- Send/receive SAYN, stake, unstake

---

## 🤝 Contributing

See `ABOUT.md` for full project vision. PRs welcome on `phase14` branch.

---

## 📄 License

MIT — see `LICENSE` file.

---

## 🔗 Links

- **Explorer**: https://sayman.onrender.com
- **Wallet**: https://sayman-wallet-manager.vercel.app
- **Faucet**: https://sayman-faucet-site.vercel.app
- **GitHub**: https://github.com/saymanlal/SAYMAN