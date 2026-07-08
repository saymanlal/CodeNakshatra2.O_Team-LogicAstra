// ── Config ───────────────────────────────────────────────────────────────
const ANDROID_APK_URL = '/apk/base.apk';
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
    title: 'Build a dApp',
    links: [
      { id: 'dapp-tutorial', icon: 'fa-hammer', label: 'Your First dApp' },
      { id: 'app-ideas', icon: 'fa-lightbulb', label: '5 App Ideas' }
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
        <p class="subtitle">Everything you need to build, validate, deploy and integrate with SAYMAN Blockchain.</p>
        <div class="hero-buttons">
          <a href="#install-sdk" class="btn btn-primary" onclick="navigateTo('install-sdk')"><i class="fas fa-rocket"></i> Get Started</a>
          <a href="#android-apk" class="btn btn-secondary" onclick="navigateTo('android-apk')"><i class="fas fa-download"></i> Download Wallet</a>
          <a href="#dapp-tutorial" class="btn btn-secondary" onclick="navigateTo('dapp-tutorial')"><i class="fas fa-hammer"></i> Build a dApp</a>
        </div>
      </div>

      <h2>Welcome to SAYMAN Blockchain</h2>
      <p>SAYMAN is a Proof-of-Stake Layer 1 blockchain with a built-in JavaScript smart contract engine, a REST API, a CLI wallet, a browser-based JS SDK, an Android wallet, and a testnet faucet.</p>

      <div class="note">
        <strong>Current status:</strong> Public testnet is live. The JS SDK, CLI, and contract engine are functional for TRANSFER, STAKE, UNSTAKE, CONTRACT_DEPLOY, and CONTRACT_CALL transaction types against the REST API in <code>api/routes.js</code>.
      </div>

      <h3>What actually works today</h3>
      <ul>
        <li><strong>REST API</strong> — network stats, blocks, transactions, address lookup, validators, contracts, broadcast, faucet, mempool, search, gas estimation.</li>
        <li><strong>CLI wallet</strong> (<code>cli/sayman-cli.js</code>) — create/import wallet, check balance, send, stake, unstake, list validators.</li>
        <li><strong>Contract engine</strong> (<code>core/contracts.js</code>) — a real sandboxed VM (Node's built-in <code>vm</code> module) that executes deployed JS contracts with gas metering and persistent state.</li>
        <li><strong>Android wallet</strong> — Capacitor-based APK, see Android APK page.</li>
        <li><strong>Web wallet</strong> — <a href="${WALLET_WEB_URL}" target="_blank">${WALLET_WEB_URL}</a></li>
        <li><strong>Faucet</strong> — <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a></li>
      </ul>

      <div class="warning">
        <strong>Known gap:</strong> the JS SDK (<code>sdk/client.js</code>) previously called endpoints that don't exist on this server (<code>/api/account</code>, <code>/api/transactions</code>, <code>/api/events</code>, <code>/api/reputation</code>, <code>/api/reports</code>). It has been rewired to the real routes — see the JavaScript SDK page for the corrected, working version.
      </div>
    `
  },

  'why-sayman': {
    title: 'Why SAYMAN',
    content: `
      <h2>Why SAYMAN Blockchain?</h2>
      <p>SAYMAN is a Proof-of-Stake chain with a JS-native contract model: contracts are plain JavaScript objects/classes executed in a sandboxed VM, not EVM bytecode.</p>

      <h3>Key Differentiators</h3>
      <ul>
        <li><strong>JS-native contracts:</strong> write contracts in JavaScript, deployed and run in a sandboxed <code>vm</code> context with metered gas — no new language to learn.</li>
        <li><strong>Configurable fee policy:</strong> contracts can be deployed as <code>user</code>-pays, <code>sponsor</code>-pays, or <code>free</code>, so app developers can abstract gas away from end users.</li>
        <li><strong>Merkle state tree:</strong> every account and contract storage slot is committed to a Merkle root with proof generation/verification (<code>GET /api/proof/:address</code>).</li>
        <li><strong>Multiple network configs:</strong> testnet, public-testnet (multi-node via bootstrap peers), and mainnet with a halving block-reward schedule, selected at boot via <code>--network</code>.</li>
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
      </ul>

      <h3>Networking</h3>
      <ul>
        <li><code>api/routes.js</code> — the REST API (see REST API Reference)</li>
        <li><code>p2p/server.js</code> + <code>p2p/peerManager.js</code> — node-to-node block/transaction gossip</li>
        <li><code>config/index.js</code>, <code>config/testnet.js</code>, <code>config/public-testnet.js</code>, <code>config/mainnet.js</code> — network-specific gas/reward/staking parameters, selected via the <code>--network</code> flag on boot</li>
      </ul>

      <h3>Clients</h3>
      <ul>
        <li><code>cli/</code> — <code>sayman-cli.js</code> (command entrypoint) + <code>wallet-cli.js</code> (key management)</li>
        <li><code>sdk/</code> — <code>client.js</code> (REST wrapper) + <code>index.js</code> (package entry point)</li>
        <li><code>frontend/</code> — chain explorer (<code>index.html</code> / <code>app.js</code>) and this documentation site (<code>docs.html</code> / <code>docs.js</code> / <code>docs.css</code>), served directly by <code>server.js</code></li>
        <li><code>wallet-manager/</code> — Capacitor Android wallet app; <code>wallet-manager/android</code> is the native shell, <code>wallet-manager/www</code> is the bundled web build actually packaged inside the APK</li>
      </ul>

      <h3>Standalone services</h3>
      <ul>
        <li><code>faucet/</code> — separate Express service, deployed at <a href="${FAUCET_API_URL}" target="_blank">${FAUCET_API_URL}</a></li>
        <li><code>faucet-site/</code> — static frontend for the faucet, deployed at <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a></li>
        <li><code>apk/base.apk</code> — the built Android wallet binary, served by the main chain server at <code>/apk/base.apk</code></li>
      </ul>

      <div class="note">
        <strong>Entry point:</strong> <code>server.js</code> at the repo root boots the chain, mounts <code>frontend/</code> as the static web root, mounts <code>apk/</code> at <code>/apk</code>, and calls <code>setupRoutes()</code> from <code>api/routes.js</code> to attach the REST API.
      </div>
    `
  },

  'roadmap': {
    title: 'Roadmap',
    content: `
      <h2>Roadmap</h2>
      <div class="warning">
        <strong>Honesty note:</strong> there's no dated, locked roadmap document in the repo. Rather than invent milestones or dates, this page states only what's verifiably true right now. Replace it once real dates are confirmed.
      </div>
      <ul>
        <li><strong>Now:</strong> public testnet running (<code>config/public-testnet.js</code>), faucet live, CLI + SDK + contract engine functional, Android and web wallets available.</li>
        <li><strong>Near-term:</strong> SAYMAN Genesis 2026 — building out the wider ecosystem (wallets, tooling, explorers, cross-chain, security) on top of current primitives.</li>
        <li><strong>Later:</strong> mainnet launch using the parameters already defined in <code>config/mainnet.js</code> — 100,000,000 SAYN hard cap, Bitcoin-style halving block rewards. No announced date yet.</li>
      </ul>
    `
  },

  'faq': {
    title: 'FAQ',
    content: `
      <h2>Frequently Asked Questions</h2>

      <h3>Is SAYMAN EVM-compatible?</h3>
      <p>No. Contracts run as plain JavaScript inside a sandboxed Node <code>vm</code> context, not EVM bytecode. Solidity contracts won't run as-is — see Writing Contracts to port the logic over.</p>

      <h3>What language do I write contracts in?</h3>
      <p>JavaScript, using only the globals listed on the Contract Engine page. Anything outside that list (a bare <code>caller</code>, a bare <code>state</code> object, <code>require('fs')</code>, etc.) is undefined inside the sandbox.</p>

      <h3>How do I get test tokens?</h3>
      <p>Use the faucet UI at <a href="${FAUCET_SITE_URL}" target="_blank">${FAUCET_SITE_URL}</a>, or call the faucet service directly at <a href="${FAUCET_API_URL}" target="_blank">${FAUCET_API_URL}</a>. The chain's own built-in <code>POST /api/broadcast</code>-adjacent faucet route also exists on testnet configs.</p>

      <h3>Is there a mobile wallet?</h3>
      <p>Yes — an Android APK (see Android APK page, downloadable at <code>/apk/base.apk</code>) and a web wallet at <a href="${WALLET_WEB_URL}" target="_blank">${WALLET_WEB_URL}</a>.</p>

      <h3>What happens if my contract references an undefined global?</h3>
      <p>It throws a <code>ReferenceError</code> at <em>call</em> time inside the VM sandbox, not at deploy time — deploying broken code succeeds, and it only fails the first time someone invokes the broken method. Always test every method after deploying.</p>

      <h3>How much does it cost to deploy or call a contract?</h3>
      <p>Deploy: 200,000 gas base + 1 gas per 10 bytes of source. Calls: 50,000 gas base + 500 per storage read + 2,000 per storage write. See Token Supply & Gas for gas price by network.</p>

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
    title: '5 App Ideas',
    content: `
      <h2>5 dApp Ideas Built for SAYMAN's Contract Model</h2>
      <p>Each of these fits directly on top of <code>getState</code>/<code>setState</code>/<code>emit</code>/<code>require</code> — no extra infrastructure needed.</p>

      <h3>1. On-chain token (fungible)</h3>
      <p>Extend the reference <code>contracts/token.js</code>: <code>mint</code>, <code>transfer</code>, <code>balanceOf</code>. Add an <code>approve</code>/<code>transferFrom</code> pair keyed by <code>allow:owner:spender</code> for an ERC-20-style allowance system.</p>

      <h3>2. Community voting / governance</h3>
      <p>Store proposals under <code>proposal:id</code>, votes under <code>vote:proposalId:voterAddress</code> to prevent double-voting, and a running tally under <code>tally:proposalId</code>. Use <code>require</code> to enforce one vote per address and a voting deadline via <code>blockTimestamp</code>.</p>

      <h3>3. Escrow / marketplace</h3>
      <p>Buyer calls <code>createOrder({ seller, amount })</code> which locks funds via <code>transfer(contractAddress-equivalent, amount)</code> pattern into contract-held state; seller calls <code>fulfill(orderId)</code>; buyer calls <code>confirmReceipt(orderId)</code> to release funds with <code>transfer(seller, amount)</code>. Add a <code>dispute(orderId)</code> method gated to an arbiter address stored via <code>setOwner</code>-style pattern.</p>

      <h3>4. Reputation / civic registry</h3>
      <p>Similar to the CrowdPulse pattern already in this ecosystem: <code>submitReport(args)</code> writes a report keyed by an incrementing id, <code>upvote(id)</code> increments a counter (with a <code>voted:id:address</code> guard against double-upvoting), and a <code>getTopReports()</code>-style read walks the id range client-side and sorts by vote count.</p>

      <h3>5. On-chain raffle / lottery</h3>
      <p>Participants call <code>enter()</code> with a fixed entry fee (transferred to the contract), stored in an array under <code>entrants</code>. An admin-only <code>drawWinner()</code> method uses <code>hash(blockTimestamp + entrants.length)</code> as a simple pseudo-random seed to pick an index, then <code>transfer()</code>s the pooled amount to the winner. Note: block-timestamp-based randomness is guessable by validators — fine for a testnet demo, not for a high-value mainnet raffle.</p>

      <div class="warning">
        <strong>Security note for all five:</strong> always validate <code>msg.sender</code> against a stored owner/admin address before letting privileged methods run, and always use <code>require()</code> to reject bad input early — the sandbox will happily let a malformed call corrupt your contract's state otherwise.
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
        <strong>Not implemented server-side:</strong> per-key contract state routes, an events API, a reputation API, and civic-report transaction types referenced in earlier SDK drafts. <code>readState()</code> works around the first by fetching the whole contract object and reading the key client-side.
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
        <li><code>GET /api/network</code> — network name, chain ID, gas costs, faucet status</li>
        <li><code>GET /api/stats</code> — chain stats (blocks, validators, mempool, state root)</li>
        <li><code>GET /api/network/stats</code> — stats + p2p peer info + uptime</li>
        <li><code>GET /api/network/peers</code> — connected peer list</li>
        <li><code>GET /api/blocks?page=&limit=</code> — paginated block list</li>
        <li><code>GET /api/block/:index</code> — single block by height</li>
        <li><code>GET /api/block/hash/:hash</code> — single block by hash (prefix match)</li>
        <li><code>GET /api/light/block/:height</code> — block header only</li>
        <li><code>GET /api/transactions/:id</code> — single transaction by id</li>
        <li><code>GET /api/address/:address</code> — balance, stake, nonce, unstaking status, full tx history</li>
        <li><code>GET /api/balance/:address</code> — lighter version of the above (no tx history)</li>
        <li><code>GET /api/validators</code> — validator set with stake %, estimated APR</li>
        <li><code>GET /api/contracts</code> — full contract registry</li>
        <li><code>GET /api/contracts/:address</code> — one contract, including its state object</li>
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
});

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