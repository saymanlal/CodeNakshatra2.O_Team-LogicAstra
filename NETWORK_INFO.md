# 🌐 SAYMAN Blockchain — Network Info & Wallet Connection Guide

**Phase 22** | Public Testnet | Chain ID: `82922`  
**RPC Endpoint:** `https://sayman.onrender.com`  
**Block Explorer:** `https://sayman.up.railway.app`  
**GitHub:** `https://github.com/saymanlal/SAYMAN`

---

## 🔌 Connect Your Wallet (MetaMask & All Global Wallets)

SAYMAN supports the standard **Ethereum JSON-RPC 2.0** protocol. Any wallet that accepts custom networks (MetaMask, Trust Wallet, Coinbase Wallet, Rainbow, Rabby, imToken, Exodus, Brave Wallet, etc.) can connect using the parameters below.

### 📱 Public Testnet (Live Network)

| Parameter | Value |
|---|---|
| **Network Name** | Sayman Public Testnet |
| **New RPC URL** | `https://sayman.onrender.com` |
| **Chain ID** | `82922` |
| **Currency Symbol** | `tSAYN` |
| **Block Explorer URL** | `https://sayman.up.railway.app` |
| **Network Hex ID** | `0x143ea` |
| **Logo** | `https://sayman.onrender.com/assets/logo-512.png` |

### 💻 Local Development Node

| Parameter | Value |
|---|---|
| **Network Name** | Sayman Local Testnet |
| **New RPC URL** | `http://localhost:10000` |
| **Chain ID** | `82923` |
| **Currency Symbol** | `tSAYN` |
| **Block Explorer URL** | `http://localhost:10000` |

