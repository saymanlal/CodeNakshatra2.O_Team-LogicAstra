// ── Documentation Data ──────────────────────────────────────────────────────
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
            <a href="#javascript-sdk" class="btn btn-secondary" onclick="navigateTo('javascript-sdk')"><i class="fas fa-code"></i> Download SDK</a>
            <a href="/" class="btn btn-outline"><i class="fas fa-eye"></i> View Explorer</a>
            <a href="#whitepaper" class="btn btn-outline" onclick="navigateTo('whitepaper')"><i class="fas fa-file-pdf"></i> Read Whitepaper</a>
          </div>
        </div>
  
        <h2>Welcome to SAYMAN Blockchain</h2>
        <p>SAYMAN is a next-generation Layer 1 blockchain designed for AI integration, high-performance applications, and decentralized infrastructure. Built with scalability, security, and developer experience in mind.</p>
  
        <div class="note">
          <strong>⚡ Quick Start:</strong> Get started in minutes with our SDKs and testnet faucet.
        </div>
  
        <h3>Key Features</h3>
        <ul>
          <li><strong>AI-Native Architecture</strong> - Built-in support for AI workloads and machine learning models</li>
          <li><strong>High Performance</strong> - 10,000+ TPS with sub-second finality</li>
          <li><strong>Developer Friendly</strong> - Multiple SDKs, comprehensive documentation, and testnet environment</li>
          <li><strong>Secure & Decentralized</strong> - Proof-of-Stake consensus with slashable security</li>
          <li><strong>EVM Compatible</strong> - Deploy existing Ethereum contracts with minimal changes</li>
        </ul>
  
        <div class="tip">
          <strong>💡 Tip:</strong> Start with our <a href="#install-sdk" style="color:var(--primary);">Installation Guide</a> to set up your development environment.
        </div>
      `
    },
    'why-sayman': {
      title: 'Why SAYMAN',
      content: `
        <h2>Why SAYMAN Blockchain?</h2>
        <p>SAYMAN represents the next evolution in blockchain technology, combining AI capabilities with high-performance infrastructure.</p>
  
        <h3>Vision</h3>
        <p>To create a decentralized infrastructure where AI and blockchain converge, enabling trustless, autonomous systems that benefit humanity.</p>
  
        <h3>Key Differentiators</h3>
        <ul>
          <li><strong>AI Integration:</strong> Native support for AI models and smart contracts</li>
          <li><strong>Performance:</strong> 10,000+ TPS with minimal latency</li>
          <li><strong>Cost-Effective:</strong> Low transaction fees and gas costs</li>
          <li><strong>Developer Experience:</strong> Comprehensive SDKs and tools</li>
          <li><strong>Community-Driven:</strong> Open source and community governed</li>
        </ul>
  
        <div class="note">
          <strong>📢 News:</strong> SAYMAN is now live on Testnet! Start building today.
        </div>
      `
    },
    'architecture': {
      title: 'Architecture',
      content: `
        <h2>SAYMAN Architecture</h2>
        <p>The SAYMAN blockchain is built on a modular architecture designed for scalability, security, and flexibility.</p>
  
        <h3>Core Components</h3>
        <ul>
          <li><strong>Consensus Layer:</strong> Proof-of-Stake with Byzantine Fault Tolerance</li>
          <li><strong>Execution Layer:</strong> EVM-compatible virtual machine</li>
          <li><strong>Data Availability:</strong> Lightweight data storage with sharding support</li>
          <li><strong>Networking:</strong> P2P gossip protocol for fast communication</li>
          <li><strong>AI Integration Layer:</strong> Native support for AI model execution</li>
        </ul>
  
        <h3>Technology Stack</h3>
        <ul>
          <li><strong>Language:</strong> Go, Rust, Python</li>
          <li><strong>Consensus:</strong> Tendermint-based BFT</li>
          <li><strong>Networking:</strong> libp2p</li>
          <li><strong>Database:</strong> LevelDB, RocksDB</li>
          <li><strong>Smart Contracts:</strong> EVM-compatible bytecode</li>
        </ul>
      `
    },
    'roadmap': {
      title: 'Roadmap',
      content: `
        <h2>SAYMAN Roadmap</h2>
        <p>Our journey towards building the ultimate AI-blockchain infrastructure.</p>
  
        <h3>Q1 2026 - Foundation</h3>
        <ul>
          <li>✅ Core blockchain implementation</li>
          <li>✅ Testnet launch</li>
          <li>✅ Explorer and wallet release</li>
          <li>✅ Developer documentation</li>
        </ul>
  
        <h3>Q2 2026 - Growth</h3>
        <ul>
          <li>Mainnet beta launch</li>
          <li>AI integration framework</li>
          <li>Developer grants program</li>
          <li>Ecosystem partnerships</li>
        </ul>
  
        <h3>Q3 2026 - Scale</h3>
        <ul>
          <li>Full mainnet launch</li>
          <li>AI model marketplace</li>
          <li>Cross-chain bridges</li>
          <li>Enterprise solutions</li>
        </ul>
  
        <div class="note">
          <strong>🚀 Ready to Build?</strong> Join our <a href="#hackathon-overview" style="color:var(--primary);">Genesis Hackathon</a> and start building today!
        </div>
      `
    },
    'faq': {
      title: 'FAQ',
      content: `
        <h2>Frequently Asked Questions</h2>
  
        <h3>What is SAYMAN?</h3>
        <p>SAYMAN is a Layer 1 blockchain platform that integrates AI capabilities with high-performance decentralized infrastructure.</p>
  
        <h3>How do I get started?</h3>
        <p>Start by installing our SDK, creating a wallet, and getting test tokens from the faucet. Check our Getting Started guide.</p>
  
        <h3>What consensus mechanism does SAYMAN use?</h3>
        <p>SAYMAN uses a Proof-of-Stake consensus mechanism with Byzantine Fault Tolerance for security and fast finality.</p>
  
        <h3>Is SAYMAN EVM compatible?</h3>
        <p>Yes! SAYMAN is fully EVM compatible, allowing you to deploy existing Ethereum smart contracts with minimal changes.</p>
  
        <h3>How can I become a validator?</h3>
        <p>Review our Validator section for requirements, staking information, and setup guides.</p>
      `
    },
    'whitepaper': {
      title: 'Whitepaper',
      content: `
        <h2>SAYMAN Whitepaper</h2>
        <p>The comprehensive technical whitepaper detailing SAYMAN's architecture, consensus, and vision.</p>
  
        <div class="download-grid">
          <div class="download-item">
            <i class="fas fa-file-pdf"></i>
            <span class="download-name">Technical Whitepaper</span>
            <span class="download-size">2.4 MB</span>
            <a href="/downloads/whitepaper" class="download-btn"><i class="fas fa-download"></i> Download PDF</a>
          </div>
          <div class="download-item">
            <i class="fas fa-file-alt"></i>
            <span class="download-name">Litepaper</span>
            <span class="download-size">1.2 MB</span>
            <a href="/downloads/litepaper" class="download-btn"><i class="fas fa-download"></i> Download PDF</a>
          </div>
        </div>
  
        <h3>Abstract</h3>
        <p>SAYMAN proposes a novel blockchain architecture that integrates artificial intelligence capabilities directly into the protocol layer. This enables the creation of intelligent, autonomous decentralized applications that can learn, adapt, and interact with both on-chain and off-chain data.</p>
  
        <div class="note">
          <strong>📄 Download:</strong> The whitepaper is available for download above. Feel free to share and cite it in your research.
        </div>
      `
    },
    'install-sdk': {
      title: 'Install SDK',
      content: `
        <h2>Install SAYMAN SDK</h2>
        <p>Get started with SAYMAN development by installing our SDK.</p>
  
        <h3>JavaScript/TypeScript</h3>
        <pre><code>npm install @sayman/sdk</code></pre>
  
        <h3>Python</h3>
        <pre><code>pip install sayman-sdk</code></pre>
  
        <h3>Go</h3>
        <pre><code>go get github.com/saymanlabs/sayman-sdk-go</code></pre>
  
        <div class="note">
          <strong>📦 Download:</strong> All SDKs are available on GitHub and package managers.
        </div>
      `
    },
    'create-wallet': {
      title: 'Create Wallet',
      content: `
        <h2>Create a Wallet</h2>
        <p>Your gateway to the SAYMAN ecosystem.</p>
  
        <h3>Using JavaScript SDK</h3>
        <pre><code>const { Wallet } = require('@sayman/sdk');
  const wallet = new Wallet();
  const address = wallet.generateAddress();
  console.log('Address:', address);</code></pre>
  
        <h3>Using CLI</h3>
        <pre><code>sayman-cli wallet create</code></pre>
  
        <div class="warning">
          <strong>⚠️ Important:</strong> Always back up your private key securely. Never share it with anyone.
        </div>
      `
    },
    'get-test-tokens': {
      title: 'Get Test Tokens',
      content: `
        <h2>Get Test Tokens</h2>
        <p>Get SAYN test tokens from the faucet to start building.</p>
  
        <h3>Via Faucet</h3>
        <ul>
          <li>Visit <a href="/faucet" style="color:var(--primary);">SAYMAN Faucet</a></li>
          <li>Enter your wallet address</li>
          <li>Click "Request Tokens"</li>
          <li>Receive 100 SAYN test tokens</li>
        </ul>
  
        <h3>Via CLI</h3>
        <pre><code>sayman-cli faucet request --address YOUR_ADDRESS</code></pre>
  
        <div class="tip">
          <strong>💡 Tip:</strong> You can request tokens every 24 hours.
        </div>
      `
    },
    'connect-wallet': {
      title: 'Connect Wallet',
      content: `
        <h2>Connect Wallet</h2>
        <p>Connect your SAYMAN wallet to applications and services.</p>
  
        <h3>JavaScript</h3>
        <pre><code>const { Wallet } = require('@sayman/sdk');
  const wallet = new Wallet('your-private-key');
  await wallet.connect();
  console.log('Connected:', wallet.address);</code></pre>
  
        <h3>Browser Extension</h3>
        <pre><code>if (window.sayman) {
    const accounts = await window.sayman.requestAccounts();
    console.log('Connected accounts:', accounts);
  }</code></pre>
      `
    },
    'first-transaction': {
      title: 'Your First Transaction',
      content: `
        <h2>Your First Transaction</h2>
        <p>Learn how to send your first transaction on SAYMAN.</p>
  
        <h3>JavaScript</h3>
        <pre><code>const { Wallet, Transaction } = require('@sayman/sdk');
  
  const wallet = new Wallet('your-private-key');
  const tx = new Transaction()
    .from(wallet.address)
    .to('0x...recipient...')
    .amount('10.0')
    .gas(21000);
  
  await tx.sign(wallet);
  const result = await tx.broadcast();
  console.log('Transaction hash:', result.hash);</code></pre>
  
        <div class="note">
          <strong>✅ Success:</strong> Your transaction will be confirmed in seconds!
        </div>
      `
    },
    'deploy-contract': {
      title: 'Deploy Contract',
      content: `
        <h2>Deploy Your First Contract</h2>
        <p>Deploy a smart contract on SAYMAN Blockchain.</p>
  
        <h3>JavaScript</h3>
        <pre><code>const { Wallet, Contract } = require('@sayman/sdk');
  
  const wallet = new Wallet('your-private-key');
  const contract = new Contract(bytecode, abi);
  
  const deployed = await contract.deploy(wallet, args);
  console.log('Contract address:', deployed.address);</code></pre>
  
        <h3>Solidity Example</h3>
        <pre><code>pragma solidity ^0.8.0;
  
  contract HelloWorld {
      string public greeting = "Hello, SAYMAN!";
  }</code></pre>
      `
    },
    'javascript-sdk': {
      title: 'JavaScript SDK',
      content: `
        <h2>JavaScript SDK</h2>
        <p>Build SAYMAN applications with JavaScript.</p>
  
        <h3>Installation</h3>
        <pre><code>npm install @sayman/sdk</code></pre>
  
        <h3>Quick Start</h3>
        <pre><code>const { SAYMAN } = require('@sayman/sdk');
  
  const client = new SAYMAN('https://testnet.sayman.io');
  const block = await client.getBlock('latest');
  console.log('Latest block:', block.number);</code></pre>
  
        <div class="download-grid">
          <div class="download-item">
            <i class="fab fa-js"></i>
            <span class="download-name">JavaScript SDK</span>
            <span class="download-size">NPM Package</span>
            <a href="/downloads/sdk-js" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fab fa-github"></i>
            <span class="download-name">GitHub Repository</span>
            <span class="download-size">Open Source</span>
            <a href="https://github.com/saymanlabs/sdk-js" class="download-btn" target="_blank"><i class="fab fa-github"></i> View</a>
          </div>
        </div>
      `
    },
    'python-sdk': {
      title: 'Python SDK',
      content: `
        <h2>Python SDK</h2>
        <p>Python developers can build SAYMAN applications with ease.</p>
  
        <h3>Installation</h3>
        <pre><code>pip install sayman-sdk</code></pre>
  
        <h3>Quick Start</h3>
        <pre><code>from sayman import SAYMAN
  
  client = SAYMAN('https://testnet.sayman.io')
  block = client.get_block('latest')
  print(f'Block height: {block.height}')</code></pre>
  
        <div class="download-grid">
          <div class="download-item">
            <i class="fab fa-python"></i>
            <span class="download-name">Python SDK</span>
            <span class="download-size">PyPI Package</span>
            <a href="/downloads/sdk-py" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
        </div>
      `
    },
    'go-sdk': {
      title: 'Go SDK',
      content: `
        <h2>Go SDK</h2>
        <p>High-performance Go SDK for SAYMAN blockchain.</p>
  
        <h3>Installation</h3>
        <pre><code>go get github.com/saymanlabs/sayman-sdk-go</code></pre>
  
        <h3>Quick Start</h3>
        <pre><code>package main
  
  import (
      "fmt"
      "github.com/saymanlabs/sayman-sdk-go"
  )
  
  func main() {
      client := sayman.NewClient("https://testnet.sayman.io")
      block, _ := client.GetBlock("latest")
      fmt.Printf("Block: %d\\n", block.Number)
  }</code></pre>
      `
    },
    'rust-sdk': {
      title: 'Rust SDK',
      content: `
        <h2>Rust SDK</h2>
        <p>Build with Rust for maximum performance and safety.</p>
  
        <h3>Installation</h3>
        <pre><code>cargo add sayman-sdk</code></pre>
  
        <h3>Quick Start</h3>
        <pre><code>use sayman_sdk::SAYMAN;
  
  #[tokio::main]
  async fn main() -> Result<(), Box<dyn std::error::Error>> {
      let client = SAYMAN::new("https://testnet.sayman.io");
      let block = client.get_block("latest").await?;
      println!("Block: {}", block.number);
      Ok(())
  }</code></pre>
      `
    },
    'testnet-rpc': {
      title: 'Testnet RPC',
      content: `
        <h2>Testnet RPC</h2>
        <p>Connect to SAYMAN Testnet.</p>
  
        <h3>RPC Endpoint</h3>
        <pre><code>https://testnet.sayman.io/rpc</code></pre>
  
        <h3>Example Request</h3>
        <pre><code>curl -X POST https://testnet.sayman.io/rpc \\
    -H "Content-Type: application/json" \\
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'</code></pre>
  
        <h3>WebSocket</h3>
        <pre><code>wss://testnet.sayman.io/ws</code></pre>
  
        <div class="note">
          <strong>🔄 Ready:</strong> Copy any endpoint with the copy button.
        </div>
      `
    },
    'rest-api': {
      title: 'REST API',
      content: `
        <h2>REST API</h2>
        <p>RESTful endpoints for blockchain data.</p>
  
        <h3>Get Block</h3>
        <pre><code>GET /api/block/:number</code></pre>
  
        <h3>Get Balance</h3>
        <pre><code>GET /api/balance/:address</code></pre>
  
        <h3>Get Validators</h3>
        <pre><code>GET /api/validators</code></pre>
  
        <div class="note">
          <strong>📖 All endpoints:</strong> Full API reference available in the API Reference section.
        </div>
      `
    },
    'json-rpc': {
      title: 'JSON RPC',
      content: `
        <h2>JSON RPC API</h2>
        <p>Standard JSON RPC interface for blockchain interaction.</p>
  
        <h3>Supported Methods</h3>
        <ul>
          <li><code>eth_blockNumber</code> - Get current block height</li>
          <li><code>eth_getBlockByNumber</code> - Get block by number</li>
          <li><code>eth_getTransactionByHash</code> - Get transaction details</li>
          <li><code>eth_getBalance</code> - Get account balance</li>
          <li><code>eth_sendTransaction</code> - Send a transaction</li>
          <li><code>eth_call</code> - Call a contract</li>
        </ul>
      `
    },
    'websocket': {
      title: 'WebSocket',
      content: `
        <h2>WebSocket API</h2>
        <p>Real-time blockchain data streaming.</p>
  
        <h3>Connection</h3>
        <pre><code>ws://testnet.sayman.io/ws</code></pre>
  
        <h3>Subscribe to Blocks</h3>
        <pre><code>{"method": "subscribe", "channel": "blocks"}</code></pre>
  
        <h3>Subscribe to Transactions</h3>
        <pre><code>{"method": "subscribe", "channel": "transactions"}</code></pre>
      `
    },
    'downloads': {
      title: 'Downloads',
      content: `
        <h2>Downloads</h2>
        <p>All SAYMAN downloads in one place.</p>
  
        <div class="download-grid">
          <div class="download-item">
            <i class="fab fa-android"></i>
            <span class="download-name">Android Wallet APK</span>
            <span class="download-size">15.2 MB</span>
            <a href="/downloads/android" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fas fa-windows"></i>
            <span class="download-name">Windows Wallet</span>
            <span class="download-size">24.8 MB</span>
            <a href="/downloads/windows" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fab fa-apple"></i>
            <span class="download-name">Mac Wallet</span>
            <span class="download-size">22.1 MB</span>
            <a href="/downloads/mac" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fab fa-linux"></i>
            <span class="download-name">Linux Wallet</span>
            <span class="download-size">18.6 MB</span>
            <a href="/downloads/linux" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fas fa-code"></i>
            <span class="download-name">CLI Tool</span>
            <span class="download-size">12.3 MB</span>
            <a href="/downloads/cli" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fas fa-file"></i>
            <span class="download-name">Genesis File</span>
            <span class="download-size">8.4 MB</span>
            <a href="/downloads/genesis" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
        </div>
  
        <div class="note">
          <strong>📦 All downloads:</strong> Files are hosted on our CDN for fast download.
        </div>
      `
    },
    'discord': {
      title: 'Discord Community',
      content: `
        <h2>Join our Discord</h2>
        <p>Connect with the SAYMAN community on Discord.</p>
  
        <a href="https://discord.gg/sayman" class="btn btn-primary" target="_blank" style="margin: 1rem 0;">
          <i class="fab fa-discord"></i> Join Discord
        </a>
  
        <h3>What you'll find</h3>
        <ul>
          <li>Developer discussions and support</li>
          <li>Project announcements and updates</li>
          <li>Community events and meetups</li>
          <li>Bug reporting and feature requests</li>
          <li>Collaboration opportunities</li>
        </ul>
      `
    },
    'telegram': {
      title: 'Telegram Community',
      content: `
        <h2>Join our Telegram</h2>
        <p>Stay connected with the SAYMAN community on Telegram.</p>
  
        <a href="https://t.me/sayman" class="btn btn-primary" target="_blank" style="margin: 1rem 0;">
          <i class="fab fa-telegram"></i> Join Telegram
        </a>
  
        <h3>Channel features</h3>
        <ul>
          <li>Real-time announcements</li>
          <li>Community discussions</li>
          <li>Technical support</li>
          <li>Project updates</li>
        </ul>
      `
    },
    'twitter': {
      title: 'X (Twitter)',
      content: `
        <h2>Follow us on X</h2>
        <p>Get the latest updates and announcements.</p>
  
        <a href="https://twitter.com/sayman" class="btn btn-primary" target="_blank" style="margin: 1rem 0;">
          <i class="fab fa-twitter"></i> Follow @SAYMAN
        </a>
  
        <h3>What we share</h3>
        <ul>
          <li>Development updates</li>
          <li>Network status</li>
          <li>Community highlights</li>
          <li>Ecosystem news</li>
        </ul>
      `
    },
    'github': {
      title: 'GitHub',
      content: `
        <h2>GitHub Repository</h2>
        <p>All SAYMAN code is open source.</p>
  
        <a href="https://github.com/saymanlabs" class="btn btn-primary" target="_blank" style="margin: 1rem 0;">
          <i class="fab fa-github"></i> View GitHub
        </a>
  
        <h3>Repositories</h3>
        <ul>
          <li><a href="#" style="color:var(--primary);">Core Blockchain</a> - The main node implementation</li>
          <li><a href="#" style="color:var(--primary);">SDK</a> - Developer SDKs</li>
          <li><a href="#" style="color:var(--primary);">Wallet</a> - Desktop and mobile wallets</li>
          <li><a href="#" style="color:var(--primary);">Explorer</a> - Blockchain explorer</li>
          <li><a href="#" style="color:var(--primary);">Contracts</a> - Smart contract examples</li>
        </ul>
      `
    },
    'android-apk': {
      title: 'Android Wallet APK',
      content: `
        <h2>Android Wallet APK</h2>
        <p>Download the SAYMAN wallet for Android.</p>
  
        <div class="download-grid">
          <div class="download-item">
            <i class="fab fa-android"></i>
            <span class="download-name">Android Wallet APK</span>
            <span class="download-size">15.2 MB</span>
            <a href="/downloads/android" class="download-btn"><i class="fas fa-download"></i> Download</a>
          </div>
          <div class="download-item">
            <i class="fab fa-google-play"></i>
            <span class="download-name">Google Play</span>
            <span class="download-size">Coming Soon</span>
            <a href="#" class="download-btn" style="opacity:0.5;cursor:not-allowed;"><i class="fas fa-clock"></i> Coming Soon</a>
          </div>
        </div>
  
        <h3>Features</h3>
        <ul>
          <li>Secure key storage</li>
          <li>Send and receive SAYN</li>
          <li>Manage multiple accounts</li>
          <li>View transaction history</li>
          <li>DApp browser</li>
        </ul>
  
        <div class="note">
          <strong>📱 Installation:</strong> Download the APK and install on your Android device.
        </div>
      `
    },
    'become-validator': {
      title: 'Become a Validator',
      content: `
        <h2>Become a SAYMAN Validator</h2>
        <p>Secure the network and earn rewards by becoming a validator.</p>
  
        <h3>Requirements</h3>
        <ul>
          <li>Minimum 1,000,000 SAYN stake</li>
          <li>24/7 node operation</li>
          <li>Secure infrastructure</li>
          <li>Community participation</li>
          <li>Technical expertise</li>
        </ul>
  
        <h3>Setup Guide</h3>
        <pre><code># Install SAYMAN node
  wget https://sayman.io/node-install.sh
  chmod +x node-install.sh
  ./node-install.sh
  
  # Configure validator
  sayman-cli validator init --stake 1000000
  
  # Start validation
  sayman-cli validator start</code></pre>
  
        <div class="tip">
          <strong>💡 Tip:</strong> Start with our <a href="#run-validator" style="color:var(--primary);">Validator Setup Guide</a> for detailed instructions.
        </div>
      `
    }
  };
  
  // ── State ──────────────────────────────────────────────────────────────────
  let currentSection = 'overview';
  
  // ── Initialize ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderContent('overview');
    updateActiveNav('overview');
    updateTOC('overview');
  });
  
  // ── Render Content ────────────────────────────────────────────────────────
  function renderContent(sectionId) {
    const data = DOCS_DATA[sectionId];
    if (!data) return;
  
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
    // Close mobile sidebar
    document.getElementById('docsSidebar').classList.remove('open');
    
    // Smooth scroll to top
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
    if (!data) return;
  
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
    const results = [];
  
    if (!query) {
      renderContent(currentSection);
      return;
    }
  
    for (const [id, data] of Object.entries(DOCS_DATA)) {
      if (data.title.toLowerCase().includes(query) || 
          data.content.toLowerCase().includes(query)) {
        results.push({ id, title: data.title });
      }
    }
  
    if (results.length === 0) {
      const container = document.getElementById('docsContent');
      container.innerHTML = `
        <div style="padding: 4rem 0; text-align: center;">
          <h2 style="color: var(--mono-1000);">No results found</h2>
          <p style="color: var(--mono-500);">Try a different search term</p>
        </div>
      `;
      return;
    }
  
    const container = document.getElementById('docsContent');
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
            " onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--mono-300)'">
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
    // Cmd+K or Ctrl+K for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('docsSearch').focus();
    }
    
    // Escape to close sidebar
    if (e.key === 'Escape') {
      document.getElementById('docsSidebar').classList.remove('open');
    }
  });