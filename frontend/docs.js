// ── Config ───────────────────────────────────────────────────────────────
// ⚠️ Fill this in once the APK is hosted somewhere reachable (GitHub Releases,
// your Render/Vercel static folder, a CDN, etc). Until then the button below
// will 404 — Claude cannot host a binary file for you, only wire the link.
const ANDROID_APK_URL = 'https://REPLACE-ME/sayman-wallet.apk';

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
          <a href="#javascript-sdk" class="btn btn-secondary" onclick="navigateTo('javascript-sdk')"><i class="fas fa-code"></i> JavaScript SDK</a>
        </div>
      </div>

      <h2>Welcome to SAYMAN Blockchain</h2>
      <p>SAYMAN is a Proof-of-Stake Layer 1 blockchain with a built-in JavaScript smart contract engine, a REST API, a CLI wallet, and a browser-based JS SDK.</p>

      <div class="note">
        <strong>Current status:</strong> Testnet is live. The JS SDK, CLI, and contract engine are functional for TRANSFER, STAKE, UNSTAKE, CONTRACT_DEPLOY, and CONTRACT_CALL transaction types against the REST API in <code>api/routes.js</code>.
      </div>

      <h3>What actually works today</h3>
      <ul>
        <li><strong>REST API</strong> — network stats, blocks, transactions, address lookup, validators, contracts, broadcast, faucet, mempool, search, gas estimation.</li>
        <li><strong>CLI wallet</strong> (<code>cli/sayman-cli.js</code>) — create/import wallet, check balance, send, stake, unstake, list validators. Talks to the REST API over HTTP.</li>
        <li><strong>Contract engine</strong> (<code>core/contracts.js</code>) — a real sandboxed VM (Node's built-in <code>vm</code> module) that executes deployed JS contracts with gas metering and persistent state.</li>
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
      <p>SAYMAN is a Proof-of-Stake chain with an EVM-adjacent but JS-native contract model: contracts are plain JavaScript objects/classes executed in a sandboxed VM, not bytecode.</p>

      <h3>Key Differentiators</h3>
      <ul>
        <li><strong>JS-native contracts:</strong> write contracts in JavaScript, deployed and run in a sandboxed <code>vm</code> context with metered gas.</li>
        <li><strong>Configurable fee policy:</strong> contracts can be deployed as <code>user</code>-pays, <code>sponsor</code>-pays, or <code>free</code>.</li>
        <li><strong>Merkle state tree:</strong> every account and contract storage slot is committed to a Merkle root with proof generation/verification.</li>
        <li><strong>Multiple network configs:</strong> testnet, public-testnet (multi-node via bootstrap peers), and mainnet with a halving block-reward schedule.</li>
      </ul>
    `
  },

  'install-sdk': {
    title: 'Install SDK',
    content: `
      <h2>Install SAYMAN SDK</h2>
      <p>The JS SDK lives in <code>sdk/</code> in this repo and is consumed as a local package or published npm package.</p>

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
        <strong>Tip:</strong> the CLI defaults to <code>https://sayman.onrender.com/api</code>. Point it elsewhere with <code>sayman config https://your-host/api</code> or the <code>SAYMAN_API</code> env var.
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

      <h3>Via REST API</h3>
      <pre><code>curl -X POST https://sayman.onrender.com/api/faucet \\
  -H "Content-Type: application/json" \\
  -d '{"address":"YOUR_ADDRESS"}'</code></pre>
      <p>This queues a TRANSFER into the mempool — tokens land once the next block is produced, they are not instant.</p>

      <div class="tip">
        <strong>Amount:</strong> testnet faucet drips <code>10,000,000</code> base units (1000 SAYN) per request, subject to the faucet's own balance.
      </div>
    `
  },

  'javascript-sdk': {
    title: 'JavaScript SDK',
    content: `
      <h2>JavaScript SDK</h2>
      <p>Thin fetch-based client around the REST API in <code>api/routes.js</code>. This page documents the corrected client — the original shipped version called routes that don't exist on the server (see the warning on the Introduction page).</p>

      <h3>Setup</h3>
      <pre><code>import { SaymanClient } from '@sayman/sdk';

const client = new SaymanClient({ rpcUrl: 'https://sayman.onrender.com' });</code></pre>

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
  code: counterContractSource,   // string — see Smart Contracts section
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

      <div class="note">
        <strong>Every write goes through <code>POST /api/broadcast</code>.</strong> There is no separate <code>/api/transactions</code> endpoint — TRANSFER, STAKE, UNSTAKE, CONTRACT_DEPLOY, and CONTRACT_CALL are all just different <code>type</code> values on the same broadcast payload.
      </div>

      <div class="warning">
        <strong>Not implemented server-side yet:</strong> per-key contract state routes, an events API, a reputation API, and native civic-report transaction types referenced in earlier SDK drafts. <code>readState()</code> below works around this by fetching the whole contract object and reading the key client-side.
      </div>
    `
  }, 'rest-api': {
    title: 'REST API Reference',
    content: `
      <h2>REST API</h2>
      <p>Base path <code>/api</code>. This list reflects the routes actually registered in <code>api/routes.js</code> — nothing here is aspirational.</p>

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

      <div class="note">
        <strong>Hash must match exactly</strong> across <code>core/transaction.js</code>, <code>cli/wallet-cli.js</code>, and the SDK: it's a SHA-256 over <code>{type, timestamp, data, gasLimit, gasPrice, nonce}</code> as JSON, in that key order. If any client hashes a different field set, signatures will fail server-side verification.
      </div>
    `
  },

  'contracts-overview': {
    title: 'Contract Engine',
    content: `
      <h2>Smart Contract Engine</h2>
      <p><code>core/contracts.js</code> runs contracts inside Node's <code>vm</code> module — a real sandbox, not an EVM interpreter. Any contract expressible as JavaScript logic can be deployed: counters, tokens, registries, voting, escrow, oracles, games — anything the hackathon track needs, as long as it fits the sandbox's available globals below.</p>

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
        <strong>Gas limit:</strong> deploy costs <code>200,000</code> gas + 1 gas per 10 bytes of source. Calls cost a <code>50,000</code> base + storage reads (500 gas) and writes (2,000 gas). Execution is killed after <code>maxExecutionTime</code> (5s by default).
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

  'android-apk': {
    title: 'Android APK',
    content: `
      <h2>SAYMAN Wallet — Android</h2>
      <p>Native Android wallet built with Capacitor (<code>wallet-manager/android</code>), wrapping the same crypto client used by the web wallet.</p>

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

      <div class="warning">
        <strong>Link needs a real host:</strong> the button points at <code>${ANDROID_APK_URL}</code> as a placeholder. Upload the built APK to a GitHub Release, your CDN, or Render/Vercel static hosting, then swap <code>ANDROID_APK_URL</code> at the top of <code>docs.js</code> for the real URL. The <code>download</code> attribute on the link makes the browser save the file directly instead of navigating to it.
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
      <h2>SAYN Tokenomics</h2>
      <p>1 SAYN = 10,000 base units (4 decimal places). All amounts are stored as integer base units on-chain.</p>

      <h3>Testnet</h3>
      <ul>
        <li>Block time: 5s, block reward: 5,000 base units (0.5 SAYN) — intentionally generous for developers</li>
        <li>Gas price: 1 base unit/gas — transfer ≈ 21,000 base units (0.0021 SAYN)</li>
        <li>Min stake: 100,000 base units (10 SAYN), unstake delay: 10 blocks</li>
        <li>Max supply: unlimited (testnet only)</li>
      </ul>

      <h3>Mainnet</h3>
      <ul>
        <li>Max supply: 100,000,000 SAYN, hard-capped</li>
        <li>Block reward halves every ~2 years (12,614,400 blocks), starting at 0.2 SAYN/block</li>
        <li>Gas price: 5 base units/gas — transfer ≈ 0.0105 SAYN</li>
        <li>Min stake: 5,000,000 base units (500 SAYN), unstake delay: 100 blocks, slash: 15%</li>
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
          <a href="#install-sdk" class="btn btn-outline" onclick="navigateTo('install-sdk')"><i class="fas fa-rocket"></i> Start Building</a>
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
      </ul> <div class="note">
        <strong>Before you build:</strong> see the Contract Engine page for exactly which globals (<code>msg.sender</code>, <code>getState</code>/<code>setState</code>, <code>emit</code>, <code>require</code>) are actually available inside a deployed contract, so your submission doesn't hit a runtime <code>ReferenceError</code> on stage.
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
        <strong>Scope check per track:</strong> AI x Blockchain, DeFi, RWA, Wallets, Developer Tooling, and Open Innovation can be built directly on the existing contract engine and REST API. Cross-chain, Explorer Tools, and Security have no existing SAYMAN reference implementation yet — teams in those tracks are building the first one, on top of the raw primitives (<code>/api/broadcast</code>, <code>/api/proof</code>, contract events) documented in the SDK and REST API sections.
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
      <div class="note">
        <strong>Only the Android APK is real right now.</strong> Windows/Mac/Linux/CLI/genesis-file download cards were placeholder links in the previous version of this page and have been removed until those artifacts actually exist and are hosted somewhere.
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