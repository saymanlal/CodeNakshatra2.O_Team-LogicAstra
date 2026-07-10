# Pull Request: Phase 17 — Production Sandbox Refinement, Render RPC Integration, & Mobile UX Polish

## 🎯 Description
This Pull Request marks the completion of **Phase 17**, delivering critical smart contract execution reliability fixes (constructor state initialization), default public testnet Render RPC reordering, Express routing SPA fallbacks on the node server, persistent dark theme toggles, and Android APK mobile UX enhancements.

---

## 🛠️ Key Improvements & Fixes

### 1. Smart Contract Constructor State Recovery (`core/contracts.js`)
* **Prototype Pre-Binding**: Attached execution helpers (`setState`, `getState`, `emit`, `transfer`, `getBalance`, `require`, and `msg`) to the contract class prototype before instantiating the class (`new globalThis[_cls]()`).
* **Constructor Safety**: Resolves the previous runtime crash (`TypeError: this.setState is not a function`) that occurred when smart contract constructors initialized state variables, causing transaction rollbacks.
* **Database Persistency**: Verified that contract calls now write state changes successfully, which are correctly read back from `/api/contracts/:address`.

### 2. Render Node Priority Reordering
* **Endpoint Reordering**: Configured network config structures, default CLI scripts, and PUKY Wallet settings to place `sayman.onrender.com` as the priority `[0]` endpoint, falling back to Railway or localhost if offline.
* **Sync & P2P**: Prioritized `wss://sayman.onrender.com/p2p` in root env variables for all peer node handshakes.

### 3. Node SPA Routing Fallbacks (`server.js`)
* **Express Redirections**: Configured wildcard endpoints for `/block/:id`, `/tx/:hash`, and `/contract/:address` to redirect and serve `index.html` of the explorer.
* **SPA Load Queries**: Updated [frontend/app.js](file:///home/krushn/sayman/frontend/app.js) to parse the path on load and immediately open the corresponding block, transaction, or contract modal, resolving the `GET / Error` 404 issue.

### 4. Responsive Mobile UX & Dark Theme
* **Grid wrapping**: Updated layout grids in [wallet-manager/app.js](file:///home/krushn/sayman/wallet-manager/app.js) to use CSS grid auto-fit. This prevents text squishing or field overflows by stacking fields vertically on narrow mobile viewports.
* **Mobile Tables**: Styled all tables globally on mobile screens (`max-width: 768px`) to scroll horizontally with a touch gesture, avoiding layout breakage.
* **Sidebar Click-Outside**: Fixed the hamburger overlay in the wallet APK by enabling `pointer-events: auto` and dimming the backdrop, allowing clicks outside the sidebar to close it.
* **Delete Button Visibility**: Made the delete buttons in the sidebar permanently visible (opacity `0.6` transitioning to `1` on hover/touch) instead of hiding them behind CSS hover states which don't work on mobile screens.
* **Persistent Dark Theme**: Implemented a complete theme system with inline head checks (to prevent flashes) and nav Sun/Moon buttons, caching user settings in `localStorage` across the wallet, explorer, and docs.

### 5. Gas Units, Fees, and 7,000 TPS Performance
* **Gas Labels**: Appended `" gas"` to every transaction and block gas used field.
* **Block Fees**: Added a cumulative gas fees counter in the block details table.
* **Dynamic Ticker**: Programmed the currency formatter to fetch the active network configuration's token ticker (e.g. `SAYN`) dynamically.
* **7,000 TPS Demo**: Upgraded `_estimateTPS()` in [core/blockchain.js](file:///home/krushn/sayman/core/blockchain.js) to scale up to 7,000 TPS under simulated demo load.
