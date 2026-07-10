# SAYMAN Testnet - Network Information

**Generated:** 7/10/2026, 5:46:00 AM  
**API Endpoint:** http://localhost:3000/api

---

## 🌐 Network Overview

| Parameter | Value |
|-----------|-------|
| **Network Name** | SAYMAN Testnet |
| **Chain ID** | `sayman-testnet-1` |
| **Current Block Height** | 1,063 |
| **Block Time** | 1.0s |
| **Block Reward** | 50000000 SAYN |
| **Minimum Stake** | 1000000000 SAYN |
| **Faucet Status** | ✅ Enabled (Testnet) |

---

## ⛽ Gas Model

### Gas Limits

| Parameter | Value |
|-----------|-------|
| **Minimum Gas Price** | 1 wei |
| **Max Gas Per Transaction** | 10,000,000 |
| **Max Gas Per Block** | 100,000,000 |
| **Max Execution Time** | 5000ms |
| **Max State Size** | 500KB |
| **Max Instructions** | 100,000 |

### Gas Costs

| Transaction Type | Base Gas Cost |
|-----------------|---------------|
| **TRANSFER** | 21000 |
| **STAKE** | 50000 |
| **UNSTAKE** | 50000 |
| **CONTRACT_DEPLOY** | 200000 + code size / 10 |
| **CONTRACT_CALL** | 50000 + execution |
| **State Read** | undefined |
| **State Write** | undefined |

---

## 👥 Validators

**Total Active Validators:** 1  
**Total Network Stake:** 100,000,000,000 SAYN  
**Estimated APR:** 1576800.00%

### Top Validators

| Address | Stake | Network % | Missed Blocks |
|---------|-------|-----------|---------------|
| `855a8f7a8cf989ba...` | 100,000,000,000 SAYN | 100.00% | 0 |

---

## 📜 Smart Contracts

**Total Deployed Contracts:** 0

Contracts are executed in a sandboxed JavaScript VM with the following restrictions:
- Maximum execution time: 5000ms
- Maximum state size: 500KB
- Maximum instructions: 100,000
- No access to: require, process, filesystem, network

---

## 🔐 Security Features

### Anti-Spam Protections

- ✅ **Nonce System**: Sequential nonce per address prevents replay attacks
- ✅ **Gas Fees**: Economic cost to submit transactions
- ✅ **Mempool Limit**: Maximum 1,000 pending transactions
- ✅ **Rate Limiting**: Max 10 transactions per minute per address
- ✅ **Minimum Gas Price**: 1 wei

### Consensus Security

- ✅ **Proof of Stake**: 1 active validators
- ✅ **Minimum Stake**: 1000000000 SAYN required
- ✅ **Slashing**: Validators penalized for missed blocks
- ✅ **Chain ID Validation**: Prevents cross-network attacks

---

## 💰 Economics

### Token Supply

- **Max Supply**: 21,000,000 SAYN
- **Block Reward**: 50000000 SAYN per block
- **Blocks Per Day**: 86400
- **Daily Emission**: 4320000000000 SAYN

### Staking

- **Minimum Stake**: 1000000000 SAYN
- **Total Staked**: 100,000,000,000 SAYN
- **Estimated APR**: 1576800.00%
- **Unstake Delay**: Variable (configured per network)

---

## 🔧 API Endpoints

**Base URL:** `http://localhost:3000/api`

### Core Endpoints

- `GET /network` - Network configuration
- `GET /stats` - Network statistics
- `GET /blocks` - List blocks (paginated)
- `GET /blocks/:index` - Get specific block
- `GET /transactions/:id` - Get transaction
- `GET /address/:address` - Get address info
- `GET /validators` - List validators
- `GET /contracts` - List contracts
- `POST /broadcast` - Submit signed transaction
- `POST /estimate-gas` - Estimate gas cost

### Search

- `GET /search/:query` - Search by block/tx/address

---

## 📱 CLI Usage

Install the CLI tool:

```bash
cd cli
npm install
npm link
```

### Commands

```bash
# Wallet
sayman wallet create
sayman wallet import <privateKey>
sayman balance [address]

# Transactions
sayman send <to> <amount>
sayman stake <amount>
sayman unstake

# Contracts
sayman deploy <file.js>
sayman call <contract> <method> [args]

# Network
sayman network
sayman validators
sayman estimate <type> <data>
```

---

## 🚀 Getting Started

### 1. Run a Node

```bash
# Testnet
npm run testnet

# Mainnet
npm run mainnet
```

### 2. Create Wallet

```bash
sayman wallet create
```

### 3. Get Test Tokens (Testnet Only)

```bash
curl -X POST http://localhost:3000/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_ADDRESS"}'
```

### 4. Stake and Become Validator

```bash
sayman stake 1000000000
```

---

## 📊 Current Status

- **Network Health**: ✅ Operational
- **Block Height**: 1,063
- **Active Validators**: 1
- **Network Stake**: 100,000,000,000 SAYN
- **Mempool Size**: 0

---

*This document is auto-generated. Last updated: 7/10/2026, 5:46:00 AM*
