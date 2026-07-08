# ⛓️ SAYMAN BLOCKCHAIN — PHASE 13: DECENTRALIZED RESILIENCY & ENTERPRISE TOKENOMICS

**JavaScript-native Smart Contracts · Proof-of-Report · Civic Intelligence Layer · Robust Failover Mesh**

---

## 🎯 What's New in Phase 13

Phase 13 advances SAYMAN from a single-node smart contract prototype into a **resilient, decentralized, multi-validator network** ready for public hackathons and developer buildathons.

| Feature | Phase 9 | Phase 13 |
|---|---|---|
| **Decimal Precision** | 4 Decimals (`10,000` base units) | ✅ **8 Decimals** (`100,000,000` base units) for enterprise precision |
| **P2P Peer Sync** | Fragmented | ✅ **Cryptographically aligned serialization** (`publicKey: null` sync fix) |
| **RPC Resiliency** | Single host (crashes wallet if down) | ✅ **Multi-Node Failover Mesh** (Railway, Render, Local endpoints) |
| **Database Locks** | Single folder (conflicts on local run) | ✅ **Isolated Database Paths** (`./data/node-{port}`) |
| **P2P Server Modes** | Only validator node listened | ✅ **Validators, Fullnodes, & Observers** listen and sync |
| **Mobile App Updates**| Manual re-download | ✅ **Real-Time GitHub APK Update Notification & Download** |

---

## 📁 Repository Structure After Phase 13

```
sayman-chain/                ← This repo (blockchain node)
├── core/
│   ├── env.js               ← 🆕 Environment Loader (.env reader)
│   ├── blockchain.js        ← State verification, event APIs, report index
│   ├── contracts.js         ← JS sandboxing, msg.sender, event emitting
│   ├── state.js             ← Reputation ledger, event logs, snapshots
│   ├── transaction.js       ← Cryptographic fields (publicKey: null fix)
│   ├── block.js             (unchanged)
│   ├── gas.js               (unchanged)
│   ├── merkle.js            (unchanged)
│   ├── pos.js               (unchanged)
│   └── stateTree.js         (unchanged)
├── wallet-manager/          ← 📱 Web Wallet & Capacitor Android App
│   ├── app.js               ← RPC Failover client + Real-Time APK Update Checker
│   ├── index.html           ← Update Notification UI
│   └── .env                 ← Editable endpoint configurations
├── config/
│   ├── mainnet.js           ← Scaled 8-decimal mainnet parameters
│   ├── testnet.js           ← Scaled 8-decimal local testnet parameters
│   └── public-testnet.js    ← Scaled 8-decimal public testnet parameters
├── sdk/
│   └── client.js            ← Failover SaymanClient SDK
├── faucet/
│   └── server.js            ← Failover faucet backend
├── server.js                ← Multi-mode P2P listen, bootstrap parsing
└── .env                     ← Node-level configuration file
```

---

## 🔧 Critical Core Enhancements in Phase 13

### 1. 8-Decimals Precision Scaling
All token math throughout core configs, block rewards, genesis allocations, faucets, and CLI utilities has been scaled up to 8 decimal places:
* **`1 SAYN`** = `100,000,000 base units` (sprinkles).
* **Validator Block Reward (Mainnet)**: `0.2 SAYN` (`20,000,000 base units`).
* **Validator Block Reward (Testnet)**: `0.5 SAYN` (`50,000,000 base units`).
* **Minimum Validator Stake (Mainnet)**: `500 SAYN` (`50,000,000,000 base units`).
* **Minimum Validator Stake (Testnet)**: `10 SAYN` (`1,000,000,000 base units`).

### 2. Robust RPC Failover Mesh
To ensure the wallet app and explorer remain fully operational if a cloud hosting provider crashes:
* The core API calls (balance checks, transaction broadcasting, staking, contract calls) now run through a failover client wrapper (`apiFetch`).
* The client accepts an array of API nodes (e.g. `https://sayman.up.railway.app`, `https://sayman.onrender.com`, `http://localhost:3000`). If the primary node times out or errors, the wallet instantly rotates to the next active peer in the background.

### 3. Block-Sync Cryptographic Mismatch Fix
* **The Bug**: During transaction serialization, Node 1 omitted the `publicKey` field if it was `undefined` (common for system/reward transactions). Node 2 deserialized the transaction, explicitly setting `publicKey` to `null`. This difference in serialization caused block hash mismatches during peer sync, halting the P2P network.
* **The Fix**: The `Transaction` constructor now explicitly initializes `this.publicKey = null;` to ensure 100% byte-for-byte serialization matches across all nodes.

### 4. Automated Node-Level DB Isolation
* To prevent LevelDB lock crashes when simulating multiple nodes locally, the database path automatically falls back to `./data/node-${config.apiPort}` if `DB_PATH` is not explicitly declared.

---

## 📱 Real-Time GitHub APK Update Checker

The PUKY Mobile Wallet app features a built-in checking utility:
* **Periodic Check**: The wallet polls the GitHub Contents API for the repo's compiled APK (`apk/base.apk`) on startup and every 60 seconds.
* **Update Notification**: If the file hash (SHA) on GitHub does not match the local installed version, the app prompts the user with a modal containing the new version hash.
* **Direct Download**: Clicking "Download & Install" triggers a background download of the latest APK from the raw repository link.

---

## 📝 Writing Smart Contracts

Smart contracts are written in vanilla JavaScript and deployed directly.

### Sandbox Globals Available:
* `state`: Persistent key-value storage object.
* `msg.sender` / `caller`: Address of the transaction sender.
* `args`: Arguments passed to the method.
* `emit(event, data)`: Emits queryable blockchain events.
* `transfer(to, amount)`: Moves SAYN tokens from the contract balance.

### Example Contract:
```javascript
const contract = {
  methods: {
    deposit(args) {
      const balances = getState('balances') || {};
      balances[msg.sender] = (balances[msg.sender] || 0) + args.amount;
      setState('balances', balances);
      emit('DEPOSIT', { user: msg.sender, amount: args.amount });
    },
    getBalance(args) {
      return (getState('balances') || {})[args.address] || 0;
    }
  }
};
```

---

## 🚀 Running the Testnet locally (Quick Start)

### 1. Configure the node environment
Create a local `.env` file:
```env
NODE_ENV=testnet
PORT=3000
P2P_PORT=6001
BOOTSTRAP_PEERS=
```

### 2. Start Node 1 (Validator / Bootstrap)
```bash
node server.js --network testnet --mode validator
```

### 3. Start Node 2 (Syncing Peer)
```bash
PORT=3001 P2P_PORT=6002 BOOTSTRAP_PEERS="http://localhost:3000" node server.js --network testnet --mode validator
```

### 4. Access the Explorer
Start a server for the web explorer:
```bash
npx http-server ./frontend -p 8080
```
Open `http://localhost:8080` in your web browser.