# ⛓️ SAYMAN BLOCKCHAIN — PHASE 9: SMART CONTRACT PLATFORM

**JavaScript-native Smart Contracts · Proof-of-Report · Civic Intelligence Layer**

---

## 🎯 What's New in Phase 9

Phase 9 transforms SAYMAN from a Merkle-verified coin chain (Phase 8) into a **full JavaScript smart contract platform** with a purpose-built civic intelligence layer for dApps like CrowdPulse.

| Feature | Phase 8 | Phase 9 |
|---|---|---|
| Smart contracts | Basic (broken sandbox) | ✅ Full JS sandbox, events, returns |
| `msg.sender` | ❌ Crashed | ✅ Available in all contracts |
| Return values | ❌ Discarded | ✅ Captured and returned |
| Event system | ❌ Missing | ✅ `emit()` + queryable log |
| Contract metadata | ❌ None | ✅ Name, version, ABI stored |
| External dApp repos | ❌ Not possible | ✅ SDK + deploy scripts |
| Reputation engine | ❌ Missing | ✅ Built into StateEngine |
| Native report txs | ❌ Missing | ✅ `REPORT_CREATE/VERIFY/RESOLVE` |
| Contract registry | ❌ None | ✅ `GET /api/contracts` |

---

## 📁 Repository Structure After Phase 9

```
sayman-chain/                ← This repo (blockchain node)
├── core/
│   ├── blockchain.js        ← ✅ Updated: new tx types, event API, report index
│   ├── contracts.js         ← ✅ Updated: events, returns, msg.sender, ABI
│   ├── state.js             ← ✅ Updated: reputation, event log, fixed crypto import
│   ├── transaction.js       ← ✅ Updated: REPORT_CREATE/VERIFY/RESOLVE, REPUTATION_UPDATE
│   ├── block.js             (unchanged)
│   ├── gas.js               (unchanged)
│   ├── merkle.js            (unchanged)
│   ├── pos.js               (unchanged)
│   └── stateTree.js         (unchanged)
├── contracts/
│   ├── example.js           ← ✅ Rewritten: new contract = { methods: {} } style
│   └── token.js             ← ✅ Rewritten: msg.sender fixed
├── sdk/
│   ├── client.js            ← 🆕 SaymanClient SDK
│   └── index.js             ← 🆕 SDK entry point
└── api/
    └── routes.js            ← Add new Phase 9 routes (see section below)

crowdpulse/                  ← Separate dApp repo
├── contracts/
│   ├── ReportRegistry.js    ← 🆕 Civic report storage contract
│   ├── ReputationManager.js ← 🆕 Trust score contract
│   └── RewardManager.js     ← 🆕 Points and badges contract
├── scripts/
│   └── deploy.js            ← 🆕 Deploy all contracts to SAYMAN
├── backend/
│   └── index.js             ← 🆕 Express API bridge + AI verification
├── frontend/
│   └── index.html           ← 🆕 Working demo UI
└── deployed.json            ← Auto-generated after deployment
```

---

## 🔧 Critical Bug Fixes in Phase 9

### 1. `msg.sender` was undefined → crash
**Before:**
```javascript
// token.js — BROKEN
const from = msg.sender;  // ReferenceError: msg is not defined
```
**After:** `msg.sender` is now fully exposed in the sandbox:
```javascript
const sandbox = {
  msg: { sender: from, caller: from },
  caller: from,
  // ...
};
```

### 2. Return values were silently discarded
**Before:** `getCount()` returned a value that was thrown away.
**After:**
```javascript
sandbox.__returnValue = undefined;
// script executes: __returnValue = contract.methods.getCount(args)
returnValue = sandbox.__returnValue;  // ✅ captured
```

### 3. `require('crypto')` crashed in ES module context
**Before** (state.js):
```javascript
const contractCodeHash = require('crypto')  // ❌ crashes in ESM
  .createHash('sha256').update(code).digest('hex');
```
**After:**
```javascript
import crypto from 'crypto';  // ✅ at top of file, used everywhere
```

### 4. Contract state was accessed wrong
**Before:** Contracts used `state.count` but sandbox exposed `contract.state`.
**After:** Sandbox directly exposes `state: contract.state`, so `state.count` works.

