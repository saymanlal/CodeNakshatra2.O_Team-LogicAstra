// ── Config ───────────────────────────────────────────────────────────────
const ANDROID_APK_URL = 'https://raw.githubusercontent.com/saymanlal/sayman-wallet-manager/main/apk/puky.apk';
const FAUCET_SITE_URL = 'https://sayman-faucet-site.vercel.app/';
const FAUCET_API_URL = 'https://sayman-faucet.onrender.com';
const WALLET_WEB_URL = 'https://sayman-wallet-manager.vercel.app/';
const CHAIN_RPC_URL = 'https://sayman.onrender.com';

// ── Navigation Data ──────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    title: 'Overview',
    links: [
      { id: 'overview', icon: 'fa-home', label: 'Introduction' },
      { id: 'why-sayman', icon: 'fa-question-circle', label: 'Why SAYMAN' },
      { id: 'architecture', icon: 'fa-sitemap', label: 'Architecture' },
      { id: 'roadmap', icon: 'fa-road', label: 'Roadmap' },
      { id: 'faq', icon: 'fa-question', label: 'FAQ' }
    ]
  },
  {
    title: 'Getting Started',
    links: [
      { id: 'install-sdk', icon: 'fa-download', label: 'Install SDK' },
      { id: 'create-wallet', icon: 'fa-wallet', label: 'Create Wallet' },
      { id: 'get-test-tokens', icon: 'fa-tint', label: 'Get Test Tokens' },
      { id: 'deploy-contract-doc', icon: 'fa-file-contract', label: 'Deploy a Contract' },
      { id: 'call-contract', icon: 'fa-phone', label: 'Call a Contract' }
    ]
  },
  {
    title: 'Multi-Layer Chains',
    links: [
      { id: 'layers-overview', icon: 'fa-layer-group', label: 'Layer Overview' },
      { id: 'chain-factory', icon: 'fa-industry', label: 'Chain Factory' },
      { id: 'l2-rollups', icon: 'fa-compress-arrows-alt', label: 'L2 Rollups' },
      { id: 'sidechains', icon: 'fa-code-branch', label: 'Sidechains' }
    ]
  },
  {
    title: 'Token & NFT Factories',
    links: [
      { id: 'token-factory', icon: 'fa-coins', label: 'Token Factory' },
      { id: 'nft-factory', icon: 'fa-image', label: 'NFT Factory' },
      { id: 'memecoin-factory', icon: 'fa-rocket', label: 'Memecoin Factory' }
    ]
  },
  {
    title: 'DeFi Primitives',
    links: [
      { id: 'dex', icon: 'fa-exchange-alt', label: 'DEX' },
      { id: 'staking-pools', icon: 'fa-swimming-pool', label: 'Staking Pools' }
    ]
  },
  {
    title: 'Reputation System',
    links: [
      { id: 'reputation', icon: 'fa-star', label: 'Peer Reputation' }
    ]
  },
  {
    title: 'Build a dApp',
    links: [
      { id: 'dapp-tutorial', icon: 'fa-hammer', label: 'Your First dApp' },
      { id: 'app-ideas', icon: 'fa-lightbulb', label: 'App Ideas' }
    ]
  },
  {
    title: 'Wallet',
    links: [
      { id: 'android-apk', icon: 'fa-android', label: 'Android APK' },
      { id: 'wallet-security', icon: 'fa-shield-alt', label: 'Security' }
    ]
  },
  {
    title: 'SDK',
    links: [
      { id: 'javascript-sdk', icon: 'fa-js', label: 'JavaScript SDK' }
    ]
  },
  {
    title: 'REST API',
    links: [
      { id: 'rest-api', icon: 'fa-code', label: 'REST API Reference' },
      { id: 'broadcast-endpoint', icon: 'fa-paper-plane', label: 'Broadcasting Transactions' }
    ]
  },
  {
    title: 'Smart Contracts',
    links: [
      { id: 'contracts-overview', icon: 'fa-file-contract', label: 'Contract Engine' },
      { id: 'contract-standards', icon: 'fa-list', label: 'Writing Contracts' }
    ]
  },
  {
    title: 'Validators',
    links: [
      { id: 'become-validator', icon: 'fa-user-plus', label: 'Become Validator' },
      { id: 'staking', icon: 'fa-coins', label: 'Staking' }
    ]
  },
  {
    title: 'Tokenomics',
    links: [
      { id: 'token-supply', icon: 'fa-coins', label: 'Token Supply & Gas' }
    ]
  },
  {
    title: 'Hackathon',
    links: [
      { id: 'hackathon-overview', icon: 'fa-trophy', label: 'Overview' },
      { id: 'hackathon-tracks', icon: 'fa-code-branch', label: 'Tracks' },
      { id: 'hackathon-prize', icon: 'fa-award', label: 'Prizes & Perks' }
    ]
  },
  {
    title: 'Downloads',
    links: [
      { id: 'downloads', icon: 'fa-download', label: 'All Downloads' }
    ]
  }
];

