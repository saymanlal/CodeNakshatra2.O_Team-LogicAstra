# 🧠 SAYMAN Blockchain: Complete Project Memory & Developer Reference Manual

This file serves as the unified project memory and context sheet for the **SAYMAN Blockchain** and **PUKY Wallet** ecosystem. If a new session is started, you are switching AI models, or your free trial limit is reached, feed this entire file to the new AI agent as a prompt to resume development immediately.

---

## 📋 1. Project Overview & Architecture

SAYMAN is a Proof-of-Stake (PoS) Layer 1 blockchain built in Node.js, designed for Civic Intelligence, decentralized city reporting, and community-level AI verification. From Phase 14, it also supports custom multi-layer chains, user-deployed tokens, NFT collections, memecoins, DEX/AMM, and staking pools — essentially a full Web3 platform.

### Current Phase: **Phase 18 — Pipelined Parallel Transaction Execution**
- Branch: `phase18`
- Git origin: `origin/phase17` (phase18 builds on this)

### 🪙 Tokenomics
* **Ticker**: `SAYN` (1 SAYN = 100,000,000 base units — called "sprinkles")
* **Decimals**: 8 (i.e. `decimals = 100_000_000`)
* **Block Time**: 5 seconds (mainnet), 5 seconds (public testnet)
* **Block Reward**: 0.5 SAYN = 50,000,000 base units (testnet), 0.2 SAYN = 20,000,000 (mainnet)
* **Min Stake**: 10 SAYN (testnet), 500 SAYN (mainnet)
* **Halving Schedule**: Every 12,614,400 blocks (~2 years)
* **Max Supply**: 0 (unlimited on testnet)

### ⚠️ SAYN vs Base Units — Critical for Explorers and APIs
All on-chain balances are stored as integers in **base units (sprinkles)**. Divide by `decimals` (default: `100_000_000`) to convert to SAYN.
- `GET /api/denomination` — returns a complete guide including conversion examples
- `GET /api/tps` — returns live TPS, decimals, and denomination info
- In the explorer: every balance is shown as `X.XXXX SAYN (Y base units)` to prevent confusion

---

## 🏗️ 2. Repository Structure

```
sayman/
├── core/
│   ├── blockchain.js       # Main blockchain engine (Phase 14: TPS estimate, gasLimits/gasCosts in getStats)
│   ├── state.js            # StateEngine (balances, stakes, reputation, contracts)
│   ├── block.js            # Block class
│   ├── transaction.js      # Transaction types (TRANSFER, STAKE, REWARD, REPUTATION_UPDATE, etc.)
│   ├── pos.js              # Proof-of-Stake validator selection
│   ├── contracts.js        # Smart contract VM (sandboxed JS execution)
│   ├── gas.js              # Gas calculator (costs, limits, fee policy)
│   ├── stateTree.js        # Merkle state tree
│   ├── chain-factory.js    # Phase 14: ChainFactory for L2/Sidechain/Permissioned chains
│   ├── rollup.js           # Phase 14: L2 rollup state commitment to L1
│   └── env.js              # .env loader
├── contracts/
│   ├── token.js            # ERC-20 style custom token contract
│   ├── nft.js              # ERC-721 style NFT contract
│   ├── token-factory.js    # Factory: anyone deploys their own token in one call
│   ├── nft-factory.js      # Factory: NFT collection creator
│   ├── memecoin-factory.js # Phase 14: Memecoin launcher (burn, tax, anti-whale, registry)
│   ├── dex.js              # Phase 14: AMM DEX (Uniswap V2 x*y=k, 0.3% fee)
│   ├── staking-pool.js     # Phase 14: Delegated staking pool (earn rewards without running a node)
│   ├── layer2Bridge.js     # L1 bridge for L2 state anchoring, deposits, withdrawals
│   └── example.js          # Example contract
├── p2p/
│   ├── server.js           # P2P WebSocket server (discovery, sync, reputation for peers)
│   └── peerManager.js      # Peer list manager
├── api/
│   └── routes.js           # REST API routes (Phase 14: /api/tokens, /api/nfts, /api/tps, /api/denomination, /api/staking-pools)
├── wallet/
│   └── wallet.js           # Wallet (key gen, sign, address derive)
├── sdk/
│   └── client.js           # SaymanClient SDK with RPC failover
├── cli/
│   └── sayman-cli.js       # CLI wallet
├── frontend/
│   ├── index.html          # Explorer UI (Phase 14: Layers page, TPS card, Denomination card)
│   ├── app.js              # Explorer JS (Phase 14: loadLayers, TPS display, denomination clarity)
│   └── style.css           # Dark theme UI styles
├── config/
│   ├── index.js            # Config loader
│   ├── testnet.js          # Local testnet config
│   ├── public-testnet.js   # Public testnet config (Render deployment)
│   └── mainnet.js          # Mainnet config
├── server.js               # Express + P2P bootstrap server (Phase 14: sequencer mode, rollup)
└── AI.md                   # This file — always keep updated
```