### 5. Old flat-function contracts broken by new style
Phase 9 supports **both** contract styles simultaneously:
```javascript
// Style A (Phase 9 — preferred):
const contract = {
  methods: {
    createReport(args) { ... }
  }
};

// Style B (backward compatible — old style still works):
function createReport(args) { ... }
```

---

## 📝 Writing Smart Contracts (Phase 9)

Contracts are plain JavaScript files. Drop them anywhere — no compiler, no Solidity.

### Sandbox globals available inside every contract:

| Global | Type | Description |
|---|---|---|
| `state` | object | Contract's persistent state (read/write directly) |
| `msg.sender` | string | Address of the caller |
| `caller` | string | Same as `msg.sender` |
| `args` | object | Arguments passed to this method call |
| `blockTimestamp` | number | Current block timestamp (ms) |
| `getState(key)` | function | Read a state key (metered) |
| `setState(key, value)` | function | Write a state key (metered) |
| `emit(event, data)` | function | Emit a named event (stored permanently) |
| `transfer(to, amount)` | function | Transfer SAYM from contract balance |
| `getBalance(address)` | function | Read any address balance |
| `require(condition, msg)` | function | Assert, throw on failure |
| `hash(data)` | function | SHA256 hash of any value |
| `console.log(...)` | function | Debug logging |

### Full contract example:

```javascript
// contracts/MyContract.js

const contract = {
  methods: {

    // Create an item
    create(args) {
      require(args.id,    'ID is required');
      require(args.name,  'Name is required');

      const items = getState('items') || {};
      require(!items[args.id], 'Item already exists');

      items[args.id] = {
        id:        args.id,
        name:      args.name,
        owner:     msg.sender,
        createdAt: blockTimestamp
      };

      setState('items', items);
      emit('ITEM_CREATED', { id: args.id, owner: msg.sender });

      return items[args.id];
    },

    // Transfer ownership
    transfer(args) {
      const items = getState('items') || {};
      require(items[args.id],              'Item not found');
      require(items[args.id].owner === msg.sender, 'Not your item');

      items[args.id].owner = args.to;
      setState('items', items);
      emit('ITEM_TRANSFERRED', { id: args.id, from: msg.sender, to: args.to });
    },

    // Read (no gas for pure reads via SDK)
    getItem(args) {
      return (getState('items') || {})[args.id] || null;
    }

  }
};
```

---

## 🚀 Deploying Contracts from an External Repo

This is the key Phase 9 improvement: **your dApp lives in its own repo** and deploys contracts to SAYMAN exactly like a real blockchain.

### Step 1 — Install the SAYMAN SDK

```bash
# Option A: npm link (local development)
cd sayman-chain/sdk
npm link

cd my-dapp
npm link @sayman/sdk

# Option B: direct install
npm install /path/to/sayman-chain/sdk
```

### Step 2 — Write your deploy script

```javascript
// my-dapp/scripts/deploy.js
import fs from 'fs';
import { SaymanClient } from '@sayman/sdk';

const client = new SaymanClient({ rpcUrl: 'http://localhost:10000' });

const wallet = {
  address:   process.env.DEPLOYER_ADDRESS,
  publicKey: process.env.DEPLOYER_PUBLIC_KEY,
  sign: (hash) => myWallet.sign(hash)
};

const code = fs.readFileSync('./contracts/MyContract.js', 'utf8');

const contractAddress = await client.deployContract({
  name:    'MyContract',
  version: '1.0.0',
  code,
  wallet,
  gasLimit: 200000,
  gasPrice: 1
});

console.log('Deployed at:', contractAddress);
```

### Step 3 — Call your contract

```javascript
// State-changing call
await client.callContract({
  contractAddress,
  method: 'create',
  args:   { id: 'item-1', name: 'My Item' },
  wallet,
  gasLimit: 50000
});

// Read-only state
const item = await client.readState(contractAddress, 'items');
```

### Step 4 — Listen to events

```javascript
const events = await client.getEvents({
  contractAddress,
  eventName: 'ITEM_CREATED',
  limit: 50
});
```

---