// ── Documentation Content Data ──────────────────────────────────────────────
const DOCS_DATA = {

  'overview': {
    title: 'Introduction to SAYMAN',
    content: `
      <div class="docs-hero">
        <h1>SAYMAN Documentation</h1>
        <p class="subtitle">Everything you need to build, validate, deploy and integrate with SAYMAN Blockchain — including multi-layer chains, token factories, NFTs, and DeFi primitives.</p>
        <div class="hero-buttons">
          <a href="${ANDROID_APK_URL}" class="btn btn-primary" download style="background:var(--mono-100);color:var(--mono-1000);border-color:var(--mono-100);"><i class="fab fa-android"></i> Download Wallet APK</a>
          <a href="#install-sdk" class="btn btn-primary" onclick="navigateTo('install-sdk')"><i class="fas fa-rocket"></i> Get Started</a>
          <a href="#layers-overview" class="btn btn-secondary" onclick="navigateTo('layers-overview')"><i class="fas fa-layer-group"></i> Multi-Layer</a>
          <a href="#token-factory" class="btn btn-secondary" onclick="navigateTo('token-factory')"><i class="fas fa-coins"></i> Token Factory</a>
          <a href="#dapp-tutorial" class="btn btn-secondary" onclick="navigateTo('dapp-tutorial')"><i class="fas fa-hammer"></i> Build a dApp</a>
        </div>
      </div>

      <h2>Welcome to SAYMAN Blockchain</h2>
      <p>SAYMAN is a Proof-of-Stake Layer 1 blockchain with a built-in JavaScript smart contract engine, multi-layer chain support (L1/L2/Sidechain), EVM-like token and NFT factories, a DEX, staking pools, a peer reputation system, a REST API, a CLI wallet, a browser-based JS SDK, an Android wallet, and a testnet faucet.</p>

      <div class="note">
        <strong>Phase 20 — now live:</strong> Robust archive recovery, exponential backoff back-up system, pipelined sync blocks check, merge-verification cache safety fixes, dedicated transactions explorer with rewards toggling, and clean client/faucet/sdk separations.
      </div>

      <h3>What works today</h3>
      <ul>
        <li><strong>REST API</strong> — network stats, blocks, transactions, address lookup, validators, contracts, tokens, NFTs, staking pools, broadcast, faucet, mempool, search, gas estimation, denomination guide.</li>
        <li><strong>Multi-layer</strong> — spin up L2 rollups, sidechains, or permissioned chains via <code>core/chain-factory.js</code>.</li>
        <li><strong>Token Factory</strong> — deploy custom fungible tokens via <code>contracts/token-factory.js</code>.</li>
        <li><strong>NFT Factory</strong> — deploy collections and mint NFTs via <code>contracts/nft-factory.js</code>.</li>
        <li><strong>Memecoin Factory</strong> — one-click memecoin deployment via <code>contracts/memecoin-factory.js</code>.</li>
        <li><strong>DEX</strong> — on-chain AMM swap contract via <code>contracts/dex.js</code>.</li>
        <li><strong>Staking Pools</strong> — delegate-and-earn pools via <code>contracts/staking-pool.js</code>.</li>
        <li><strong>Reputation</strong> — peers earn points for contributing valid blocks; query via <code>GET /api/reputation/:address</code>.</li>
        <li><strong>CLI wallet</strong> (<code>cli/sayman-cli.js</code>) — create/import wallet, balance, send, stake, unstake, list validators.</li>
        <li><strong>Android wallet</strong> — Capacitor APK, see Android APK page.</li>
        <li><strong>Web wallet</strong> — <a href="${WALLET_WEB_URL}" target="_blank">${WALLET_WEB_URL}</a></li>
        <li><strong>Faucet</strong> — <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a></li>
      </ul>

      <h3>Denomination — no confusion</h3>
      <p>All on-chain amounts are integers in <strong>base units</strong>. Divide by <strong>100,000,000</strong> to get SAYN. The API exposes a <code>GET /api/denomination</code> endpoint and every balance/amount field in the explorer is labeled clearly.</p>
    `
  },

  'why-sayman': {
    title: 'Why SAYMAN',
    content: `
      <h2>Why SAYMAN Blockchain?</h2>
      <p>SAYMAN is a Proof-of-Stake chain with a JS-native contract model: contracts are plain JavaScript objects/classes executed in a sandboxed VM, not EVM bytecode. With Phase 14 it now supports a full multi-layer ecosystem — anyone can spawn an L2, sidechain, or permissioned chain, deploy their own tokens and NFTs, and run a DEX or staking pool, all in JavaScript.</p>

      <h3>Key Differentiators</h3>
      <ul>
        <li><strong>JS-native contracts:</strong> write contracts in JavaScript — no Solidity, no new language to learn.</li>
        <li><strong>Multi-layer architecture:</strong> L1 base chain, L2 rollups (<code>core/rollup.js</code>), sidechains and permissioned chains (<code>core/chain-factory.js</code>) — all configurable.</li>
        <li><strong>Token &amp; NFT factories:</strong> deploy fungible tokens, NFT collections, or memecoins with a single contract call — no custom code required.</li>
        <li><strong>Built-in DeFi:</strong> AMM DEX and staking pool contracts ship out of the box.</li>
        <li><strong>Peer reputation:</strong> nodes that contribute valid blocks accumulate reputation — discoverable on-chain and via the API.</li>
        <li><strong>Configurable fee policy:</strong> <code>user</code>-pays, <code>sponsor</code>-pays, or <code>free</code> — abstract gas away from end users.</li>
        <li><strong>Merkle state proofs:</strong> every account is committed to a Merkle root; query proofs via <code>GET /api/proof/:address</code>.</li>
        <li><strong>High TPS:</strong> optimistic batch processing in rollup mode pushes throughput well beyond the base-chain block time.</li>
        <li><strong>Clear denomination:</strong> 1 SAYN = 100,000,000 base units — always labeled in the explorer, API, and docs.</li>
      </ul>
    `
  },

  'architecture': {
    title: 'Architecture',
    content: `
      <h2>Repository Architecture</h2>
      <p>SAYMAN is a single Node.js monorepo. The chain, API, CLI, SDK and frontend all live together; the faucet is the one piece that runs as an independent deployed service.</p>

      <h3>Core chain (<code>core/</code>)</h3>
      <ul>
        <li><code>blockchain.js</code> — top-level chain orchestration and block production loop</li>
        <li><code>block.js</code> / <code>transaction.js</code> — block and transaction data structures + hashing</li>
        <li><code>state.js</code> / <code>stateTree.js</code> / <code>merkle.js</code> — account/contract state and Merkle commitments</li>
        <li><code>pos.js</code> — validator selection / proof-of-stake logic</li>
        <li><code>gas.js</code> — gas cost calculation per transaction type</li>
        <li><code>nonce.js</code> — per-address nonce tracking (replay protection, mempool ordering)</li>
        <li><code>contracts.js</code> — the sandboxed VM contract execution engine</li>
        <li><code>chain-factory.js</code> — <strong>Phase 14</strong>: spawn L2 rollup, sidechain, and permissioned chain instances</li>
        <li><code>rollup.js</code> — <strong>Phase 14</strong>: optimistic rollup sequencer and batch-commit logic</li>
      </ul>

      <h3>Contract Templates (<code>contracts/</code>)</h3>
      <ul>
        <li><code>token.js</code> — reference fungible token contract</li>
        <li><code>token-factory.js</code> — <strong>Phase 14</strong>: deploy any custom ERC-20-style token in one call</li>
        <li><code>nft.js</code> — reference NFT contract</li>
        <li><code>nft-factory.js</code> — <strong>Phase 14</strong>: deploy NFT collections and mint tokens</li>
        <li><code>memecoin-factory.js</code> — <strong>Phase 14</strong>: one-click memecoin deployment</li>
        <li><code>dex.js</code> — <strong>Phase 14</strong>: AMM DEX with add/remove liquidity and swap</li>
        <li><code>staking-pool.js</code> — <strong>Phase 14</strong>: delegate-and-earn staking pool</li>
        <li><code>layer2Bridge.js</code> — <strong>Phase 14</strong>: L1 ↔ L2 asset bridge contract</li>
      </ul>

      <h3>Networking</h3>
      <ul>
        <li><code>api/routes.js</code> — REST API including new <code>/tokens</code>, <code>/nfts</code>, <code>/staking-pools</code>, <code>/reputation/:address</code>, <code>/denomination</code> endpoints</li>
        <li><code>p2p/server.js</code> — block/tx gossip; now awards reputation points to peers providing valid blocks</li>
        <li><code>config/*.js</code> — network configs now include <code>layer</code>, <code>maxTps</code>, <code>rollupBatchSize</code>, and <code>l2Enabled</code> fields</li>
      </ul>

      <h3>Clients</h3>
      <ul>
        <li><code>cli/</code> — <code>sayman-cli.js</code> + <code>wallet-cli.js</code></li>
        <li><code>sdk/</code> — <code>client.js</code> REST wrapper</li>
        <li><code>frontend/</code> — explorer + docs site (now includes Layers page and denomination labels)</li>
        <li><code>wallet-manager/</code> — Capacitor Android wallet APK</li>
      </ul>

      <h3>Standalone services</h3>
      <ul>
        <li><code>faucet/</code> — deployed at <a href="${FAUCET_API_URL}" target="_blank">${FAUCET_API_URL}</a></li>
        <li><code>faucet-site/</code> — deployed at <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a></li>
        <li><code>apk/puky.apk</code> — Android wallet binary at <code>/apk/puky.apk</code></li>
      </ul>

      <div class="note">
        <strong>Entry point:</strong> <code>server.js</code> boots the chain, mounts <code>frontend/</code> as the static web root, mounts <code>apk/</code>, and calls <code>setupRoutes()</code> from <code>api/routes.js</code>.
      </div>
    `
  },

  'roadmap': {
    title: 'Roadmap',
    content: `
      <h2>Roadmap</h2>
      <div class="note">
        <strong>Phase 20 — complete:</strong> Robust archive recovery, concurrency-safe client locking, exponential backoff, synced block check guards, and a dedicated transactions explorer with filter options.
      </div>
      <ul>
        <li><strong>Phase 1–13 (done):</strong> Core PoS chain, JS contract engine, REST API, CLI, SDK, Android wallet, faucet, Merkle proofs, gas metering, public testnet.</li>
        <li><strong>Phase 14-19 (done):</strong> L2 rollups, sidechains, factories, DEX, L1↔L2 bridge, peer reputation, pipelined parallel transaction execution.</li>
        <li><strong>Phase 20 (done):</strong> Robust archive recovery, concurrency-safe writer lock, exponential retry backoff, syncing block checks, cache safety fixes, complete transactions explorer, and repo separations.</li>
        <li><strong>Later:</strong> Mainnet launch — 100,000,000 SAYN hard cap, Bitcoin-style halving block rewards. Exact date TBD.</li>
      </ul>
    `
  },

  'faq': {
    title: 'FAQ',
    content: `
      <h2>Frequently Asked Questions</h2>

      <h3>Is SAYMAN EVM-compatible?</h3>
      <p>No. Contracts run as plain JavaScript inside a sandboxed Node <code>vm</code> context, not EVM bytecode. Solidity contracts won't run as-is — see Writing Contracts to port the logic over. However, the token/NFT/DEX factories provide EVM-like primitives without needing Solidity.</p>

      <h3>What language do I write contracts in?</h3>
      <p>JavaScript, using only the globals listed on the Contract Engine page. Anything outside that list is undefined inside the sandbox.</p>

      <h3>How do I get test tokens?</h3>
      <p>Use the faucet UI at <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a>, or call <code>POST /api/faucet</code> directly.</p>

      <h3>What is 1 SAYN in base units?</h3>
      <p>1 SAYN = <strong>100,000,000 base units</strong> (8 decimal places). All on-chain amounts are integers. Divide by 100,000,000 to get SAYN. Call <code>GET /api/denomination</code> for a complete conversion table.</p>

      <h3>Can I launch my own token or NFT?</h3>
      <p>Yes — Phase 14 adds a token factory, NFT factory, and memecoin factory. Deploy a custom token or collection with a single contract call — no contract code required. See Token Factory and NFT Factory in the sidebar.</p>

      <h3>Can I run my own chain on top of SAYMAN?</h3>
      <p>Yes — use <code>core/chain-factory.js</code> to spawn an L2 rollup, sidechain, or permissioned chain with custom block time, gas limits, and validators. Assets cross between chains via the <code>layer2Bridge</code> contract.</p>

      <h3>Is there a DEX?</h3>
      <p>Yes — <code>contracts/dex.js</code> is a constant-product AMM. Add liquidity, swap tokens, and read pool reserves without any additional infrastructure.</p>

      <h3>What is peer reputation?</h3>
      <p>Peers that supply valid blocks to the network earn +10 reputation points per block. Query any address's score via <code>GET /api/reputation/:address</code>. Validators show their reputation in <code>GET /api/validators</code>.</p>

      <h3>How much does it cost to deploy or call a contract?</h3>
      <p>Deploy: 200,000 gas base + 1 gas per 10 bytes of source. Calls: 50,000 gas base + 500 per storage read + 2,000 per storage write. See Token Supply &amp; Gas for gas price by network.</p>

      <h3>Can I make my dApp free for end users?</h3>
      <p>Yes — deploy with <code>feePolicy: 'sponsor'</code> or <code>feePolicy: 'free'</code>. See Contract Engine → Fee policies.</p>
    `
  },

  'install-sdk': {
    title: 'Install SDK',
    content: `
      <h2>Install SAYMAN SDK</h2>
      <p>The JS SDK lives in <code>sdk/</code> in this repo and is consumed as a local package or a published npm package.</p>

      <h3>From this repo (recommended right now)</h3>
      <pre><code>npm install /path/to/sayman/sdk</code></pre>

      <h3>If published to npm</h3>
      <pre><code>npm install @sayman/sdk</code></pre>

      <h3>CLI wallet</h3>
      <pre><code>cd cli
npm install
npm link
sayman wallet create</code></pre>

      <div class="tip">
        <strong>Tip:</strong> the CLI defaults to <code>${CHAIN_RPC_URL}/api</code>. Point it elsewhere with <code>sayman config https://your-host/api</code> or the <code>SAYMAN_API</code> env var.
      </div>
    `
  },

  'create-wallet': {
    title: 'Create Wallet',
    content: `
      <h2>Create a Wallet</h2>

      <h3>Using the JavaScript SDK</h3>
      <pre><code>import { SaymanWalletCLI } from '@sayman/sdk/wallet'; // or reuse cli/wallet-cli.js directly

const wallet = new SaymanWalletCLI();
await wallet.initialize();
console.log(wallet.address, wallet.privateKey);</code></pre>

      <h3>Using the CLI</h3>
      <pre><code>sayman wallet create</code></pre>

      <h3>Using the Android app or web wallet</h3>
      <p>Install the <a href="#android-apk" onclick="navigateTo('android-apk')">Android APK</a> or open <a href="${WALLET_WEB_URL}" target="_blank">${WALLET_WEB_URL}</a> and tap "Create Wallet" on first launch — same secp256k1 keypair generation under the hood as the CLI/SDK.</p>

      <div class="warning">
        <strong>Important:</strong> back up your private key. There is no recovery mechanism — <code>deriveAddress()</code> is a one-way SHA-256 hash of the public key.
      </div>
    `
  },

  'get-test-tokens': {
    title: 'Get Test Tokens',
    content: `
      <h2>Get Test Tokens (SAYN)</h2>
      <p>The faucet is enabled on testnet configs (<code>faucetEnabled: true</code>) and disabled on mainnet.</p>

      <h3>Easiest: use the faucet website</h3>
      <p>Go to <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a>, paste your address, and submit. This talks to the standalone faucet service at <a href="${FAUCET_API_URL}" target="_blank">${FAUCET_API_URL}</a>.</p>

      <h3>Via the chain's built-in faucet route</h3>
      <pre><code>curl -X POST ${CHAIN_RPC_URL}/api/faucet \\
  -H "Content-Type: application/json" \\
  -d '{"address":"YOUR_ADDRESS"}'</code></pre>
      <p>This queues a TRANSFER into the mempool — tokens land once the next block is produced, they are not instant.</p>

      <div class="tip">
        <strong>Amount:</strong> testnet faucet drips <code>10,000,000</code> base units (1000 SAYN) per request, subject to the faucet's own balance.
      </div>

      <div class="note">
        <strong>Two separate faucets exist:</strong> the standalone <code>faucet/</code> service (fronted by the faucet website) and the built-in <code>POST /api/faucet</code> route on the chain itself. Either gets you testnet SAYN — use whichever is more convenient.
      </div>
    `
  },

  'deploy-contract-doc': {
    title: 'Deploy a Contract — Full Walkthrough',
    content: `
      <h2>Deploying Your First Contract</h2>
      <p>End-to-end: write a contract, create a wallet, fund it, sign, and broadcast a <code>CONTRACT_DEPLOY</code> transaction.</p>

      <h3>Step 1 — Write the contract</h3>
      <pre><code>// counter.js
const contract = {
  methods: {
    increment(_args) {
      const count = (getState('count') || 0) + 1;
      setState('count', count);
      emit('COUNT_CHANGED', { count, by: msg.sender });
      return count;
    },
    getCount(_args) {
      return getState('count') || 0;
    }
  }
};</code></pre>
      <p>Only use the globals listed in Contract Engine → Globals. Anything else throws at <em>call</em> time, not deploy time.</p>

      <h3>Step 2 — Create a wallet</h3>
      <pre><code>import { SaymanWalletCLI } from '@sayman/sdk/wallet';
const wallet = new SaymanWalletCLI();
await wallet.initialize();</code></pre>

      <h3>Step 3 — Fund it</h3>
      <p>Send your new address to the faucet at <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a>. Deploy costs gas, so you need a nonzero balance first.</p>

      <h3>Step 4 — Deploy</h3>
      <pre><code>import { SaymanClient } from '@sayman/sdk';
import fs from 'fs';

const client = new SaymanClient({ rpcUrl: '${CHAIN_RPC_URL}' });
const code = fs.readFileSync('./counter.js', 'utf8');

const result = await client.deployContract({
  name: 'Counter',
  version: '1.0.0',
  code,
  feePolicy: 'user',
  wallet
});
console.log('Deploy tx:', result.txId);</code></pre>

      <h3>Step 5 — Confirm it landed</h3>
      <p>Poll the registry until your contract shows up — a broadcast only queues the tx in the mempool, it doesn't guarantee inclusion until the next block is produced:</p>
      <pre><code>const registry = await client.getContractRegistry();
const mine = registry.find(c => c.name === 'Counter');
console.log(mine?.address);</code></pre>

      <div class="tip">
        <strong>Or use the CLI</strong> if you'd rather not write a script: <code>sayman contract deploy ./counter.js --name Counter</code> (see <code>cli/sayman-cli.js --help</code> for exact flags).
      </div>
    `
  },

  'call-contract': {
    title: 'Call a Contract',
    content: `
      <h2>Calling a Deployed Contract</h2>

      <h3>State-changing call (goes through consensus)</h3>
      <pre><code>const result = await client.callContract({
  contractAddress,
  method: 'increment',
  args: {},
  wallet
});
console.log(result.txId);</code></pre>
      <p>Like any transaction, this is queued to the mempool and only takes effect once mined into a block.</p>

      <h3>Reading state (no transaction, no gas)</h3>
      <pre><code>const count = await client.readState(contractAddress, 'count');
console.log(count);</code></pre>
      <p>There's no dedicated per-key state route on the server — <code>readState()</code> fetches the whole contract object via <code>GET /api/contracts/:address</code> and reads the key client-side. Fine for small state; for large state objects, consider structuring your contract so related fields live under fewer keys.</p>

      <h3>Listening for effects</h3>
      <p>There is no live events/websocket API. To observe an <code>emit(...)</code> call's result, re-fetch the contract's state after your tx is confirmed and check the field it wrote.</p>
    `
  },

  'dapp-tutorial': {
    title: 'Build Your First dApp',
    content: `
      <h2>Build Your First dApp on SAYMAN</h2>
      <p>A dApp on SAYMAN is just three pieces working together: a JS contract deployed on-chain, a wallet that signs transactions, and a frontend that calls the SDK. Here's a complete minimal example — a public message board.</p>

      <h3>1. The contract</h3>
      <pre><code>// board.js
const contract = {
  methods: {
    postMessage(args) {
      require(args.text && args.text.length <= 280, 'text required, max 280 chars');

      const nextId = (getState('nextId') || 0) + 1;
      setState('nextId', nextId);
      setState('msg:' + nextId, {
        id: nextId,
        author: msg.sender,
        text: args.text,
        timestamp: blockTimestamp
      });

      emit('MESSAGE_POSTED', { id: nextId, author: msg.sender });
      return nextId;
    },

    getMessage(args) {
      return getState('msg:' + args.id) || null;
    },

    getMessageCount(_args) {
      return getState('nextId') || 0;
    }
  }
};</code></pre>

      <h3>2. Deploy it</h3>
      <pre><code>const result = await client.deployContract({
  name: 'MessageBoard',
  version: '1.0.0',
  code: fs.readFileSync('./board.js', 'utf8'),
  feePolicy: 'sponsor',   // you pay gas so users don't have to
  wallet
});</code></pre>

      <h3>3. Post a message from the frontend</h3>
      <pre><code>async function post(text) {
  const result = await client.callContract({
    contractAddress: BOARD_ADDRESS,
    method: 'postMessage',
    args: { text },
    wallet: userWallet
  });
  return result.txId;
}</code></pre>

      <h3>4. Render messages</h3>
      <pre><code>async function loadMessages() {
  const count = await client.readState(BOARD_ADDRESS, 'nextId') || 0;
  const messages = [];
  for (let i = 1; i <= count; i++) {
    const m = await client.readState(BOARD_ADDRESS, 'msg:' + i);
    if (m) messages.push(m);
  }
  return messages;
}</code></pre>

      <div class="note">
        <strong>That's the whole pattern.</strong> Every dApp on SAYMAN — token, voting system, marketplace, registry — is this same loop: write state through a method call, read state back for display. Complexity comes from what you store and validate, not from new chain concepts.
      </div>

      <div class="tip">
        <strong>Ship it:</strong> host your frontend anywhere (Vercel, Render, even a static <code>index.html</code>), point it at <code>${CHAIN_RPC_URL}</code>, and you have a working dApp with no backend of your own required — the chain is your backend.
      </div>
    `
  },

  'app-ideas': {
    title: 'App Ideas',
    content: `
      <h2>dApp Ideas on SAYMAN (Phase 14 Edition)</h2>
      <p>These ideas leverage SAYMAN's new Phase 14 primitives — factories, DEX, staking pools, and multi-layer chains — alongside the core <code>getState</code>/<code>setState</code>/<code>emit</code>/<code>require</code> model.</p>

      <h3>1. Launch your own token in seconds</h3>
      <p>Call the <code>token-factory</code> contract's <code>createToken</code> method with a name, symbol, supply, and decimals. Your token is live on-chain instantly — no contract code to write. Use <code>GET /api/tokens</code> to discover all tokens deployed via the factory.</p>

      <h3>2. NFT collection &amp; marketplace</h3>
      <p>Deploy a collection via <code>nft-factory</code>, then mint items with metadata URIs. Build a frontend that reads <code>GET /api/nfts</code> to list all collections and renders individual NFT cards. Wire a buy/sell flow through an escrow contract that calls <code>transfer()</code> on the NFT contract.</p>

      <h3>3. Memecoin launchpad</h3>
      <p>Use <code>memecoin-factory</code> to let users create a memecoin with a funny name and icon URL in one transaction. Pair it with the built-in DEX to list it immediately — liquidity providers can add SAYN/MEME pairs via <code>addLiquidity</code>.</p>

      <h3>4. AMM DEX frontend</h3>
      <p>The <code>dex</code> contract implements constant-product AMM (x·y=k). Build a swap UI that calls <code>swap(tokenIn, amountIn, tokenOut, minAmountOut)</code> and shows live pool reserves from <code>getState('pool:tokenA:tokenB')</code>.</p>

      <h3>5. Staking pool dashboard</h3>
      <p>Deploy a <code>staking-pool</code> contract, then build a dashboard that shows TVL, APR (computed from <code>operatorFee</code> and <code>totalDelegated</code>), and lets users delegate SAYN to earn rewards. Discover all pools via <code>GET /api/staking-pools</code>.</p>

      <h3>6. L2 app-chain</h3>
      <p>Use <code>core/chain-factory.js</code> to spin up a sidechain or L2 rollup with custom gas and block-time params. Deploy your own set of contracts on it, bridge assets via <code>layer2Bridge</code>, and keep the L1 as the settlement layer.</p>

      <h3>7. Community voting / governance</h3>
      <p>Store proposals under <code>proposal:id</code>, votes under <code>vote:proposalId:voterAddress</code> to prevent double-voting. Gate privileged actions (e.g., treasury spend) on a passing vote — enforced by <code>require()</code> in the spending contract.</p>

      <div class="warning">
        <strong>Security note:</strong> always validate <code>msg.sender</code> against a stored owner/admin before privileged actions, use <code>require()</code> to reject bad input early, and never rely on block-timestamp randomness for high-value decisions.
      </div>
    `
  },

  'javascript-sdk': {
    title: 'JavaScript SDK',
    content: `
      <h2>JavaScript SDK</h2>
      <p>Thin fetch-based client around the REST API in <code>api/routes.js</code>. This documents the corrected client — the original shipped version called routes that don't exist on the server.</p>

      <h3>Setup</h3>
      <pre><code>import { SaymanClient } from '@sayman/sdk';

const client = new SaymanClient({ rpcUrl: '${CHAIN_RPC_URL}' });</code></pre>

      <h3>Reading chain data</h3>
      <pre><code>const account = await client.getAccount(address);   // GET /api/address/:address
const stats   = await client.getNetworkStats();      // GET /api/stats
const block   = await client.getBlock(42);           // GET /api/block/:index</code></pre>

      <h3>Sending a transfer</h3>
      <pre><code>const result = await client.transfer({
  to: '0xrecipient...',
  amount: 5_0000,     // base units (1 SAYN = 10,000 base units)
  wallet                // { address, publicKey, sign(hash) }
});
console.log(result.txId);</code></pre>

      <h3>Deploying a contract</h3>
      <pre><code>const result = await client.deployContract({
  name: 'Counter',
  version: '1.0.0',
  code: counterContractSource,   // string — see Build a dApp
  feePolicy: 'user',
  wallet
});</code></pre>

      <h3>Calling a contract</h3>
      <pre><code>const result = await client.callContract({
  contractAddress,
  method: 'increment',
  args: {},
  wallet
});</code></pre>

      <h3>Full method list</h3>
      <ul>
        <li><code>getNonce(address)</code> / <code>getBalance(address)</code> / <code>getAccount(address)</code></li>
        <li><code>deployContract({ name, version, code, abi, feePolicy, wallet, gasLimit, gasPrice })</code></li>
        <li><code>callContract({ contractAddress, method, args, wallet, gasLimit, gasPrice })</code></li>
        <li><code>transfer({ to, amount, wallet, gasLimit, gasPrice })</code></li>
        <li><code>readState(contractAddress, key)</code> / <code>readAllState(contractAddress)</code></li>
        <li><code>getContractRegistry()</code> / <code>getContract(contractAddress)</code></li>
        <li><code>getNetworkStats()</code> / <code>getBlock(index)</code> / <code>getValidators()</code></li>
      </ul>

      <div class="note">
        <strong>Every write goes through <code>POST /api/broadcast</code>.</strong> TRANSFER, STAKE, UNSTAKE, CONTRACT_DEPLOY, and CONTRACT_CALL are all just different <code>type</code> values on the same broadcast payload — there's no separate endpoint per action.
      </div>

      <div class="warning">
        <strong>Not implemented server-side:</strong> per-key contract state routes, an events API, and a reputation API. <code>readState()</code> works around the first by fetching the whole contract object and reading the key client-side.
      </div>
    `
  },

  'rest-api': {
    title: 'REST API Reference',
    content: `
      <h2>REST API</h2>
      <p>Base path <code>/api</code> on <code>${CHAIN_RPC_URL}</code>. This list reflects the routes actually registered in <code>api/routes.js</code> — nothing here is aspirational.</p>

      <h3>Read endpoints</h3>
      <ul>
        <li><code>GET /api/network</code> — network name, chain ID, layer, gas costs, denomination guide, faucet status</li>
        <li><code>GET /api/stats</code> — chain stats (blocks, validators, mempool, state root)</li>
        <li><code>GET /api/network/stats</code> — stats + p2p peer info + uptime</li>
        <li><code>GET /api/network/peers</code> — connected peer list</li>
        <li><code>GET /api/blocks?page=&amp;limit=</code> — paginated block list</li>
        <li><code>GET /api/block/:index</code> — single block by height</li>
        <li><code>GET /api/block/hash/:hash</code> — single block by hash (prefix match)</li>
        <li><code>GET /api/light/block/:height</code> — block header only</li>
        <li><code>GET /api/transactions/:id</code> — single transaction by id</li>
        <li><code>GET /api/address/:address</code> — balance, stake, nonce, reputation, unstaking status, full tx history</li>
        <li><code>GET /api/balance/:address</code> — lighter version (no tx history)</li>
        <li><code>GET /api/validators</code> — validator set with stake %, reputation, estimated APR</li>
        <li><code>GET /api/reputation/:address</code> — <strong>Phase 14</strong>: peer reputation score</li>
        <li><code>GET /api/contracts</code> — full contract registry</li>
        <li><code>GET /api/contracts/:address</code> — one contract including its state object</li>
        <li><code>GET /api/tokens</code> — <strong>Phase 14</strong>: all tokens deployed via token-factory / memecoin-factory</li>
        <li><code>GET /api/nfts</code> — <strong>Phase 14</strong>: all NFT collections deployed via nft-factory</li>
        <li><code>GET /api/staking-pools</code> — <strong>Phase 14</strong>: all staking pool contracts</li>
        <li><code>GET /api/denomination</code> — <strong>Phase 14</strong>: SAYN ↔ base-unit conversion guide with examples</li>
        <li><code>GET /api/tps</code> — <strong>Phase 14</strong>: live TPS estimate with denomination info</li>
        <li><code>GET /api/mempool</code> — pending transactions</li>
        <li><code>GET /api/search/:query</code> — block index/hash, tx id, or address</li>
        <li><code>GET /api/proof/:address</code> — Merkle proof for an account</li>
      </ul>

      <h3>Write endpoints</h3>
      <ul>
        <li><code>POST /api/broadcast</code> — submit a signed transaction (all tx types)</li>
        <li><code>POST /api/faucet</code> — testnet only, queues a TRANSFER from the faucet account</li>
        <li><code>POST /api/proof/verify</code> — verify a Merkle proof against a state root</li>
        <li><code>POST /api/estimate-gas</code> — estimate gas for a <code>{type, data}</code> payload</li>
        <li><code>POST /api/admin/fund</code> — testnet-only, secret-gated manual funding (not for production use)</li>
      </ul>

      <div class="note">
        <strong>Separate faucet service:</strong> <a href="${FAUCET_API_URL}" target="_blank">${FAUCET_API_URL}</a> is its own deployment (<code>faucet/server.js</code>), not part of this route list. Its exact endpoint shape isn't documented here yet — check that service's source directly if you need to call it programmatically rather than through <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a>.
      </div>
    `
  },

  'broadcast-endpoint': {
    title: 'Broadcasting Transactions',
    content: `
      <h2>POST /api/broadcast</h2>
      <p>Every state-changing action — transfers, staking, contract deploys, contract calls — goes through this one endpoint. The server distinguishes them by <code>type</code>.</p>

      <h3>Required fields</h3>
      <pre><code>{
  "type": "TRANSFER",
  "data": { "from": "...", "to": "...", "amount": 50000 },
  "timestamp": 1720000000000,
  "signature": { "r": "...", "s": "..." },
  "publicKey": "...",
  "gasLimit": 21000,
  "gasPrice": 1,
  "nonce": 3
}</code></pre>

      <p>The server independently re-derives your address from <code>publicKey</code> (SHA-256, first 40 hex chars) and rejects the request if it doesn't match <code>data.from</code>, then verifies the ECDSA signature over the same hash your wallet signed.</p>

      <h3>Transaction types</h3>
      <ul>
        <li><code>TRANSFER</code> — <code>{ from, to, amount }</code></li>
        <li><code>STAKE</code> — <code>{ from, amount }</code></li>
        <li><code>UNSTAKE</code> — <code>{ from, amount }</code></li>
        <li><code>CONTRACT_DEPLOY</code> — <code>{ from, name, version, abi, feePolicy, code }</code></li>
        <li><code>CONTRACT_CALL</code> — <code>{ from, contractAddress, method, args }</code></li>
      </ul>

      <div class="note">
        <strong>Hash must match exactly</strong> across <code>core/transaction.js</code>, <code>cli/wallet-cli.js</code>, and the SDK: it's a SHA-256 over <code>{type, timestamp, data, gasLimit, gasPrice, nonce}</code> as JSON, in that key order. If any client hashes a different field set, signatures will fail server-side verification.
      </div>
    `
  },

  'contracts-overview': {
    title: 'Contract Engine',
    content: `
      <h2>Smart Contract Engine</h2>
      <p><code>core/contracts.js</code> runs contracts inside Node's <code>vm</code> module — a real sandbox, not an EVM interpreter. Any contract expressible as JavaScript logic can be deployed: counters, tokens, registries, voting, escrow, oracles, games — as long as it fits the sandbox's available globals below.</p>

      <h3>Supported contract shapes</h3>
      <ul>
        <li><strong>Style A — class:</strong> <code>class MyContract { method(args) {...} }</code></li>
        <li><strong>Style B — object:</strong> <code>const contract = { methods: { method(args) {...} } }</code></li>
        <li><strong>Style C — flat functions:</strong> <code>function method(args) {...}</code></li>
      </ul>

      <h3>Globals available inside a contract call</h3>
      <p>These are the <em>only</em> identifiers the sandbox injects — anything else (like a bare <code>caller</code> or bare <code>state</code>) is undefined and will throw:</p>
      <ul>
        <li><code>msg.sender</code> / <code>msg.caller</code> — caller's address</li>
        <li><code>args</code> — arguments passed to the call</li>
        <li><code>blockTimestamp</code></li>
        <li><code>getState(key)</code> / <code>setState(key, value)</code> — persistent per-contract storage</li>
        <li><code>getBalance(address)</code> / <code>transfer(to, amount)</code></li>
        <li><code>emit(eventName, data)</code></li>
        <li><code>require(condition, message)</code></li>
        <li><code>hash(data)</code> / <code>generateAddress(seed)</code></li>
      </ul>

      <h3>Fee policies</h3>
      <ul>
        <li><code>user</code> (default) — caller pays gas</li>
        <li><code>sponsor</code> — paid from the deployer's sponsor balance (top up via <code>topUpSponsorBalance</code>)</li>
        <li><code>free</code> — no gas charged (internal/testnet apps)</li>
      </ul>

      <div class="warning">
        <strong>Gas limits:</strong> deploy costs <code>200,000</code> gas + 1 gas per 10 bytes of source. Calls cost a <code>50,000</code> base + storage reads (500 gas) and writes (2,000 gas). Execution is killed after <code>maxExecutionTime</code> (5s by default).
      </div>
    `
  },

  'contract-standards': {
    title: 'Writing Contracts',
    content: `
      <h2>Writing a Contract</h2>
      <p>Two working reference contracts ship in <code>contracts/</code>. Both had the same class of bug — referencing globals the sandbox doesn't provide — and have been corrected.</p>

      <h3>Counter (object style)</h3>
      <pre><code>const contract = {
  methods: {
    increment(_args) {
      const count = (getState('count') || 0) + 1;
      setState('count', count);
      emit('COUNT_CHANGED', { count, action: 'increment', by: msg.sender });
      return count;
    },
    getCount(_args) {
      return getState('count') || 0;
    }
  }
};</code></pre>

      <h3>Token (object style)</h3>
      <pre><code>const contract = {
  methods: {
    mint(args) {
      const owner = getState('owner');
      require(msg.sender === owner || !owner, 'Only owner can mint');
      const balances = getState('balances') || {};
      balances[args.to] = (balances[args.to] || 0) + args.amount;
      setState('balances', balances);
      emit('MINT', { to: args.to, amount: args.amount });
    }
  }
};</code></pre>

      <div class="tip">
        <strong>Rule of thumb:</strong> if you need a value to persist between calls — including something like an "owner" address — it must live behind <code>getState</code>/<code>setState</code>. There is no ambient <code>state</code> object and no bare <code>caller</code>; use <code>msg.sender</code>.
      </div>
    `
  },

  'become-validator': {
    title: 'Become a Validator',
    content: `
      <h2>Becoming a Validator</h2>
      <p>Validators are selected via proof-of-stake (<code>core/pos.js</code>) — stake weight determines block-production odds.</p>

      <h3>Steps</h3>
      <ol>
        <li>Create a wallet and fund it above the network's minimum stake (see Staking / Token Supply & Gas for exact amounts).</li>
        <li>Broadcast a <code>STAKE</code> transaction for at least the minimum amount.</li>
        <li>Run a node in <code>validator</code> mode: <code>node server.js --network public-testnet --mode validator</code>.</li>
        <li>Confirm your node appears in <code>GET /api/validators</code>.</li>
      </ol>

      <div class="note">
        Running as <code>--mode full</code> instead of <code>validator</code> lets you sync and serve the API/P2P without producing blocks — useful for running your own read replica.
      </div>
    `
  },

  'staking': {
    title: 'Staking',
    content: `
      <h2>Staking SAYN</h2>

      <h3>Stake</h3>
      <pre><code>const result = await client._broadcast === undefined ? null : null;
// via a STAKE-type broadcast (add a stake() helper to the SDK, or use the CLI):
sayman stake 1000000000   // testnet: 1,000,000,000 base units = 10 SAYN minimum</code></pre>

      <h3>Unstake</h3>
      <p>Unstaking is delayed — testnet: 10 blocks, mainnet: 100 blocks — before funds become withdrawable, and mainnet applies a 15% slash penalty for early/faulty unstaking scenarios defined in <code>config/mainnet.js</code>.</p>

      <div class="warning">
        <strong>Check your network's minimums before staking</strong> — testnet and mainnet have very different minimum stake, unstake delay, and slash parameters. See Token Supply & Gas for the exact numbers per network.
      </div>
    `
  },

  'android-apk': {
    title: 'Android APK',
    content: `
      <h2>SAYMAN Wallet — Android</h2>
      <p>Native Android wallet built with Capacitor (<code>wallet-manager/android</code>), wrapping the same crypto client used by the web wallet at <a href="${WALLET_WEB_URL}" target="_blank">${WALLET_WEB_URL}</a>.</p>

      <div class="download-grid">
        <div class="download-item">
          <i class="fab fa-android"></i>
          <span class="download-name">SAYMAN Wallet APK</span>
          <span class="download-size">Android 8.0+</span>
          <a href="${ANDROID_APK_URL}" download class="btn btn-download-apk">
            <i class="fas fa-download"></i> Download APK
          </a>
        </div>
      </div>

      <div class="note">
        <strong>Served from the repo root <code>apk/</code> folder.</strong> The main chain <code>server.js</code> must mount it explicitly — its default static middleware only serves <code>frontend/</code>. Confirm <code>server.js</code> includes:
        <pre><code>app.use('/apk', express.static(path.join(__dirname, 'apk')));</code></pre>
        Without that line, <code>${ANDROID_APK_URL}</code> 404s even though the file exists on disk.
      </div>

      <h3>Installing</h3>
      <ul>
        <li>Enable "Install unknown apps" for your browser/file manager in Android Settings</li>
        <li>Download and open the APK</li>
        <li>On first launch, create or import a wallet the same way as the CLI/SDK (secp256k1 keypair, address = SHA-256 of public key)</li>
      </ul>
    `
  },

  'wallet-security': {
    title: 'Wallet Security',
    content: `
      <h2>Wallet Security</h2>
      <ul>
        <li>Private keys are secp256k1, generated client-side — the server never sees them.</li>
        <li>Addresses are the first 40 hex characters of SHA-256(publicKey) — there is no checksum, so double-check addresses before sending.</li>
        <li>Signing happens over a SHA-256 hash of <code>{type, timestamp, data, gasLimit, gasPrice, nonce}</code> — the same computation must be used client-side and is re-verified server-side.</li>
        <li>The server independently re-derives your address from your public key on every broadcast and rejects mismatches, so a stolen public key alone cannot forge transactions.</li>
      </ul>
    `
  },

  'token-supply': {
    title: 'Token Supply & Gas',
    content: `
      <p>1 SAYN = 100,000,000 base units (8 decimal places). All amounts are stored as integer base units on-chain.</p>

      <h3>Testnet</h3>
      <ul>
        <li>Block time: 5s, block reward: 50,000,000 base units (0.5 SAYN) — intentionally generous for developers</li>
        <li>Gas price: 1 base unit/gas — transfer ≈ 21,000 base units (0.00021 SAYN)</li>
        <li>Min stake: 1,000,000,000 base units (10 SAYN), unstake delay: 10 blocks</li>
        <li>Max supply: unlimited (testnet only)</li>
      </ul>

      <h3>Mainnet</h3>
      <ul>
        <li>Max supply: 100,000,000 SAYN, hard-capped</li>
        <li>Block reward halves every ~2 years (12,614,400 blocks), starting at 0.2 SAYN/block</li>
        <li>Gas price: 1 base unit/gas — transfer ≈ 0.00021 SAYN</li>
        <li>Min stake: 50,000,000,000 base units (500 SAYN), unstake delay: 100 blocks, slash: 15%</li>
        <li>Genesis allocation: 50M SAYN (30M treasury, 8M team, 2M validator, 10M reserve); remaining ~50M emitted via block rewards over ~15 years</li>
      </ul>
    `
  },

  'hackathon-overview': {
    title: 'SAYMAN Genesis 2026',
    content: `
      <div class="docs-hero">
        <h1>⚡ SAYMAN Genesis 2026</h1>
        <p class="subtitle">Build Beyond EVM.</p>
        <div class="hero-buttons">
          <a href="#hackathon-tracks" class="btn btn-primary" onclick="navigateTo('hackathon-tracks')"><i class="fas fa-code-branch"></i> View Tracks</a>
          <a href="#hackathon-prize" class="btn btn-secondary" onclick="navigateTo('hackathon-prize')"><i class="fas fa-award"></i> Prizes & Perks</a>
          <a href="#dapp-tutorial" class="btn btn-outline" onclick="navigateTo('dapp-tutorial')"><i class="fas fa-rocket"></i> Start Building</a>
        </div>
      </div>

      <h2>About Genesis 2026</h2>
      <p>SAYMAN Genesis is the official global launch hackathon for the SAYMAN Blockchain — a scratch-built, non-EVM, multi-layer Layer-1 blockchain designed for next-generation decentralized applications.</p>
      <p>Over 48 hours, developers, designers, AI engineers, researchers, and blockchain enthusiasts will collaborate to build innovative applications, infrastructure, and developer tools on SAYMAN.</p>

      <h3>Who Should Join?</h3>
      <ul>
        <li>Students</li>
        <li>Developers</li>
        <li>Blockchain Engineers</li>
        <li>AI Builders</li>
        <li>Startup Founders</li>
        <li>Open Source Contributors</li>
      </ul>

      <h3>What You'll Get</h3>
      <ul>
        <li>Live technical workshops</li>
        <li>Direct mentorship from the SAYMAN Core Team</li>
        <li>Networking with developers and founders</li>
        <li>Demo Day</li>
        <li>Community recognition</li>
        <li>Opportunities for future ecosystem grants</li>
        <li>Internship and collaboration opportunities with partners</li>
      </ul>

      <div class="note">
        <strong>Before you build:</strong> see the Contract Engine page for exactly which globals (<code>msg.sender</code>, <code>getState</code>/<code>setState</code>, <code>emit</code>, <code>require</code>) are actually available inside a deployed contract, and check Build a dApp → 5 App Ideas for track-ready project directions.
      </div>
    `
  },

  'hackathon-tracks': {
    title: 'Hackathon Tracks',
    content: `
      <h2>🚀 Tracks</h2>
      <ul>
        <li><strong>AI x Blockchain</strong></li>
        <li><strong>DeFi</strong></li>
        <li><strong>RWA</strong> (Real World Assets)</li>
        <li><strong>Infrastructure</strong></li>
        <li><strong>Wallets</strong></li>
        <li><strong>Explorer Tools</strong></li>
        <li><strong>Cross-chain</strong></li>
        <li><strong>Security</strong></li>
        <li><strong>Developer Tooling</strong></li>
        <li><strong>Open Innovation</strong></li>
      </ul>

      <div class="warning">
        <strong>Scope check per track:</strong> AI x Blockchain, DeFi, RWA, Wallets, Developer Tooling, and Open Innovation can be built directly on the existing contract engine and REST API — see 5 App Ideas for concrete starting points. Cross-chain, Explorer Tools, and Security have no existing SAYMAN reference implementation yet — teams in those tracks are building the first one, on top of the raw primitives (<code>/api/broadcast</code>, <code>/api/proof</code>, contract events) documented in the SDK and REST API sections.
      </div>
    `
  },

  'hackathon-prize': {
    title: 'Prizes & Perks',
    content: `
      <h2>🎁 Prize Pool</h2>
      <p><strong>Total Prize Pool: To Be Announced</strong> (Sponsored Rewards)</p>
      <p>The prize pool will consist of sponsor-funded cash rewards, cloud credits, developer tools, merchandise, internship opportunities, and ecosystem grants.</p>
      <p>Confirmed sponsors and the final prize distribution will be announced before the hackathon begins.</p>

      <h3>Potential Reward Categories</h3>
      <ul>
        <li>🥇 Best Overall Project</li>
        <li>🥈 Best AI Application</li>
        <li>🥉 Best Infrastructure Project</li>
        <li>🏆 Best Student Team</li>
        <li>🏆 Best Open Source Contribution</li>
        <li>🏆 Community Choice Award</li>
        <li>🏆 Best Developer Tool</li>
        <li>🏆 Best Security Innovation</li>
      </ul>

      <div class="tip">
        <strong>Note:</strong> prize amounts and sponsor list are unconfirmed as of writing — update this section as soon as they're locked in so the docs don't overpromise.
      </div>
    `
  },

  'downloads': {
    title: 'Downloads',
    content: `
      <h2>Downloads</h2>
      <div class="download-grid">
        <div class="download-item">
          <i class="fab fa-android"></i>
          <span class="download-name">Android Wallet APK</span>
          <a href="${ANDROID_APK_URL}" download class="download-btn"><i class="fas fa-download"></i> Download</a>
        </div>
      </div>
      <p style="margin-top:1.5rem;">Prefer the browser? Use the web wallet: <a href="${WALLET_WEB_URL}" target="_blank">${WALLET_WEB_URL}</a></p>
      <div class="note">
        <strong>Only the Android APK and web wallet are real right now.</strong> Windows/Mac/Linux/CLI-binary/genesis-file download cards have been left out until those artifacts actually exist and are hosted somewhere.
      </div>
    `
  },

  // ── Phase 14: Multi-Layer Chain docs ─────────────────────────────────────

  'layers-overview': {
    title: 'Layer Overview',
    content: `
      <h2>Multi-Layer Chain Architecture</h2>
      <p>SAYMAN now supports a full multi-layer ecosystem. The <strong>L1 base chain</strong> handles core consensus, token economics, and settlement. On top of it you can run <strong>L2 rollups</strong> for high-throughput batch processing, <strong>sidechains</strong> with custom parameters, and <strong>permissioned chains</strong> for private/enterprise networks.</p>

      <h3>Layer Types</h3>
      <ul>
        <li><strong>L1</strong> — The root chain. Handles PoS consensus, validator rewards, and global state root. Configured via <code>config/mainnet.js</code> or <code>config/testnet.js</code>.</li>
        <li><strong>L2 Rollup</strong> — Batches many transactions off-chain and commits a single batch proof to L1 every N blocks (<code>rollupBatchSize</code>). Dramatically increases effective TPS. Implemented in <code>core/rollup.js</code>.</li>
        <li><strong>Sidechain</strong> — An independent chain with its own validators, gas params, and block time, connected to L1 via the <code>layer2Bridge</code> contract. Good for app-specific chains.</li>
        <li><strong>Permissioned Chain</strong> — Like a sidechain but with a whitelist of validators. Good for enterprise or consortium use cases.</li>
      </ul>

      <h3>TPS</h3>
      <p>Base L1 targets ~100–500 TPS depending on block time and gas limits. L2 rollup mode achieves significantly higher throughput by batching. Query live TPS from <code>GET /api/tps</code>.</p>

      <div class="tip">
        <strong>Which layer should I use?</strong> Start on L1 testnet. If you need higher throughput or custom gas, spawn an L2 or sidechain via the Chain Factory.
      </div>
    `
  },

  'chain-factory': {
    title: 'Chain Factory',
    content: `
      <h2>Chain Factory (<code>core/chain-factory.js</code>)</h2>
      <p>The <code>ChainFactory</code> class lets any developer spawn a new chain — L2, sidechain, or permissioned — on top of SAYMAN's L1 without touching the core codebase.</p>

      <h3>Supported templates</h3>
      <ul>
        <li><code>'l2-rollup'</code> — optimistic rollup with batch commits</li>
        <li><code>'sidechain'</code> — independent chain with L1 bridge</li>
        <li><code>'permissioned'</code> — validator-whitelist chain</li>
      </ul>

      <h3>Usage</h3>
      <pre><code>import ChainFactory from './core/chain-factory.js';

const factory = new ChainFactory(l1Blockchain, l1Config);

// Spawn an L2 rollup
const l2 = await factory.createChain('l2-rollup', {
  name: 'MyRollup',
  chainId: 1001,
  blockTime: 2000,      // 2 s blocks
  rollupBatchSize: 50,  // commit every 50 blocks
  parentChainId: 1
});

console.log(l2.chainId, l2.layer); // 1001, 2</code></pre>

      <h3>Chain config fields (Phase 14)</h3>
      <ul>
        <li><code>layer</code> — 1 for L1, 2 for L2/sidechain</li>
        <li><code>l2Enabled</code> — enable rollup mode</li>
        <li><code>rollupBatchSize</code> — blocks per batch commit</li>
        <li><code>maxTps</code> — target TPS cap</li>
        <li><code>parentChainId</code> — L1 chain ID for bridge</li>
        <li><code>validators</code> — whitelist (permissioned chains only)</li>
      </ul>
    `
  },

  'l2-rollups': {
    title: 'L2 Rollups',
    content: `
      <h2>L2 Rollups (<code>core/rollup.js</code>)</h2>
      <p>SAYMAN's optimistic rollup sequencer batches transactions off-chain and submits a single state-root commit to L1 every <code>rollupBatchSize</code> blocks. This lets the rollup chain run at much higher block frequency without bloating L1.</p>

      <h3>How it works</h3>
      <ol>
        <li>The rollup node collects transactions in its local mempool.</li>
        <li>Every <code>rollupBatchSize</code> blocks, <code>RollupEngine.processBatch()</code> computes a batch state root and submits it via a <code>ROLLUP_COMMIT</code> transaction to L1.</li>
        <li>L1 validators confirm the batch; the rollup is considered finalized.</li>
        <li>Assets cross between L1 and L2 via the <code>layer2Bridge</code> contract (lock on L1, mint on L2; burn on L2, unlock on L1).</li>
      </ol>

      <h3>Sequencer mode</h3>
      <pre><code>node server.js --network testnet --mode sequencer --rollup-batch-size 50</code></pre>

      <div class="note">
        <strong>Fraud proofs:</strong> full fraud-proof verification is on the roadmap. Current implementation uses optimistic acceptance — suitable for testnet and trusted-validator scenarios.
      </div>
    `
  },

  'sidechains': {
    title: 'Sidechains',
    content: `
      <h2>Sidechains</h2>
      <p>A sidechain is an independent SAYMAN chain with its own validator set, gas parameters, and block time. It connects to L1 via the <code>layer2Bridge</code> contract for two-way asset transfers.</p>

      <h3>Spawning a sidechain</h3>
      <pre><code>const sidechain = await factory.createChain('sidechain', {
  name: 'GameChain',
  chainId: 2001,
  blockTime: 1000,   // 1 s blocks
  ticker: 'GAME',
  faucetEnabled: true,
  parentChainId: 1
});</code></pre>

      <h3>Bridge workflow</h3>
      <ul>
        <li><strong>Deposit:</strong> lock SAYN on L1 (<code>layer2Bridge.deposit()</code>) → receive wrapped SAYN on sidechain.</li>
        <li><strong>Withdraw:</strong> burn wrapped SAYN on sidechain (<code>layer2Bridge.withdraw()</code>) → unlock SAYN on L1 after finality period.</li>
      </ul>

      <div class="tip">
        Use a sidechain when you need a custom ticker, very fast blocks, or app-specific gas rules, and you're okay managing your own validator set.
      </div>
    `
  },

  // ── Phase 14: Token & NFT Factory docs ────────────────────────────────────

  'token-factory': {
    title: 'Token Factory',
    content: `
      <h2>Token Factory (<code>contracts/token-factory.js</code>)</h2>
      <p>Deploy any custom ERC-20-style fungible token on SAYMAN with a single contract call — no contract code to write.</p>

      <h3>Deploying the factory</h3>
      <p>The <code>token-factory</code> contract is deployed once per network. Call <code>createToken</code> to launch your token:</p>
      <pre><code>await client.callContract({
  contractAddress: TOKEN_FACTORY_ADDRESS,
  method: 'createToken',
  args: {
    name: 'MyToken',
    symbol: 'MTK',
    decimals: 8,
    initialSupply: 1_000_000_00000000  // 1,000,000 MTK in base units
  },
  wallet
});</code></pre>

      <h3>Interacting with your token</h3>
      <pre><code>// Transfer
await client.callContract({
  contractAddress: TOKEN_ADDRESS,
  method: 'transfer',
  args: { to: recipientAddress, amount: 100_00000000 },
  wallet
});

// Balance
const bal = await client.readState(TOKEN_ADDRESS, 'balance:' + myAddress);</code></pre>

      <h3>API — list all tokens</h3>
      <pre><code>GET /api/tokens</code></pre>
      <p>Returns every token deployed via the factory with its contract address, name, symbol, and total supply.</p>

      <div class="tip">
        <strong>Denomination:</strong> choose your token's <code>decimals</code> at deploy time. All on-chain balances are integers in base units — divide by <code>10^decimals</code> to get the human amount.
      </div>
    `
  },

  'nft-factory': {
    title: 'NFT Factory',
    content: `
      <h2>NFT Factory (<code>contracts/nft-factory.js</code>)</h2>
      <p>Deploy NFT collections and mint tokens without writing any contract code.</p>

      <h3>Create a collection</h3>
      <pre><code>await client.callContract({
  contractAddress: NFT_FACTORY_ADDRESS,
  method: 'createCollection',
  args: {
    name: 'CryptoKittens',
    symbol: 'CKT',
    baseUri: 'https://mymeta.io/'
  },
  wallet
});</code></pre>

      <h3>Mint an NFT</h3>
      <pre><code>await client.callContract({
  contractAddress: NFT_COLLECTION_ADDRESS,
  method: 'mint',
  args: {
    to: recipientAddress,
    tokenId: 1,
    metadataUri: 'https://mymeta.io/1.json'
  },
  wallet
});</code></pre>

      <h3>API — list all collections</h3>
      <pre><code>GET /api/nfts</code></pre>
      <p>Returns every NFT collection deployed via the factory with its address, name, symbol, and total minted.</p>
    `
  },

  'memecoin-factory': {
    title: 'Memecoin Factory',
    content: `
      <h2>Memecoin Factory (<code>contracts/memecoin-factory.js</code>)</h2>
      <p>One-click memecoin deployment. Wraps the token factory with opinionated defaults and an optional image URL.</p>

      <h3>Launch a memecoin</h3>
      <pre><code>await client.callContract({
  contractAddress: MEMECOIN_FACTORY_ADDRESS,
  method: 'createMemecoin',
  args: {
    name: 'DoggyWow',
    symbol: 'DOGW',
    imageUrl: 'https://example.com/doggy.png',
    supply: 420_690_00000000  // 420,690 tokens
  },
  wallet
});</code></pre>

      <h3>List memecoins</h3>
      <pre><code>GET /api/tokens   // memecoins appear alongside other factory tokens</code></pre>

      <div class="note">
        Memecoins are just tokens with an image URL stored in the registry — all the same transfer/balance methods apply.
      </div>
    `
  },

  // ── Phase 14: DeFi Primitives docs ────────────────────────────────────────

  'dex': {
    title: 'DEX',
    content: `
      <h2>DEX — Decentralized Exchange (<code>contracts/dex.js</code>)</h2>
      <p>SAYMAN ships with a constant-product AMM (x·y=k) DEX contract. Liquidity providers can deposit token pairs; traders can swap between any two tokens with on-chain price discovery.</p>

      <h3>Add liquidity</h3>
      <pre><code>await client.callContract({
  contractAddress: DEX_ADDRESS,
  method: 'addLiquidity',
  args: {
    tokenA: TOKEN_A_ADDRESS,
    tokenB: TOKEN_B_ADDRESS,
    amountA: 1000_00000000,
    amountB: 5000_00000000
  },
  wallet
});</code></pre>

      <h3>Swap</h3>
      <pre><code>await client.callContract({
  contractAddress: DEX_ADDRESS,
  method: 'swap',
  args: {
    tokenIn:      TOKEN_A_ADDRESS,
    amountIn:     100_00000000,
    tokenOut:     TOKEN_B_ADDRESS,
    minAmountOut: 490_00000000   // slippage protection
  },
  wallet
});</code></pre>

      <h3>Read pool reserves</h3>
      <pre><code>// via readState — no gas, no tx
const pool = await client.readState(
  DEX_ADDRESS,
  'pool:' + TOKEN_A_ADDRESS + ':' + TOKEN_B_ADDRESS
);
console.log(pool.reserveA, pool.reserveB);</code></pre>

      <div class="tip">
        Price impact is calculated client-side from reserves. Always pass <code>minAmountOut</code> to protect against sandwich attacks.
      </div>
    `
  },

  'staking-pools': {
    title: 'Staking Pools',
    content: `
      <h2>Staking Pools (<code>contracts/staking-pool.js</code>)</h2>
      <p>Anyone can deploy a staking pool that lets others delegate SAYN (or custom tokens) to earn a share of rewards. The pool operator earns a configurable fee.</p>

      <h3>Deploy a pool</h3>
      <pre><code>await client.deployContract({
  name: 'MyPool',
  version: '1.0.0',
  code: stakingPoolSource,  // from contracts/staking-pool.js
  feePolicy: 'user',
  wallet
});
// Then initialize:
await client.callContract({
  contractAddress: POOL_ADDRESS,
  method: 'initialize',
  args: { operatorFee: 10 },  // 10% operator fee
  wallet
});</code></pre>

      <h3>Delegate</h3>
      <pre><code>await client.callContract({
  contractAddress: POOL_ADDRESS,
  method: 'delegate',
  args: { amount: 100_00000000 },
  wallet
});</code></pre>

      <h3>Claim rewards</h3>
      <pre><code>await client.callContract({
  contractAddress: POOL_ADDRESS,
  method: 'claimRewards',
  args: {},
  wallet
});</code></pre>

      <h3>Discover all pools</h3>
      <pre><code>GET /api/staking-pools</code></pre>
      <p>Returns every active staking pool with its address, owner, total delegated, total rewards, and operator fee.</p>
    `
  },

  // ── Phase 14: Reputation docs ─────────────────────────────────────────────

  'reputation': {
    title: 'Peer Reputation',
    content: `
      <h2>Peer Reputation System</h2>
      <p>Peers that contribute valid blocks to the network earn reputation points. Reputation is stored on-chain in the state engine and is queryable via the REST API.</p>

      <h3>How points are earned</h3>
      <ul>
        <li>When a peer provides a valid block during P2P sync, the local node awards <strong>+10 reputation points</strong> to that peer's address.</li>
        <li>Reputation is keyed by <code>SHA-256('peer:' + nodeId).slice(0, 40)</code> — the same format as a wallet address.</li>
        <li>Points accumulate across blocks; there is no decay mechanism currently.</li>
      </ul>

      <h3>Query reputation</h3>
      <pre><code>GET /api/reputation/:address

// Response:
{ "address": "abc123...", "reputation": 420 }</code></pre>

      <p>The <code>GET /api/address/:address</code> endpoint also returns a <code>reputation</code> field alongside balance and stake.</p>

      <h3>Validator reputation</h3>
      <p>The <code>GET /api/validators</code> endpoint includes each validator's reputation score. High-reputation validators signal reliability to delegators.</p>

      <div class="note">
        Reputation is advisory — it does not currently affect validator selection probability, which is purely stake-weighted. Future phases may incorporate reputation into the PoS weight formula.
      </div>
    `
  }

};