---

## 🗳️ 3. Proof-of-Stake Consensus

* Validators stake tokens to participate in block production.
* Block proposer is deterministically selected each round using the previous block hash as a VRF seed:
  ```javascript
  const seed = hash(lastBlockHash);
  const idx  = parseInt(seed.substring(0, 16), 16) % totalStake;
  ```
* `addBlock(block)` verifies: index, previousHash, chainId, validator selection, hash integrity, stateRoot.
* Peers who help sync blocks earn **+2 reputation per block** synced (in `p2p/server.js`).
* Validators earn **+10 reputation per block** produced (in `blockchain.applyBlock`).
* Peer reputation points are earned dynamically for consensus contributions.

---

## 🔗 4. Multi-Layer Architecture (Phase 14)

SAYMAN supports a full multi-layer blockchain ecosystem:

### Layer Types
| Layer | Type | Description |
|-------|------|-------------|
| L1 | Main chain | SAYMAN itself — anchors all L2 state roots via bridge |
| L2 Rollup | Anchored to L1 | Fast blocks (0.5s), commits state roots every N blocks to L1Bridge contract |
| Sidechain | Independent L1-style | Own tokenomics, optionally bridged. Good for games/NFT platforms |
| Permissioned | Private consortium | Invited validators only |

### Creating a New Chain
```javascript
import { ChainFactory } from './core/chain-factory.js';
import Blockchain from './core/blockchain.js';

// Layer 2 Rollup
const config = ChainFactory.createL2Config({
  name: 'MyL2Chain',
  chainId: 'my-l2-1',
  apiPort: 11000,
  l1RpcUrl: 'https://sayman.onrender.com',
  l1Bridge: '<BRIDGE_CONTRACT_ADDRESS>',
  genesis: { '<YOUR_ADDRESS>': 1_000_000_000 }
});
const chain = new Blockchain(config, './data/my-l2');
await chain.initialize();

// Sidechain
const sideConfig = ChainFactory.createSidechainConfig({
  name: 'GameChain',
  chainId: 'gamechain-1',
  blockReward: 10_000_000,
  genesis: { '<DEV_WALLET>': 100_000_000_000 }
});

// Permissioned
const permConfig = ChainFactory.createPermissionedConfig({
  name: 'Enterprise',
  chainId: 'ent-1',
  validators: ['<ADDR1>', '<ADDR2>']
});
```

### Running Sequencer Mode (L2)
```bash
node server.js --network public-testnet --mode sequencer
```
Every 5 blocks, the sequencer calls `rollup.js` → `submitRollupToL1()` → commits `stateRoot` to the L1 Bridge contract.

---

## 💻 5. Smart Contract Development Guide

Contracts are written in plain JavaScript and run in a secure sandboxed VM. No imports allowed.

### Available Built-ins
| Method/Variable | Description |
|---|---|
| `getState(key)` | Read from contract's persistent state |
| `setState(key, val)` | Write to contract's persistent state |
| `transfer(toAddress, amount)` | Transfer SAYN (base units) from contract to address |
| `getBalance(address)` | Get SAYN balance of any address |
| `msg.sender` | Transaction sender address |
| `blockTimestamp` | Current block timestamp (ms) |
| `emit(event, data)` | Emit a contract event |
| `hash(data)` | SHA-256 hash of any JSON-serializable value |
| `generateAddress(seed)` | Derive a deterministic 40-char hex address |
| `require(cond, msg)` | Assert or revert |
| `console.log(...)` | Debug log to validator terminal |

### 🪙 Token Factory (create your own token)
```javascript
// Deploy the token-factory.js contract once, then:
client.callContract({
  contractAddress: TOKEN_FACTORY_ADDR,
  method: 'createToken',
  args: { name: 'My Token', symbol: 'MTK', totalSupply: 1_000_000 },
  wallet: myWallet
});
```

