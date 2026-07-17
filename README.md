# ⛓️ SAYMAN BLOCKCHAIN — PHASE 22: FULL EVM/METAMASK COMPAT · tSAYN · NONCE MANAGER · EXPLORER 2.0

**JavaScript-native Smart Contracts · Proof-of-Stake · Multi-Layer Chains · Custom Tokens · NFTs · DEX · Memecoins · Staking Pools**

[![Phase](https://img.shields.io/badge/Phase-22-brightgreen)](https://github.com/saymanlal/SAYMAN)
[![Network](https://img.shields.io/badge/Network-Public%20Testnet-blue)](https://sayman.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 What's New in Phase 22

Phase 22 delivers **full MetaMask & EVM wallet compatibility**, the **tSAYN testnet symbol** (following Ethereum convention), an **atomic NonceManager** that eliminates nonce race conditions, **Explorer 2.0** with dedicated Token/NFT/Memecoin/Address pages, and a unified search bar across all entity types.

| Feature | Status |
|---|---|
| **Full MetaMask Compatibility** | ✅ `eth_getLogs`, `eth_newBlockFilter`, `eth_getFilterChanges`, `wallet_addEthereumChain`, 0x address stripping, correct balance scale (×10¹⁰), nonce pending-state tracking |
| **tSAYN Testnet Symbol** | ✅ Testnet API returns `tSAYN`; mainnet returns `SAYN` — follows Ethereum convention (SepoliaETH, Mumbai MATIC) |
| **Atomic Nonce Manager** | ✅ `core/nonce.js` — per-address in-memory nonce tracking with `getNonce/commitNonce/rollbackNonce`; `/api/nonce/:addr` endpoint; wallet fetches fresh nonce before every broadcast |
| **Explorer 2.0 Pages** | ✅ Dedicated explorer pages: Tokens · NFTs · Memecoins · unified Address (balance + txs + tokens + NFTs + reputation in one view) |
| **Unified Search** | ✅ Search bar resolves block index, tx hash, address, token name/symbol from a single input |
| **Live L2 Layer Status** | ✅ `/layers` page shows real-time chain status for each registered L2/sidechain |
| **Gas Fee Accuracy** | ✅ Explorer now shows "Fee Paid" in tSAYN (not raw gas units) |
| **Contract State & ABI Fix** | ✅ `_extractABI` correctly handles `methods:{...}` style contracts; state viewer rendered properly |
| **SAYMAN Logo Asset** | ✅ 512×512 PNG served at `/assets/logo-512.png` for MetaMask network icon recognition |
| **PUKY Wallet APK v22** | ✅ New signed APK — tSAYN display, fresh nonce on every broadcast, `addSaymanToMetaMask()` one-click function |

---

## 🔌 MetaMask & Global Wallet Integration

SAYMAN supports standard **Ethereum JSON-RPC 2.0**. Connect MetaMask, Trust Wallet, Coinbase Wallet, or any EVM-compatible wallet using:

### 🌐 Network Connection Settings

| Parameter | Public Testnet | Local Development |
| :--- | :--- | :--- |
| **Network Name** | Sayman Public Testnet | Sayman Local Testnet |
| **New RPC URL** | `https://sayman.onrender.com` | `http://localhost:10000` |
| **Chain ID** | `82922` (hex `0x143ea`) | `82923` (hex `0x143eb`) |
| **Currency Symbol** | `tSAYN` | `tSAYN` |
| **Block Explorer** | `https://sayman.up.railway.app` | `http://localhost:10000` |
| **Logo** | `https://sayman.onrender.com/assets/logo-512.png` | — |

> **One-click setup:** Visit [https://sayman.up.railway.app](https://sayman.up.railway.app) → Network page → **"Add to MetaMask"** button.

### 🛠️ Supported JSON-RPC Methods (Phase 22)

| Method | Description |
|---|---|
| `eth_chainId` / `net_version` | Returns `82922` (testnet) |
| `eth_blockNumber` | Latest block height in hex |
| `eth_getBlockByNumber` / `eth_getBlockByHash` | Block data in EVM format |
| `eth_getBalance` | Balance in Wei-equivalent (base units × 10¹⁰) |
| `eth_getTransactionCount` | Account nonce (confirmed + pending) |
| `eth_sendRawTransaction` | EIP-155 / EIP-2930 / EIP-1559 tx, ECDSA recovery → SAYMAN mempool |
| `eth_getTransactionByHash` / `eth_getTransactionReceipt` | Tx details + receipt with `effectiveGasPrice` |
| `eth_estimateGas` | Returns `0x5208` (21000) |
| `eth_gasPrice` | Gas price in Wei-equivalent |
| `eth_getLogs` | Returns `[]` (SAYMAN events not ABI-encoded) |
| `eth_newBlockFilter` / `eth_getFilterChanges` | Block filter poll — returns latest block hash |
| `eth_newPendingTransactionFilter` / `eth_uninstallFilter` | Filter lifecycle |
| `wallet_addEthereumChain` / `wallet_switchEthereumChain` | EIP-3085 handled — `null` = success |
| `eth_accounts` / `eth_requestAccounts` | Returns `[]` (non-custodial) |
| `eth_syncing` | `false` |
| `net_listening` | `true` |
| `net_peerCount` | Live peer count |
| `web3_clientVersion` | `SAYMAN/v22.0.0/javascript` |

---

## 🏗️ Architecture

```
sayman/
├── core/
│   ├── blockchain.js       # PoS engine, NonceManager integration
│   ├── nonce.js            # 🆕 Phase 22: Atomic per-address NonceManager
│   ├── chain-factory.js    # ChainFactory: L2/Sidechain/Permissioned config builder
│   ├── rollup.js           # L2 state root commitment to L1
│   ├── state.js            # StateEngine: balances, stakes, reputation, contracts
│   ├── contracts.js        # Sandboxed JS VM contract execution
│   ├── gas.js              # Gas calculator
│   └── ...
├── contracts/
│   ├── token.js            # ERC-20 style token
│   ├── nft.js              # ERC-721 style NFT
│   ├── token-factory.js    # Token factory
│   ├── nft-factory.js      # NFT collection factory
│   ├── memecoin-factory.js # Memecoin launcher (burn/tax/anti-whale)
│   ├── dex.js              # AMM DEX (Uniswap V2 style)
│   ├── staking-pool.js     # Delegated staking pool
│   └── layer2Bridge.js     # L1 bridge for L2 deposits/withdrawals
├── p2p/server.js           # P2P sync + peer reputation points
├── api/routes.js           # REST API — tokens, NFTs, memecoins, address, nonce endpoints
├── assets/                 # 🆕 Phase 22: logo-512.png served for MetaMask
├── frontend/               # Explorer 2.0 — Tokens/NFTs/Memecoins/Address pages, unified search
├── config/                 # Network configs (testnet, public-testnet, mainnet)
└── server.js               # Entry point — EVM RPC handler + static asset serving
```

---

## 🪙 Tokenomics & Denomination

| Property | Testnet | Mainnet |
|---|---|---|
| **Ticker** | `tSAYN` | `SAYN` |
| **Base Unit** | sprinkle (1 SAYN = 100,000,000 sprinkles) | same |
| **Decimals** | 8 | 8 |
| **Block Time** | 5 seconds | 5 seconds |
| **Block Reward** | 0.5 SAYN = 50,000,000 sprinkles | 0.2 SAYN |
| **Min Stake** | 10 SAYN = 1,000,000,000 sprinkles | 500 SAYN |
| **Max Supply** | Unlimited (testnet) | 100,000,000 SAYN |

> **API Clarity**: All on-chain amounts are integers in base units (sprinkles).
> Call `GET /api/denomination` for the conversion table.

---

## 🔗 Multi-Layer Chains

```javascript
import { ChainFactory } from './core/chain-factory.js';

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

```bash
git clone https://github.com/saymanlal/SAYMAN
cd SAYMAN
npm install

# Start validator node
node server.js --network testnet --mode validator

# Sync-only observer
node server.js --network testnet --mode observer
```

### Environment Variables
```env
PORT=10000
NETWORK=public-testnet
MODE=validator
BOOTSTRAP_PEERS=wss://peer1.example.com/p2p
DB_PATH=./data/node-10000
```

### Explorer
Open `http://localhost:10000`. Explorer 2.0 includes:
- 📊 Dashboard — TPS, denomination, APR, mempool
- 🔍 Block & transaction explorer with unified search
- 👥 Validators — stake (tSAYN), reputation, missed blocks
- 🪙 Tokens / NFTs / Memecoins — factory-deployed assets
- 🏠 Address — balance + tx history + tokens + NFTs + reputation
- 🧩 Layers — L2/sidechain live status
- 🌐 Network — peers, node info, MetaMask one-click add

---

## 🌐 REST API

```bash
# Network info (layer, decimals, denomination, ticker)
curl https://sayman.onrender.com/api/network

# SAYN conversion guide
curl https://sayman.onrender.com/api/denomination

# Fresh nonce for address (use before broadcast)
curl https://sayman.onrender.com/api/nonce/<address>

# Custom tokens list
curl https://sayman.onrender.com/api/tokens

# NFT collections
curl https://sayman.onrender.com/api/nfts

# Memecoins
curl https://sayman.onrender.com/api/memecoins

# Unified address view (balance + txs + tokens + NFTs + reputation)
curl https://sayman.onrender.com/api/address/<address>

# Submit transaction
curl -X POST https://sayman.onrender.com/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"type":"TRANSFER","data":{...},"signature":"...","publicKey":"..."}'
```

---

## 📝 Smart Contracts

```javascript
// Deploy a custom token:
client.callContract({
  contractAddress: TOKEN_FACTORY_ADDR,
  method: 'createToken',
  args: { name: 'DOGE ON SAYMAN', symbol: 'SDOGE', totalSupply: 1_000_000_000 }
});

// Launch a memecoin:
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

## 📱 PUKY Mobile Wallet (v22)

Android APK at `/apk/puky.apk` (also mirrored at `github.com/saymanlal/puky`). Features:
- MetaMask-compatible: `addSaymanToMetaMask()` one-click network setup
- Fresh nonce fetched before every broadcast (no nonce race conditions)
- Balance displayed in **tSAYN** (testnet) / **SAYN** (mainnet)
- Multi-RPC failover (Railway + Render + local)
- Send / receive / stake / unstake

---

## 🤝 Contributing

See `ABOUT.md` for full project vision. PRs welcome on `main` branch.

### Phase 22 Updates
- **Full MetaMask EVM Compat**: `eth_getLogs`, `eth_newBlockFilter`, `eth_getFilterChanges`, `wallet_addEthereumChain`, 0x address auto-stripping, balance scale fix, pending nonce tracking.
- **tSAYN Testnet Symbol**: API, explorer, wallet all show `tSAYN` on testnet; `SAYN` on mainnet.
- **Atomic NonceManager**: `core/nonce.js` — eliminates nonce race conditions; `/api/nonce/:addr` endpoint; wallet uses fresh nonce before every broadcast.
- **Explorer 2.0**: Tokens, NFTs, Memecoins, unified Address pages; unified search; live L2 layer status; accurate gas fee in tSAYN; contract state & ABI viewer fix.
- **PUKY APK v22**: New signed build with all Phase 22 features.

---

## 📄 License

MIT — see `LICENSE` file.

---

## 🔗 Links

- **Explorer**: https://sayman.up.railway.app
- **RPC**: https://sayman.onrender.com
- **Wallet (web)**: https://sayman-wallet-manager.vercel.app
- **Faucet**: https://sayman-faucet-site.vercel.app
- **Docs**: https://sayman-docs.vercel.app
- **GitHub**: https://github.com/saymanlal/SAYMAN
- **Telegram (bulk tokens)**: https://t.me/SaymanLal
- **IP Owner**: [Vizkus Groups](https://vizkusgroups.me) (Cybokrafts Universal Innovations Pvt. Ltd.)