// ── State ──────────────────────────────────────────────────────────────────
let currentSection = 'overview';

// ── Initialize ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderContent('overview');
  updateActiveNav('overview');
  updateTOC('overview');

  // Sync theme toggle button
  const savedTheme = localStorage.getItem('theme') || 'light';
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    if (savedTheme === 'dark') {
      btn.innerHTML = '<i class="fas fa-sun"></i> Theme';
    } else {
      btn.innerHTML = '<i class="fas fa-moon"></i> Theme';
    }
  }

  updateHeaderInfo();
  setInterval(updateHeaderInfo, 5000);
});

window.toggleExplorerTheme = function() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  if (isDark) {
    document.documentElement.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-moon"></i> Theme';
  } else {
    document.documentElement.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-sun"></i> Theme';
  }
};

// ── API helpers ──────────────────────────────────────────────────────────────
const API = '/api';
async function apiFetch(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === null || value === undefined) ? '—' : value;
}
async function updateHeaderInfo() {
  try {
    const d = await apiFetch('/network/stats');
    setEl('header-network', d.network  || '—');
    setEl('header-chain',   d.chainId  || '—');
    setEl('header-node',    (d.nodeId  || '').slice(0, 16) + '…');
    setEl('header-mode',    (d.mode    || '—').toUpperCase());
  } catch {
    setEl('header-network', 'Connection error');
  }
}

