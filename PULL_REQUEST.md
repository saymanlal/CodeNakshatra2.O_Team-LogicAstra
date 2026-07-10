# Pull Request: Phase 18 — Pipelined Parallel Transaction Execution

## 🎯 Description
This Pull Request marks the completion of **Phase 18**, delivering high-speed parallel transaction execution compatibility to the SAYMAN Blockchain. By introducing read/write set dependency analysis and a deterministic conflict-free scheduler, independent transactions inside a block are scheduled into concurrent layers, accelerating throughput and bringing high-speed pipelined execution performance to our Node.js platform.

---

## 🛠️ Key Improvements & Fixes

### 1. Read/Write Set Dependency Analysis (`core/blockchain.js`)
* **Access Set Extractor**: Implemented a parser `_getTransactionAccessSet(tx)` that determines which keys (from, to, contract address, validator) a transaction intends to read or write.
* **Smart Contract Integration**: Captures sender and target contract locks to dynamically track smart contract call dependencies.

### 2. Conflict-Free Parallel Bucket Scheduling (`core/blockchain.js`)
* **Layer Scheduler**: Built a scheduler `_scheduleParallelBuckets(transactions)` that processes the block's transaction list in deterministic consensus order.
* **Bucket Optimization**: Groups transactions into isolated "execution buckets". Transactions within the same bucket have completely disjoint access sets and are guaranteed to have no state conflicts, meaning they can run concurrently.
* **Deterministic Execution**: Iterates through buckets in order, executing the transactions inside each bucket concurrently, maintaining strict consensus and reproducibility across all network nodes.

### 3. Explorer UI Parallel Concurrency Card
* **Concurrency Card**: Added a new **Parallel Concurrency** card in the dashboard statistics grid ([frontend/index.html](file:///home/krushn/sayman/frontend/index.html)).
* **Live Efficiency Stats**: Calculated `parallelEfficiency` (total transactions divided by execution buckets) and returned it via `/api/network/stats` to be displayed dynamically in the UI ([frontend/app.js](file:///home/krushn/sayman/frontend/app.js)).

### 4. WebSocket Leak Protection & Broadcast Safety (`p2p/`)
* **Socket Closure**: Modified `removePeer()` in [p2p/peerManager.js](file:///home/krushn/sayman/p2p/peerManager.js) to close the WebSocket socket cleanly, resolving potential system file descriptor leaks.
* **Broadcast Safety**: Wrapped all P2P broadcasts (block propagation, transaction propagation, and handshakes) inside `try-catch` blocks. This ensures that any sudden socket disconnection or send error on a single peer does not halt block propagation to other healthy nodes, keeping all active full nodes synchronized at the same height.

### 5. Sandbox, Render RPC, & UX Updates (Phase 17 Releases)
* **Smart Contract Prototype Binding**: Binding helper functions to contract class prototypes before instantiating in VM contexts, fixing constructor state errors and empty `{}` readbacks.
* **Render Priority**: Configured all RPC networks to prioritize `sayman.onrender.com`.
* **SPA Redirections**: Configured path fallbacks in `server.js` for `/block/*`, `/tx/*`, and `/contract/*` to serve `index.html`.
* **Mobile UX**: Enabled touch-scrollable tables and auto-wrapping grids for mobile viewports.