### 🐸 Memecoin Launcher (with burn, tax, anti-whale)
```javascript
client.callContract({
  contractAddress: MEMECOIN_FACTORY_ADDR,
  method: 'launch',
  args: {
    name: 'DogeSAYN', symbol: 'DSAYN', totalSupply: 1_000_000_000,
    iconUrl: 'https://example.com/icon.png',
    maxWalletPercent: 2,      // 2% max wallet anti-whale
    transferTaxPercent: 1,    // 1% routed to treasury
    treasury: '<ADDR>',
    burnOnTransfer: false,
  }
});
```

### 🎨 NFT Collections
```javascript
// Step 1: Create collection
client.callContract({
  contractAddress: NFT_FACTORY_ADDR,
  method: 'createCollection',
  args: { name: 'CoolNFTs', symbol: 'COOL', maxSupply: 10000 }
});

// Step 2: Mint to someone
client.callContract({
  contractAddress: NFT_FACTORY_ADDR,
  method: 'mint',
  args: { collAddr: '<COLL_ADDR>', to: '<RECIPIENT>', tokenURI: 'ipfs://...' }
});
```

### 💱 DEX / AMM
```javascript
// Add liquidity
client.callContract({
  contractAddress: DEX_ADDR,
  method: 'addLiquidity',
  args: { tokenA: 'ADDR_A', tokenB: 'ADDR_B', amountA: 1000, amountB: 2000 }
});

// Swap (x*y=k, 0.3% fee)
client.callContract({
  contractAddress: DEX_ADDR,
  method: 'swap',
  args: { tokenIn: 'ADDR_A', tokenOut: 'ADDR_B', amountIn: 100, minAmountOut: 190 }
});
```

### 🏊 Staking Pool (delegate without running a node)
```javascript
client.callContract({
  contractAddress: POOL_ADDR,
  method: 'delegate',
  args: { amount: 1_000_000 }  // base units
});
// Claim rewards
client.callContract({ contractAddress: POOL_ADDR, method: 'claimRewards', args: {} });
```

---

## 🌐 6. REST API Reference

### System & Stats
| Endpoint | Description |
|---|---|
| `GET /api/network` | Network info (chainId, layer, ticker, decimals, denomination guide) |
| `GET /api/stats` | Block count, mempool, validators, TPS, gasLimits, gasCosts |
| `GET /api/tps` | Live TPS + denomination info |
| `GET /api/denomination` | Explicit SAYN/base-unit conversion guide |
| `GET /api/network/stats` | Node stats (nodeId, mode, uptime, peers) |

### Blocks
| Endpoint | Description |
|---|---|
| `GET /api/blocks?page=1&limit=50` | Paginated block list |
| `GET /api/block/:index` | Block by height |
| `GET /api/block/hash/:hash` | Block by hash (prefix supported) |
| `GET /api/light/block/:height` | Light-client header only |
| `GET /api/proof/:address` | Merkle state proof |
| `POST /api/proof/verify` | Verify a Merkle proof |

### Accounts
| Endpoint | Description |
|---|---|
| `GET /api/address/:address` | Balance, stake, nonce, txs, reputation |
| `GET /api/balance/:address` | Balance only (legacy) |
| `GET /api/reputation/:address` | Reputation score |

### Transactions
| Endpoint | Description |
|---|---|
| `POST /api/broadcast` | Submit signed transaction |
| `POST /api/estimate-gas` | Estimate gas for a tx type |
| `GET /api/mempool` | Pending transactions |
| `GET /api/transactions/:id` | Transaction by ID |

### Validators & Contracts
| Endpoint | Description |
|---|---|
| `GET /api/validators` | Active validators with stake, reputation, percentage |
| `GET /api/contracts` | All deployed contracts |
| `GET /api/contracts/:address` | Single contract |

### Web3 Platform (Phase 14)
| Endpoint | Description |
|---|---|
| `GET /api/tokens` | All custom tokens (from token-factory and memecoin-factory) |
| `GET /api/nfts` | All NFT collections (from nft-factory) |
| `GET /api/staking-pools` | All staking pool contracts |

### Faucet & Admin
| Endpoint | Description |
|---|---|
| `POST /api/faucet` | Testnet faucet (body: `{ address }`) |
| `POST /api/admin/fund` | Admin fund endpoint (body: `{ address, amount, secret }`) |

---

## ⚡ 7. SDK Reference (`sdk/client.js`)

The `SaymanClient` SDK includes built-in RPC failover.

```javascript
import { SaymanClient } from './sdk/client.js';
const client = new SaymanClient({
  rpcUrl: 'https://sayman.up.railway.app,https://sayman.onrender.com,http://localhost:10000'
});
```