// ── Render Sidebar ────────────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebarNav');
  let html = '';

  NAV_SECTIONS.forEach(section => {
    html += `<div class="nav-section">`;
    html += `<div class="nav-section-title">${section.title}</div>`;
    section.links.forEach(link => {
      html += `
        <a href="#${link.id}" class="nav-link" data-section="${link.id}" onclick="navigateTo('${link.id}')">
          <i class="fas ${link.icon}"></i> ${link.label}
        </a>
      `;
    });
    html += `</div>`;
  });

  nav.innerHTML = html;
}

// ── Render Content ────────────────────────────────────────────────────────
function renderContent(sectionId) {
  const data = DOCS_DATA[sectionId];
  if (!data) {
    document.getElementById('docsContent').innerHTML = `
      <div style="padding: 4rem 0; text-align: center;">
        <h2 style="color: var(--mono-1000);">Content Coming Soon</h2>
        <p style="color: var(--mono-500);">This section is being written. Check back soon!</p>
      </div>
    `;
    return;
  }

  currentSection = sectionId;
  const container = document.getElementById('docsContent');
  container.innerHTML = `
    <div class="section-content" id="section-${sectionId}">
      ${data.content}
    </div>
  `;

  updateActiveNav(sectionId);
  updateTOC(sectionId);
  document.title = `${data.title} · SAYMAN Documentation`;
}

