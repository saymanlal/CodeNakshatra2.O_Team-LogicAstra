# 🌐 SAYMAN Blockchain — Network Info & Wallet Connection Guide

**Phase 21** | Public Testnet | Chain ID: `82922`  
**RPC Endpoint:** `https://sayman.onrender.com`  
**Block Explorer:** `https://sayman.onrender.com`  
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
| **Currency Symbol** | `SAYN` |
| **Block Explorer URL** | `https://sayman.onrender.com` |
| **Network Hex ID** | `0x143ea` |

### 💻 Local Development Node

| Parameter | Value |
|---|---|
| **Network Name** | Sayman Local Testnet |
| **New RPC URL** | `http://localhost:10000` |
| **Chain ID** | `82923` |
| **Currency Symbol** | `SAYN` |
| **Block Explorer URL** | `http://localhost:10000` |

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
   - **Currency symbol:** `SAYN`
   - **Block explorer URL:** `https://sayman.onrender.com`
5. Click **Save** → then **"Switch to Sayman Public Testnet"**

### Mobile (MetaMask App)

1. Open MetaMask → tap the hamburger menu
2. Tap **Settings** → **Networks** → **Add Network**
3. Enter the same values as above
4. Tap **Add** to confirm

---

## 🌍 Add to Other Wallets

### Trust Wallet
1. Go to Settings → Preferences → Custom Network
2. Enter: RPC URL `https://sayman.onrender.com`, Chain ID `82922`, Symbol `SAYN`

### Coinbase Wallet
1. Settings → Active Networks → Add Custom Network
2. Enter the same network details as above

### Rabby / Rainbow / Brave Wallet
- All support EIP-3085 (`wallet_addEthereumChain`) — use the same values

### WalletConnect
- SAYMAN is fully WalletConnect compatible; use Chain ID `82922` to connect

---

## 🛠️ Supported JSON-RPC Methods

| Method | Description |
|---|---|
| `eth_chainId` | Returns `0x143ea` (82922 for public testnet) |
| `net_version` | Returns `"82922"` |
| `eth_blockNumber` | Latest block height in hex |
| `eth_getBlockByNumber` | Block data (EVM-format) by number |
| `eth_getBlockByHash` | Block data (EVM-format) by hash |
| `eth_getBalance` | Address balance in Wei-equivalent (base units × 10¹⁰) |
| `eth_getTransactionCount` | Account nonce (for transaction ordering) |
| `eth_sendRawTransaction` | Submit signed EIP-155/2930/1559 transaction |
| `eth_getTransactionByHash` | Transaction details by hash |
| `eth_getTransactionReceipt` | Transaction receipt (status, gas used) |
| `eth_estimateGas` | Gas estimate (returns `0x5208` = 21000) |
| `eth_gasPrice` | Current gas price in Wei-equivalent |
| `eth_accounts` | Returns `[]` (non-custodial) |
| `web3_clientVersion` | `SAYMAN/v21.0.0/javascript` |

---

## 💡 Example: curl JSON-RPC Calls

```bash
# Get chain ID
curl -X POST https://sayman.onrender.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'

# Get latest block number
curl -X POST https://sayman.onrender.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get balance (replace ADDRESS with your 0x-prefixed address)
curl -X POST https://sayman.onrender.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xADDRESS","latest"],"id":1}'
```

---

## 🌐 Network Overview (Phase 21)