> ⚡ **One-click setup:** Visit [https://sayman.up.railway.app](https://sayman.up.railway.app) → Network page → **"Add to MetaMask"** button (EIP-3085 `wallet_addEthereumChain`).

---

## 🔧 Step-by-Step: Add SAYMAN to MetaMask

### Desktop (MetaMask Browser Extension)

1. Open MetaMask → click the network dropdown at the top
2. Click **"Add network"**
3. Click **"Add a network manually"** at the bottom
4. Fill in the fields:
   - **Network name:** `Sayman Public Testnet`
   - **New RPC URL:** `https://sayman.onrender.com`
   - **Chain ID:** `82922`
   - **Currency symbol:** `tSAYN`
   - **Block explorer URL:** `https://sayman.up.railway.app`
5. Click **Save** → then **"Switch to Sayman Public Testnet"**

### Mobile (MetaMask App)

1. Open MetaMask → tap the hamburger menu
2. Tap **Settings** → **Networks** → **Add Network**
3. Enter the same values as above (use `tSAYN` as symbol)
4. Tap **Add** to confirm

---

## 🌍 Add to Other Wallets

### Trust Wallet
1. Go to Settings → Preferences → Custom Network
2. Enter: RPC URL `https://sayman.onrender.com`, Chain ID `82922`, Symbol `tSAYN`

### Coinbase Wallet
1. Settings → Active Networks → Add Custom Network
2. Enter the same network details as above

### Rabby / Rainbow / Brave Wallet
- All support EIP-3085 (`wallet_addEthereumChain`) — use the same values above

### WalletConnect
- SAYMAN is EVM JSON-RPC 2.0 compatible; use Chain ID `82922` to connect

---

## 🛠️ Supported JSON-RPC Methods (Phase 22)

| Method | Description |
|---|---|
| `eth_chainId` | Returns `0x143ea` (82922 for public testnet) |
| `net_version` | Returns `"82922"` |
| `eth_blockNumber` | Latest block height in hex |
| `eth_getBlockByNumber` | Block data (EVM-format) by number |
| `eth_getBlockByHash` | Block data (EVM-format) by hash |
| `eth_getBalance` | Address balance in Wei-equivalent (base units × 10¹⁰) |
| `eth_getTransactionCount` | Account nonce (confirmed + pending max) |
| `eth_sendRawTransaction` | Submit signed EIP-155/2930/1559 transaction |
| `eth_getTransactionByHash` | Transaction details by hash |
| `eth_getTransactionReceipt` | Transaction receipt (status, gas used, `effectiveGasPrice`) |
| `eth_estimateGas` | Gas estimate (returns `0x5208` = 21000) |
| `eth_gasPrice` | Current gas price in Wei-equivalent |
| `eth_getLogs` | Returns `[]` (SAYMAN events are not EVM ABI-encoded) |
| `eth_newBlockFilter` | Creates filter; returns `0x1` |
| `eth_getFilterChanges` | Returns latest block hash for liveness polling |
| `eth_newPendingTransactionFilter` | Returns `0x2` |
| `eth_newFilter` | Returns `0x3` |
| `eth_getFilterLogs` | Returns `[]` |
| `eth_uninstallFilter` | Returns `true` |
| `eth_accounts` | Returns `[]` (non-custodial) |
| `eth_requestAccounts` | Returns `[]` |
| `wallet_addEthereumChain` | EIP-3085 — acknowledged, returns `null` |
| `wallet_switchEthereumChain` | Returns `null` |
| `wallet_getPermissions` | Returns `[]` |
| `eth_getCode` | Returns `0x` |
| `eth_syncing` | `false` |
| `net_listening` | `true` |
| `net_peerCount` | Live peer count in hex |
| `web3_clientVersion` | `SAYMAN/v22.0.0/javascript` |

---

## 💡 Example: curl JSON-RPC Calls

```bash
# Get chain ID
curl -X POST https://sayman.onrender.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# → {"result":"0x143ea"}

# Get latest block number
curl -X POST https://sayman.onrender.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get balance (0x-prefixed MetaMask address works)
curl -X POST https://sayman.onrender.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xYOUR_ADDRESS","latest"],"id":1}'

# Get nonce (fresh — use before every broadcast to avoid conflicts)
curl https://sayman.onrender.com/api/nonce/YOUR_ADDRESS
```

---

## 🌐 Network Overview (Phase 22)

| Parameter | Value |
|---|---|
| **Network Name** | Sayman Public Testnet |
| **Chain ID (string)** | `sayman-public-testnet-1` |
| **Chain ID (numeric)** | `82922` |
| **Layer** | L1 (Base chain) |
| **Block Time** | 5 seconds |
| **Block Reward** | 0.5 tSAYN (50,000,000 base units) |
| **Min Stake** | 10 tSAYN (1,000,000,000 base units) |
| **Max Supply (Testnet)** | Unlimited |
| **Max Supply (Mainnet)** | 100,000,000 SAYN |
| **Ticker (Testnet)** | `tSAYN` |
| **Ticker (Mainnet)** | `SAYN` |
| **Base Unit** | sprinkle (1 SAYN = 100,000,000 sprinkles) |
| **Decimals** | 8 |
| **Gas Price** | 1 base unit per gas unit |
| **Transfer Gas** | 21,000 gas |
| **Faucet** | ✅ Enabled |
| **Faucet Amount** | 1,000 tSAYN per drip |
| **Faucet Cooldown** | 10 minutes |
| **Bulk Tokens** | Telegram @SaymanLal (up to 10M tSAYN for builders) |

---

## ⛽ Gas Model

### Gas Limits

| Parameter | Value |
|---|---|
| **Min Gas Price** | 1 wei |
| **Max Gas Per Transaction** | 10,000,000 |
| **Max Gas Per Block** | 100,000,000 |
| **Max Execution Time** | 5,000ms |
| **Max State Size** | 500KB |
| **Max Instructions** | 100,000 |

### Gas Costs

| Transaction Type | Base Gas Cost |
|---|---|
| **TRANSFER** | 21,000 |
| **STAKE** | 50,000 |
| **UNSTAKE** | 50,000 |
| **CONTRACT_DEPLOY** | 200,000 + code size |
| **CONTRACT_CALL** | 50,000 + execution |
| **CONTRACT_UPGRADE** | 300,000 |
| **STORAGE_READ** | 500 |
| **STORAGE_WRITE** | 2,000 |

---

## 🔐 Security Features

### Anti-Spam Protections
- ✅ **Atomic NonceManager**: Per-address nonce tracking in `core/nonce.js` — prevents replay attacks and race conditions
- ✅ **Gas Fees**: Economic cost to submit transactions (nearly free on testnet)
- ✅ **Mempool Limit**: Maximum 1,000 pending transactions
- ✅ **Rate Limiting**: Max 10 transactions per minute per address
- ✅ **EVM Signature Recovery**: ECDSA secp256k1 sender recovery for EIP-155 raw tx
- ✅ **0x Address Handling**: All endpoints strip `0x` prefix for compatibility with any wallet

### Consensus Security
- ✅ **Proof of Stake**: Validator selection by staked SAYN balance
- ✅ **Minimum Stake**: 10 tSAYN required per validator
- ✅ **Slashing**: Validators penalized for missed blocks
- ✅ **Chain ID Validation**: Prevents cross-network replay attacks
- ✅ **State Root Validation**: Deterministic state root per block

---

## 💰 Economics

### Token Supply
- **Max Supply (Testnet)**: Unlimited
- **Max Supply (Mainnet)**: 100,000,000 SAYN
- **Block Reward**: 0.5 tSAYN per block (testnet)
- **Blocks Per Day**: 17,280 (at 5s blocktime)
- **Daily Emission**: 8,640 tSAYN/day

### Staking
- **Minimum Stake**: 10 tSAYN (1,000,000,000 base units)
- **Unstake Delay**: 50 blocks
- **Slash Percentage**: 10% for missed blocks

---

## 🚀 Bootstrap Peers (P2P Network)

| Node | URL |
|---|---|
| **Primary (Railway)** | `wss://sayman.up.railway.app/p2p` |
| **Render Node 1** | `wss://sayman.onrender.com/p2p` |
| **Render Node 2** | `wss://sayman-1.onrender.com/p2p` |

---

## 🔧 REST API Endpoints (Phase 22)

**Base URL:** `https://sayman.onrender.com/api`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/network` | Network configuration (ticker, chainId, layer) |
| GET | `/stats` | Network statistics |
| GET | `/blocks` | List blocks (paginated) |
| GET | `/block/:index` | Get block by index |
| GET | `/block/hash/:hash` | Get block by hash |
| GET | `/transactions/:id` | Get transaction |
| GET | `/address/:address` | Unified address view — balance + txs + tokens + NFTs + reputation |
| GET | `/nonce/:address` | 🆕 Fresh nonce for address (use before every broadcast) |
| GET | `/validators` | List validators |
| GET | `/contracts` | List contracts |
| GET | `/tokens` | 🆕 All factory-deployed tokens |
| GET | `/nfts` | 🆕 All factory-deployed NFT collections |
| GET | `/memecoins` | 🆕 All factory-deployed memecoins |
| GET | `/mempool` | Current mempool |
| GET | `/tps` | Live TPS estimate |
| GET | `/denomination` | SAYN/sprinkle conversion table |
| GET | `/layers` | 🆕 L2/sidechain live status |
| POST | `/broadcast` | Submit signed transaction |
| POST | `/estimate-gas` | Estimate gas cost |
| POST | `/faucet` | Request test tokens (accepts 0x-prefixed addresses) |
| GET | `/search/:query` | Unified search — block/tx/address/token |

---

## 📦 Archive & Recovery

SAYMAN uses a GitHub-backed archive system (`github.com/saymanlal/sayman-archive`) for block persistence:

- Blocks archived in chunks of 1,000 blocks per file
- State snapshots (`snapshot-<height>.json`) saved every 100 blocks
- On startup, nodes sync from archive using **batched parallel download** (10 concurrent chunks)
- After crash & restart, archive data loaded in **< 10 seconds** from CDN

---

## 🌱 Getting Started

### 1. Run a Node
```bash
git clone https://github.com/saymanlal/SAYMAN
cd SAYMAN
npm install
node server.js --network public-testnet --mode validator
```

### 2. Get Test Tokens (Faucet)
```bash
# Regular drip — 1,000 tSAYN
curl -X POST https://sayman.onrender.com/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_ADDRESS"}'

# Or visit: https://sayman-faucet-site.vercel.app
# Bulk tokens (up to 10M tSAYN): Telegram @SaymanLal
```

### 3. Connect MetaMask
- Visit https://sayman.up.railway.app → Network → **"Add to MetaMask"**
- Or manually: RPC `https://sayman.onrender.com`, Chain `82922`, Symbol `tSAYN`

### 4. Send a Transaction via MetaMask
Once connected, MetaMask sends signed EIP-155 transactions directly to the SAYMAN node via `eth_sendRawTransaction`. Confirmations show in the block explorer at `https://sayman.up.railway.app`.

---

## 📊 Current Status (Phase 22)

- **Network Health**: ✅ Operational
- **Phase**: 22 — Full EVM/MetaMask Compat · tSAYN · NonceManager · Explorer 2.0
- **MetaMask Support**: ✅ Full EVM JSON-RPC 2.0 with all MetaMask polling methods
- **Address Format**: ✅ 0x-prefixed addresses accepted everywhere
- **Nonce Safety**: ✅ Atomic NonceManager — no race conditions
- **Explorer**: ✅ Tokens · NFTs · Memecoins · Address · Layers pages
- **APK**: ✅ PUKY Wallet v22 signed build

---

*Last updated: Phase 22 — July 2026*  
*IP Owner: [Vizkus Groups](https://vizkusgroups.me) (Cybokrafts Universal Innovations Pvt. Ltd.)*