// ── Navigation ─────────────────────────────────────────────────────────────
function navigateTo(sectionId) {
  renderContent(sectionId);
  document.getElementById('docsSidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateActiveNav(sectionId) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.section === sectionId);
  });
}

// ── TOC ─────────────────────────────────────────────────────────────────────
function updateTOC(sectionId) {
  const data = DOCS_DATA[sectionId];
  if (!data) {
    document.getElementById('tocNav').innerHTML = '';
    return;
  }

  const tocNav = document.getElementById('tocNav');
  const headings = data.content.match(/<h[2-3][^>]*>.*?<\/h[2-3]>/g) || [];

  if (headings.length === 0) {
    tocNav.innerHTML = '';
    return;
  }

  let html = '';
  headings.forEach(heading => {
    const text = heading.replace(/<[^>]*>/g, '');
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const level = heading.match(/<h([2-3])/)[1];
    const style = level === '3' ? 'padding-left: 1.5rem;' : '';

    html += `
      <a href="#${id}" class="toc-link" style="${style}" onclick="event.preventDefault();document.getElementById('${id}')?.scrollIntoView({behavior:'smooth'})">
        ${text}
      </a>
    `;
  });

  tocNav.innerHTML = html;
}

// ── Search ─────────────────────────────────────────────────────────────────
function searchDocs() {
  const query = document.getElementById('docsSearch').value.toLowerCase().trim();

  if (!query) {
    renderContent(currentSection);
    return;
  }

  const results = [];
  for (const [id, data] of Object.entries(DOCS_DATA)) {
    if (data.title.toLowerCase().includes(query) ||
        data.content.toLowerCase().includes(query)) {
      results.push({ id, title: data.title });
    }
  }

  const container = document.getElementById('docsContent');

  if (results.length === 0) {
    container.innerHTML = `
      <div style="padding: 4rem 0; text-align: center;">
        <h2 style="color: var(--mono-1000);">No results found</h2>
        <p style="color: var(--mono-500);">Try a different search term</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="padding: 2rem 0;">
      <h2 style="color: var(--mono-1000);">Search Results</h2>
      <p style="color: var(--mono-500);">Found ${results.length} result${results.length > 1 ? 's' : ''}</p>
      <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 2rem;">
        ${results.map(r => `
          <a href="#" onclick="navigateTo('${r.id}')" style="
            display: block;
            padding: 1rem;
            background: var(--mono-200);
            border: 1px solid var(--mono-300);
            border-radius: 8px;
            color: var(--mono-800);
            text-decoration: none;
            transition: all 0.2s;
          " onmouseover="this.style.borderColor='var(--mono-600)'" onmouseout="this.style.borderColor='var(--mono-300)'">
            <strong style="color: var(--mono-1000); display: block;">${r.title}</strong>
            <span style="color: var(--mono-500); font-size: 0.9rem;">${r.id}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Mobile Sidebar ──────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('docsSidebar').classList.toggle('open');
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('docsSearch').focus();
  }
  if (e.key === 'Escape') {
    document.getElementById('docsSidebar').classList.remove('open');
  }
});