## 🏙️ CrowdPulse — Full Demo Walkthrough

CrowdPulse is the first dApp built on SAYMAN. It's in a **completely separate repo** and demonstrates the full contract lifecycle.

### Architecture

```
Citizen App (frontend/index.html)
        ↓
CrowdPulse Backend (backend/index.js)  ← AI verify, REST API, CORS
        ↓
SAYMAN Blockchain (RPC)
        ↓  ↑
  Smart Contracts (on-chain)
   ├── ReportRegistry
   ├── ReputationManager
   └── RewardManager
        ↓
  IPFS (off-chain evidence storage)
```

### Quick Start

#### 1. Start the SAYMAN node

```bash
cd sayman-chain
node server.js --network public-testnet --mode validator
```

Verify it's running:
```bash
curl http://localhost:10000/api/stats
# → { "blocks": 12, "contracts": 0, "stateRoot": "abc..." }
```

#### 2. Deploy CrowdPulse contracts

```bash
cd crowdpulse

# Set your deployer key (or use the dev default)
export DEPLOYER_PRIVATE_KEY=your_private_key_hex

node scripts/deploy.js --network local
```

Expected output:
```
╔══════════════════════════════════════╗
║  CrowdPulse Contract Deployer v1.0   ║
╚══════════════════════════════════════╝

Network:   local
RPC:       http://localhost:10000
Deployer:  1a2b3c4d5e6f...
Balance:   50000 SAYM

Deploying ReportRegistry...    ✅ 7f3a1b2c9d8e...
Deploying ReputationManager... ✅ 4e2b1c0a8f7d...
Deploying RewardManager...     ✅ 9d8c7b6a5e4f...

📄 Manifest saved → crowdpulse/deployed.json
```

#### 3. Start the CrowdPulse backend

```bash
cd crowdpulse/backend
npm install
SAYMAN_RPC=http://localhost:10000 node index.js
# → API: http://localhost:3001
```

#### 4. Open the frontend

```bash
# Just open in browser — no build step needed
open crowdpulse/frontend/index.html
```

### Full Demo Flow (for judges)

**Scenario: Pothole reported on Main Street**

1. **Open frontend** → see live block height ticking
2. **Fill in form**: Category = Road Damage, Severity = High, description
3. **Click "Run AI Verification"** → confidence score appears (e.g. 91%)
4. **Click "Submit to SAYMAN Chain"** → transaction sent
5. **Report appears** in live feed with `OPEN` status
6. **Check Events tab** → `REPORT_CREATED` event visible on-chain
7. **Check SAYMAN explorer** → `GET /api/contracts/{address}/state` shows the report
8. **Authority resolves** (via API) → status changes to `RESOLVED` on-chain
9. **Reporter gains reputation** → `REPUTATION_INCREASED` event appears
10. **State root changes** → every state change is cryptographically committed

### What this proves to judges:

- Smart contracts deployed from a **separate repo** to a **live chain**
- Events emitted by contracts, **queryable via API**
- State changes **permanently recorded** with Merkle proof
- AI + blockchain working together — AI result stored on-chain
- Full lifecycle: submit → verify → resolve → reward

---

## 🌐 New API Routes for Phase 9

Add these to `api/routes.js`:

```javascript
// Contract registry
GET  /api/contracts
GET  /api/contracts/:address
GET  /api/contracts/:address/state
GET  /api/contracts/:address/state/:key
GET  /api/contracts/:address/events

// Events
GET  /api/events?contract=&event=&limit=

// Reputation
GET  /api/reputation/:address

// Native reports
GET  /api/reports?category=&status=&limit=
GET  /api/reports/:id

// Account (needed by SDK)
GET  /api/account/:address   → { balance, nonce, stake, reputation }
```

---

## 🔐 Security Notes

### VM Sandbox
Contracts run inside Node.js `vm.Script` with:
- 5-second execution timeout
- Isolated context — no access to `require`, `process`, `fs`
- Gas metering on every `getState` / `setState` call
- Memory constrained by V8 context isolation

When asked by mentors:
> *"How do you prevent infinite loops?"*

Answer: **Execution timeout (5000ms) + gas limit per transaction. A contract that exceeds either is rejected and its state changes rolled back.**