### Core Methods
| Method | Description |
|---|---|
| `deployContract({ name, version, code, abi, feePolicy, wallet, gasLimit, gasPrice })` | Deploy a contract |
| `callContract({ contractAddress, method, args, wallet, gasLimit, gasPrice })` | Call a contract method |
| `readState(contractAddress, key)` | Read a single state key |
| `readAllState(contractAddress)` | Read all state |
| `transfer({ to, amount, wallet, gasLimit, gasPrice })` | Send SAYN (amount in SAYN float, SDK scales to base units) |

---

## 🛠️ 8. CLI Reference (`cli/sayman-cli.js`)

```bash
sayman init            # Initialize wallet
sayman create          # New wallet
sayman import <key>    # Import private key
sayman balance         # Show balance, stake, nonces
sayman send <addr> <amount>   # Transfer SAYN
sayman stake <amount>         # Stake tokens
sayman unstake <amount>       # Unstake
sayman config <rpc_url>       # Set RPC
```

---

## 🚀 9. Deployment

### Environment Variables
```env
NETWORK=public-testnet       # or testnet, mainnet
MODE=validator               # or sequencer, full, observer
PORT=10000
P2P_PORT=                    # leave blank to share HTTP port at /p2p
BOOTSTRAP_PEERS=wss://...    # comma-separated peer WS URLs
VALIDATOR_ADDRESS=           # optional — only produce blocks when selected
DB_PATH=./data/node-10000
# L2 Rollup (sequencer mode only)
L1_RPC_URL=https://sayman.onrender.com
L1_BRIDGE_CONTRACT=<addr>
L1_SEQUENCER_PRIVATE_KEY=<hex>
```

### Procfile (Render/Railway)
```
web: node server.js --network public-testnet --mode validator
```

---

## 🔁 10. P2P Network & Reputation

* **Heartbeat & Keep-Alive**: Every 15s, each node sends a WebSocket ping (heartbeat) to every connected peer to maintain the connection. Dead or unresponsive sockets are closed and pruned.
* **Catch-up Sync**: Handshake checks determine if a connecting node is lagging behind. If a peer is behind us, the node immediately sends them the missing blocks to get them up to speed.
* **Auto-discovery**: Every 30s, each node requests peer lists from all connected peers.
* **Reconnect**: Dead peers are retried every 15s. After 1h offline, a deploy webhook fires (if configured).
* **Self-healing**: Inactive connections (no message for 90s) are pruned.
* **Reputation for peers**: When a peer sends valid blocks during sync, it earns `+2 reputation per block`.
* **Reputation addresses**: Peer reputation is tracked using `SHA-256('peer:' + nodeId).slice(0, 40)`.
* **Block validators**: Each block producer earns `+10 reputation` per block via `applyBlock`.
* **Reputation API**: `GET /api/reputation/:address` returns the current score.

---

## 🎯 11. How to Resume Work in a New AI Session

Copy-paste this prompt:

> **PROMPT**: "I am working on the SAYMAN Blockchain project (Phase 18). Please read the file `AI.md` located in the root of the workspace to load the entire project context, API routes, CLI commands, SDK signatures, smart contract guide, and multi-layer architecture. Once loaded, confirm you are ready to continue building."

---

## 📋 12. Phase History

| Phase | Key Features |
|---|---|
| Phase 1 | Genesis, PoS, basic blocks |
| Phase 2 | Wallet, CLI, SDK |
| Phase 3 | P2P networking |
| Phase 4 | Smart contracts (JS VM) |
| Phase 5 | Gas model |
| Phase 6 | Merkle state tree, proofs |
| Phase 7 | Halving, slashing |
| Phase 8 | Snapshots, DB persistence |
| Phase 9 | Reputation engine, events |
| Phase 10 | Report system (civic intelligence) |
| Phase 11 | Explorer UI overhaul |
| Phase 12 | Sponsorship fee policy |
| Phase 13 | P2P sync fixes, anti-fork protection |
| Phase 14 | Multi-layer chains, custom tokens, NFTs, memecoins, DEX/AMM, staking pools, TPS tracking, denomination clarity, peer reputation |
| Phase 15 | P2P heartbeat keep-alive, handshake catch-up sync, stake amount normalization, gas decimal fixes, faucet/genesis transaction history remap, and rebuilt Android APK |
| Phase 17 | Constructor state execution fix (prototype pre-binding), Render RPC prioritization, Explorer SPA path-based fallbacks, mobile UX polishing, Dark Theme persist, and 7,000 simulated TPS upgrades |
| **Phase 18** | **Pipelined parallel execution compatibility, transaction access set dependency analysis, deterministic conflict-free parallel bucket scheduling, and live parallel efficiency metrics in the explorer UI** |