// ── Legal Modals ─────────────────────────────────────────────────────────────
function showLegalModal(type) {
  const modals = {
    terms: {
      title: "Terms & Conditions",
      icon: "fa-gavel",
      content: `
        <p style="margin-bottom:12px;"><strong>1. Decentralized Nature</strong></p>
        <p style="margin-bottom:16px;">SAYMAN is a decentralized, peer-to-peer open-source blockchain network. There is no central administrator, company, or authority that controls the network. By using this explorer or interacting with the network, you acknowledge that you are using a decentralized protocol at your own risk.</p>
        <p style="margin-bottom:12px;"><strong>2. User Responsibility</strong></p>
        <p style="margin-bottom:16px;">You are solely responsible for the security of your private keys, seed phrases, and wallets. Transactions broadcast to the SAYMAN network are immutable and irreversible. The developers, contributors, and validators cannot recover lost funds, reverse transactions, or restore access to locked accounts.</p>
        <p style="margin-bottom:12px;"><strong>3. Smart Contracts & Custom Tokens</strong></p>
        <p style="margin-bottom:16px;">Anyone can deploy smart contracts, custom tokens, memecoins, or DEX pools. The network and its developers do not verify, endorse, or guarantee the safety or legality of user-deployed contracts. Exercise extreme caution when interacting with third-party contracts.</p>
        <p style="margin-bottom:12px;"><strong>4. Disclaimer of Warranty</strong></p>
        <p>The software and network are provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
      `
    },
    privacy: {
      title: "Privacy Policy",
      icon: "fa-shield-alt",
      content: `
        <p style="margin-bottom:12px;"><strong>1. On-Chain Ledger Transparency</strong></p>
        <p style="margin-bottom:16px;">SAYMAN is a public ledger blockchain. All transactions, contract deployments, validator stakes, peer connections, and on-chain activities are public, globally accessible, and immutable. Do not store any personal, confidential, or personally identifiable information (PII) on the blockchain.</p>
        <p style="margin-bottom:12px;"><strong>2. No Data Collection</strong></p>
        <p style="margin-bottom:16px;">This blockchain explorer does not require registration, accounts, or email sign-ups. We do not collect, sell, or track personal information, IP addresses, or browsing history.</p>
        <p style="margin-bottom:12px;"><strong>3. Third-Party Links</strong></p>
        <p>The dashboard and docs contain links to external wallets, verification pages, or GitHub. We are not responsible for the privacy practices of third-party platforms.</p>
      `
    },
    cookies: {
      title: "Cookies Policy",
      icon: "fa-cookie-bite",
      content: `
        <p style="margin-bottom:12px;"><strong>1. Strictly Necessary Cookies</strong></p>
        <p style="margin-bottom:16px;">This explorer interface does not use third-party tracking, profiling, or advertising cookies. We only use functional local storage (such as browser localStorage) to remember configuration choices (e.g. API endpoint base URLs or page selections).</p>
        <p style="margin-bottom:12px;"><strong>2. Opt-out</strong></p>
        <p>Since we do not deploy tracking or analytical cookies, there is no tracking to opt-out of. You can clear your browser's local cache at any time to remove saved network settings.</p>
      `
    },
    copyright: {
      title: "Copyright Notice",
      icon: "fa-copyright",
      content: `
        <p style="margin-bottom:12px;"><strong>MIT License</strong></p>
        <p style="margin-bottom:16px;">Copyright (c) 2026 SAYMAN Blockchain Team</p>
        <p style="margin-bottom:16px;">Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</p>
        <p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>
      `
    }
  };

  const item = modals[type];
  if (!item) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 600px;">
      <div class="modal-header">
        <h3><i class="fas ${item.icon}"></i> ${item.title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> CLOSE</button>
      </div>
      <div class="modal-body" style="line-height: 1.6; font-size: 13px; color: var(--mono-100); padding: calc(var(--grid)*3); overflow-y: auto;">
        ${item.content}
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}