> *"What if a contract calls `require('fs')`?"*

Answer: **The VM sandbox has no `require`. It throws `ReferenceError: require is not defined`. Only the explicitly injected sandbox globals are available.**

---

## 📦 Transaction Types (Complete List)

| Type | Who sends | Gas | Signature |
|---|---|---|---|
| `GENESIS` | Chain | No | No |
| `REWARD` | Chain | No | No |
| `REWARD_FEE` | Chain | No | No |
| `SLASH` | Chain | No | No |
| `REPUTATION_UPDATE` | Chain | No | No |
| `TRANSFER` | User | Yes | Yes |
| `STAKE` | User | Yes | Yes |
| `UNSTAKE` | User | Yes | Yes |
| `CONTRACT_DEPLOY` | User | Yes | Yes |
| `CONTRACT_CALL` | User | Yes | Yes |
| `CONTRACT_UPGRADE` | User | Yes | Yes |
| `REPORT_CREATE` | User | Yes | Yes |
| `REPORT_VERIFY` | User | Yes | Yes |
| `REPORT_RESOLVE` | User | Yes | Yes |

---

## 🏆 Hackathon Pitch Points

### Why your own blockchain?
> "Ethereum charges $5–50 per transaction for civic reports — unviable for mass adoption. SAYMAN has near-zero fees, native Proof-of-Report transaction types, and a reputation layer built into consensus. This isn't a Solidity port; this is a chain redesigned around civic intelligence."

### Why JavaScript contracts?
> "JavaScript has 20 million developers globally. Solidity has under 50,000. We reduce the barrier for civic developers from 6 months of learning a new language to 0 days. Any JS developer can deploy a dApp on SAYMAN today."

### Why blockchain for reporting?
> "Citizens don't trust authorities. Authorities don't trust citizen data. NGOs don't trust either. Blockchain provides a single, tamper-proof source of truth that no single actor controls. Once a report is submitted, nobody — not even the chain operator — can delete it."

### One-liner:
> "CrowdPulse transforms millions of citizens into a real-time decentralized sensor network, powered by AI verification and secured by the SAYMAN Blockchain — the first chain purpose-built for civic intelligence."

---

## 📸 Snapshot System (Phase 8, still active)

- Saved every 100 blocks to `data/snapshots/`
- Restores in seconds instead of replaying full chain
- Phase 9 adds `reputation` and `eventLog` to snapshot exports

---

## 🔬 State Root (Phase 8+)

Every block includes a `stateRoot` — a Merkle hash of all accounts, contract storage, and reputation scores. This makes every state transition cryptographically provable.

```
Block #1234
  stateRoot: "7f8e9d1234..." ← hash of entire world state
  hash:      "2a3b4c5d..."   ← block hash (includes stateRoot)
```

---

## 🚀 Phase 10 Ideas

- Cross-contract calls (`callContract(address, method, args)` from within a contract)
- Contract upgrade mechanism (proxy pattern)
- ZK proof of report existence (without revealing location)
- Multi-sig authority wallets
- On-chain governance voting for report priorities
- IPFS integration built into node (auto-pin evidence)

---

## ✅ Phase 9 Achievements

- ✅ `msg.sender` fixed — contracts no longer crash
- ✅ Return values captured from contract methods
- ✅ `emit()` event system — permanent, queryable log
- ✅ Contract metadata (name, version, ABI) on-chain
- ✅ Both contract styles supported (new + backward compat)
- ✅ Reputation engine in StateEngine
- ✅ `REPORT_CREATE / VERIFY / RESOLVE` native tx types
- ✅ `REPUTATION_UPDATE` system transaction
- ✅ External dApp SDK (`@sayman/sdk`)
- ✅ CrowdPulse contracts deployable from separate repo
- ✅ Full demo: frontend + backend + contracts + chain
- ✅ `require('crypto')` ESM crash fixed
- ✅ `exportState()` includes reputation + events (snapshots work)
- ✅ `getContractRegistry()` API
- ✅ Backward compatible — all Phase 8 features intact

---

**Phase 9 Complete. SAYMAN is now a full JavaScript smart contract platform. 🎉**