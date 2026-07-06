// ── Navigation Data ──────────────────────────────────────────────────────
const NAV_SECTIONS = [
    {
      title: 'Overview',
      links: [
        { id: 'overview', icon: 'fa-home', label: 'Introduction' },
        { id: 'why-sayman', icon: 'fa-question-circle', label: 'Why SAYMAN' },
        { id: 'architecture', icon: 'fa-sitemap', label: 'Architecture' },
        { id: 'roadmap', icon: 'fa-road', label: 'Roadmap' },
        { id: 'faq', icon: 'fa-question', label: 'FAQ' },
        { id: 'whitepaper', icon: 'fa-file-pdf', label: 'Whitepaper' }
      ]
    },
    {
      title: 'Getting Started',
      links: [
        { id: 'install-sdk', icon: 'fa-download', label: 'Install SDK' },
        { id: 'create-wallet', icon: 'fa-wallet', label: 'Create Wallet' },
        { id: 'get-test-tokens', icon: 'fa-tint', label: 'Get Test Tokens' },
        { id: 'connect-wallet', icon: 'fa-plug', label: 'Connect Wallet' },
        { id: 'first-transaction', icon: 'fa-paper-plane', label: 'First Transaction' },
        { id: 'deploy-contract', icon: 'fa-file-contract', label: 'Deploy Contract' }
      ]
    },
    {
      title: 'Wallet',
      links: [
        { id: 'wallet-overview', icon: 'fa-wallet', label: 'Overview' },
        { id: 'android-apk', icon: 'fa-android', label: 'Android APK' },
        { id: 'desktop-wallet', icon: 'fa-desktop', label: 'Desktop Wallet' },
        { id: 'browser-extension', icon: 'fa-puzzle-piece', label: 'Browser Extension' },
        { id: 'wallet-security', icon: 'fa-shield-alt', label: 'Security' }
      ]
    },
    {
      title: 'SDK',
      links: [
        { id: 'javascript-sdk', icon: 'fa-js', label: 'JavaScript SDK' },
        { id: 'python-sdk', icon: 'fa-python', label: 'Python SDK' },
        { id: 'go-sdk', icon: 'fa-golang', label: 'Go SDK' },
        { id: 'rust-sdk', icon: 'fa-crab', label: 'Rust SDK' }
      ]
    },
    {
      title: 'RPC API',
      links: [
        { id: 'testnet-rpc', icon: 'fa-server', label: 'Testnet RPC' },
        { id: 'rest-api', icon: 'fa-code', label: 'REST API' },
        { id: 'json-rpc', icon: 'fa-code-branch', label: 'JSON RPC' },
        { id: 'websocket', icon: 'fa-bolt', label: 'WebSocket' }
      ]
    },
    {
      title: 'API Reference',
      links: [
        { id: 'get-block', icon: 'fa-cube', label: 'Get Block' },
        { id: 'get-blocks', icon: 'fa-cubes', label: 'Get Blocks' },
        { id: 'get-transaction', icon: 'fa-exchange-alt', label: 'Get Transaction' },
        { id: 'get-balance', icon: 'fa-coins', label: 'Get Balance' },
        { id: 'get-validators', icon: 'fa-user-check', label: 'Get Validators' },
        { id: 'get-contracts', icon: 'fa-file-contract', label: 'Get Contracts' }
      ]
    },
    {
      title: 'Smart Contracts',
      links: [
        { id: 'contracts-overview', icon: 'fa-file-contract', label: 'Overview' },
        { id: 'deploy-contract-doc', icon: 'fa-rocket', label: 'Deploy Contract' },
        { id: 'call-contract', icon: 'fa-phone', label: 'Call Contract' },
        { id: 'contract-standards', icon: 'fa-list', label: 'Contract Standards' }
      ]
    },
    {
      title: 'Node',
      links: [
        { id: 'run-full-node', icon: 'fa-server', label: 'Run Full Node' },
        { id: 'run-validator', icon: 'fa-user-check', label: 'Run Validator' },
        { id: 'docker-setup', icon: 'fa-docker', label: 'Docker Setup' },
        { id: 'node-configuration', icon: 'fa-cog', label: 'Configuration' }
      ]
    },
    {
      title: 'Testnet',
      links: [
        { id: 'chain-info', icon: 'fa-info-circle', label: 'Chain Information' },
        { id: 'faucet', icon: 'fa-tint', label: 'Faucet' },
        { id: 'genesis-file', icon: 'fa-file', label: 'Genesis File' }
      ]
    },
    {
      title: 'Validators',
      links: [
        { id: 'become-validator', icon: 'fa-user-plus', label: 'Become Validator' },
        { id: 'staking', icon: 'fa-coins', label: 'Staking' },
        { id: 'rewards', icon: 'fa-gift', label: 'Rewards' },
        { id: 'slashing', icon: 'fa-exclamation-triangle', label: 'Slashing' }
      ]
    },
    {
      title: 'Tokenomics',
      links: [
        { id: 'token-supply', icon: 'fa-coins', label: 'Token Supply' },
        { id: 'staking-tokenomics', icon: 'fa-chart-line', label: 'Staking' },
        { id: 'inflation', icon: 'fa-chart-line', label: 'Inflation' },
        { id: 'gas', icon: 'fa-gas-pump', label: 'Gas' }
      ]
    },
    {
      title: 'Hackathon',
      links: [
        { id: 'hackathon-overview', icon: 'fa-trophy', label: 'Overview' },
        { id: 'hackathon-tracks', icon: 'fa-code-branch', label: 'Tracks' },
        { id: 'hackathon-rules', icon: 'fa-gavel', label: 'Rules' },
        { id: 'hackathon-prize', icon: 'fa-award', label: 'Prize Pool' }
      ]
    },
    {
      title: 'Ecosystem',
      links: [
        { id: 'ecosystem-projects', icon: 'fa-project-diagram', label: 'Projects' },
        { id: 'ecosystem-wallets', icon: 'fa-wallet', label: 'Wallets' },
        { id: 'ecosystem-dex', icon: 'fa-chart-bar', label: 'DEX' },
        { id: 'ecosystem-ai', icon: 'fa-brain', label: 'AI' }
      ]
    },
    {
      title: 'Security',
      links: [
        { id: 'security-best-practices', icon: 'fa-shield-alt', label: 'Best Practices' },
        { id: 'bug-reporting', icon: 'fa-bug', label: 'Bug Reporting' },
        { id: 'audits', icon: 'fa-check-double', label: 'Audits' }
      ]
    },
    {
      title: 'Downloads',
      links: [
        { id: 'downloads', icon: 'fa-download', label: 'All Downloads' },
        { id: 'android-apk', icon: 'fa-android', label: 'Android APK' },
        { id: 'desktop-wallet-dl', icon: 'fa-desktop', label: 'Desktop Wallet' },
        { id: 'cli', icon: 'fa-terminal', label: 'CLI' }
      ]
    },
    {
      title: 'Community',
      links: [
        { id: 'discord', icon: 'fa-discord', label: 'Discord' },
        { id: 'telegram', icon: 'fa-telegram', label: 'Telegram' },
        { id: 'twitter', icon: 'fa-twitter', label: 'X (Twitter)' },
        { id: 'github', icon: 'fa-github', label: 'GitHub' }
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
          <strong>💡 Tip:</strong> Start with our Installation Guide to set up your development environment.
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
          <strong>🚀 Ready to Build?</strong> Join our Genesis Hackathon and start building today!
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
          <li>Visit SAYMAN Faucet</li>
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
    }
    // Add more sections as needed...
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
      // Show fallback content
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('docsSearch').focus();
    }
    if (e.key === 'Escape') {
      document.getElementById('docsSidebar').classList.remove('open');
    }
  });