| Parameter | Value |
|---|---|
| **Network Name** | Sayman Public Testnet |
| **Chain ID (string)** | `sayman-public-testnet-1` |
| **Chain ID (numeric)** | `82922` |
| **Layer** | L1 (Base chain) |
| **Block Time** | 5 seconds |
| **Block Reward** | 0.5 SAYN (50,000,000 base units) |
| **Min Stake** | 10 SAYN (1,000,000,000 base units) |
| **Max Supply** | Unlimited (testnet) |
| **Ticker** | SAYN |
| **Base Unit** | sprinkle (1 SAYN = 100,000,000 sprinkles) |
| **Decimals** | 8 |
| **Gas Price** | 1 base unit per gas unit |
| **Transfer Gas** | 21,000 gas |
| **Faucet** | ✅ Enabled |
| **Faucet Amount** | 1,000 SAYN per drip |
| **Faucet Cooldown** | 60 seconds |

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
- ✅ **Nonce System**: Sequential nonce per address prevents replay attacks
- ✅ **Gas Fees**: Economic cost to submit transactions (nearly free on testnet)
- ✅ **Mempool Limit**: Maximum 1,000 pending transactions
- ✅ **Rate Limiting**: Max 10 transactions per minute per address
- ✅ **EVM Signature Recovery**: ECDSA secp256k1 sender recovery for EIP-155 raw tx

### Consensus Security
- ✅ **Proof of Stake**: Validator selection by staked SAYN balance
- ✅ **Minimum Stake**: 10 SAYN required per validator
- ✅ **Slashing**: Validators penalized for missed blocks
- ✅ **Chain ID Validation**: Prevents cross-network replay attacks
- ✅ **State Root Validation**: Deterministic state root per block

---

## 💰 Economics

### Token Supply
- **Max Supply**: Unlimited (testnet)
- **Block Reward**: 0.5 SAYN per block
- **Blocks Per Day**: 17,280 (at 5s blocktime)
- **Daily Emission**: 8,640 SAYN/day

### Staking
- **Minimum Stake**: 10 SAYN (1,000,000,000 base units)
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

## 🔧 REST API Endpoints

**Base URL:** `https://sayman.onrender.com/api`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/network` | Network configuration |
| GET | `/stats` | Network statistics |
| GET | `/blocks` | List blocks (paginated) |
| GET | `/block/:index` | Get block by index |
| GET | `/block/hash/:hash` | Get block by hash |
| GET | `/transactions/:id` | Get transaction |
| GET | `/address/:address` | Get address info + tx history |
| GET | `/validators` | List validators |
| GET | `/contracts` | List contracts |
| GET | `/mempool` | Current mempool |
| GET | `/tps` | Live TPS estimate |
| GET | `/denomination` | SAYN/sprinkle conversion table |
| POST | `/broadcast` | Submit signed transaction |
| POST | `/estimate-gas` | Estimate gas cost |
| GET | `/faucet/:address` | Request test tokens |
| GET | `/search/:query` | Search block/tx/address |

---

## 📦 Archive & Recovery

SAYMAN uses a GitHub-backed archive system (`github.com/saymanlal/sayman-archive`) for block persistence:

- Blocks are archived in chunks of 1,000 blocks per file
- State snapshots (`snapshot-<height>.json`) saved every 100 blocks
- On startup, nodes sync from archive using **batched parallel download** (10 concurrent chunks)
- Nodes can recover **billions of blocks** purely from GitHub archive in seconds/minutes
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
curl -X POST https://sayman.onrender.com/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_ADDRESS"}'
```

### 3. Become a Validator
```bash
# Send a STAKE transaction with minimum 10 SAYN
# Use the PUKY mobile wallet or API directly
```

### 4. Connect MetaMask
- Open MetaMask → Add Network → Manual
- RPC: `https://sayman.onrender.com`, Chain: `82922`, Symbol: `SAYN`

---

## 📊 Current Status (Phase 21)

- **Network Health**: ✅ Operational
- **Phase**: 21 — EVM RPC Wallet & Parallel Sync
- **P2P Archive Sync**: ✅ Batched parallel (10 concurrent chunks)
- **Memory Model**: ✅ ChainProxy — only last 100 blocks in RAM, rest in LevelDB
- **OOM Crashes**: ✅ Eliminated — no full-chain write on every block
- **MetaMask Support**: ✅ Full EVM JSON-RPC 2.0

---

*Last updated: Phase 21 — July 2026*  
*Generated by: `npm run docs` → `NETWORK_INFO.md`*
