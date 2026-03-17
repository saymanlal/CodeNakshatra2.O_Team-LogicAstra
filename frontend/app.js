let currentWallet = null;
let apiBase = window.location.origin + '/api';
let networkConfig = null;
let currentPage = 1;
let blocksPerPage = 20;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadNetworkConfig();
  await updateHeaderInfo(); // ✅ NEW
  loadWallet();
  updateStats();
  updateLiveBlocks(); // ✅ NEW - Call immediately
  setInterval(updateStats, 3000);
  setInterval(updateHeaderInfo, 5000); // ✅ NEW
  setInterval(updateLiveBlocks, 5000);
});

// Load network configuration
async function loadNetworkConfig() {
  try {
    const res = await fetch(`${apiBase}/network`);
    networkConfig = await res.json();
    
    // Update network banner
    const banner = document.getElementById('network-banner');
    const networkName = document.getElementById('network-name');
    const chainId = document.getElementById('chain-id');
    
    networkName.textContent = networkConfig.network;
    chainId.textContent = `Chain ID: ${networkConfig.chainId}`;
    
    if (networkConfig.faucetEnabled) {
      banner.classList.add('testnet');
      banner.style.background = '#f59e0b';
    } else {
      banner.classList.add('mainnet');
      banner.style.background = '#10b981';
      // Hide faucet nav button on mainnet
      document.getElementById('faucet-nav').style.display = 'none';
    }
    
    // Update footer
    document.getElementById('footer-network').textContent = networkConfig.network;
    document.getElementById('footer-chain').textContent = networkConfig.chainId;
    
  } catch (error) {
    console.error('Error loading network config:', error);
  }
}

// ✅ NEW FUNCTION: Update header information
async function updateHeaderInfo() {
  try {
    const res = await fetch(`${apiBase}/network/stats`);
    const data = await res.json();
    
    document.getElementById('header-network').textContent = data.network || 'Unknown';
    document.getElementById('header-chain').textContent = data.chainId || 'Unknown';
    document.getElementById('header-node').textContent = data.nodeId ? data.nodeId.substring(0, 16) + '...' : 'Unknown';
    document.getElementById('header-mode').textContent = data.mode ? data.mode.toUpperCase() : 'Unknown';
  } catch (error) {
    console.error('Error updating header:', error);
    document.getElementById('header-network').textContent = 'Connection Error';
    document.getElementById('header-chain').textContent = 'Check Console (F12)';
    document.getElementById('header-node').textContent = 'Press F12';
    document.getElementById('header-mode').textContent = 'Error';
  }
}

// Navigation
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');

  if (pageId === 'explorer') {
    loadBlocks();
  } else if (pageId === 'validators') {
    loadValidators();
  } else if (pageId === 'contracts') {
    loadContracts();
  }
}

// Update stats
async function updateStats() {
  try {
    const res = await fetch(`${apiBase}/stats`);
    const stats = await res.json();

    // Animate counter updates
    animateValue('stat-blocks', stats.blocks);
    animateValue('stat-validators', stats.validators);
    document.getElementById('stat-stake').textContent = stats.totalStake + ' SAYM';
    animateValue('stat-mempool', stats.mempool);
    animateValue('stat-contracts', stats.contracts);
    document.getElementById('stat-reward').textContent = stats.blockReward + ' SAYM';
    document.getElementById('stat-blocktime').textContent = (stats.blockTime / 1000).toFixed(1);
    
    // Get APR from validators endpoint
    const validatorsRes = await fetch(`${apiBase}/validators`);
    const validatorsData = await validatorsRes.json();
    document.getElementById('stat-apr').textContent = validatorsData.estimatedAPR + '%';

    if (currentWallet) {
      const balanceRes = await fetch(`${apiBase}/balance/${currentWallet.address}`);
      const balanceData = await balanceRes.json();
      document.getElementById('wallet-balance').textContent = balanceData.balance + ' SAYM';
      document.getElementById('wallet-staked').textContent = balanceData.stake + ' SAYM';
    }

  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Animate counter
function animateValue(id, value) {
  const element = document.getElementById(id);
  const current = parseInt(element.textContent) || 0;
  
  if (current !== value) {
    element.style.transform = 'scale(1.1)';
    element.textContent = value;
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, 200);
  }
}

// Update live blocks
// ✅ FIXED: Update live blocks with proper date formatting
async function updateLiveBlocks() {
  try {
    const res = await fetch(`${apiBase}/blocks?limit=10`);
    const data = await res.json();
    
    const feed = document.getElementById('block-feed');
    if (!feed) return; // Guard clause
    
    feed.innerHTML = '';
    
    // ✅ FIX: Reverse to show newest first
    const blocks = data.blocks.reverse();
    
    blocks.slice(0, 10).forEach(block => {
      const item = document.createElement('div');
      item.className = 'block-item';
      
      // ✅ FIX: Format timestamp properly
      const date = new Date(block.timestamp);
      const timeStr = date.toLocaleString();
      
      item.innerHTML = `
        <div class="block-index">#${block.index}</div>
        <div class="block-hash">${block.hash}</div>
        <div class="block-time">${timeStr}</div>
      `;
      
      feed.appendChild(item);
    });
  } catch (error) {
    console.error('Error updating block feed:', error);
  }
}

// Explorer functions
function showExplorerTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.explorer-tab').forEach(t => t.classList.remove('active'));
  
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`explorer-${tab}`).classList.add('active');
  
  if (tab === 'blocks') {
    loadBlocks();
  } else if (tab === 'transactions') {
    loadRecentTransactions();
  }
}

// ✅ FIXED: Load explorer blocks with proper ordering and dates
async function loadBlocks(page = 1) {
  try {
    const res = await fetch(`${apiBase}/blocks?page=${page}&limit=${blocksPerPage}`);
    const data = await res.json();
    
    const tbody = document.getElementById('explorer-blocks');
    if (!tbody) return; // Guard clause
    
    tbody.innerHTML = '';
    
    if (data.blocks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No blocks found</td></tr>';
      return;
    }
    
    // ✅ FIX: Reverse to show newest first
    const blocks = data.blocks.reverse();
    
    blocks.forEach(block => {
      const row = document.createElement('tr');
      
      // ✅ FIX: Format timestamp properly
      const date = new Date(block.timestamp);
      const timeStr = date.toLocaleString();
      
      // Calculate total gas used
      let gasUsed = 0;
      if (block.transactions) {
        block.transactions.forEach(tx => {
          if (tx.gasUsed) gasUsed += tx.gasUsed;
        });
      }
      
      row.innerHTML = `
        <td>#${block.index}</td>
        <td class="mono">${block.hash.substring(0, 16)}...</td>
        <td class="mono">${block.validator ? block.validator.substring(0, 16) + '...' : 'N/A'}</td>
        <td>${block.transactions ? block.transactions.length : 0}</td>
        <td>${gasUsed}</td>
        <td>${timeStr}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Pagination
    renderPagination(data.page, data.totalPages);
    currentPage = page;
    
  } catch (error) {
    console.error('Error loading blocks:', error);
  }
}

function renderPagination(current, total) {
  const pagination = document.getElementById('blocks-pagination');
  pagination.innerHTML = '';
  
  if (total <= 1) return;
  
  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '← Previous';
  prevBtn.disabled = current === 1;
  prevBtn.onclick = () => loadBlocks(current - 1);
  pagination.appendChild(prevBtn);
  
  // Page numbers
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i;
    pageBtn.className = i === current ? 'active' : '';
    pageBtn.onclick = () => loadBlocks(i);
    pagination.appendChild(pageBtn);
  }
  
  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next →';
  nextBtn.disabled = current === total;
  nextBtn.onclick = () => loadBlocks(current + 1);
  pagination.appendChild(nextBtn);
}

async function viewBlock(index) {
  try {
    const res = await fetch(`${apiBase}/blocks/${index}`);
    const block = await res.json();
    
    const searchResult = document.getElementById('search-result');
    searchResult.innerHTML = `
      <div class="block-item">
        <h3>Block #${block.index}</h3>
        <p><strong>Hash:</strong> ${block.hash}</p>
        <p><strong>Previous Hash:</strong> ${block.previousHash}</p>
        <p><strong>Validator:</strong> ${block.validator}</p>
        <p><strong>Chain ID:</strong> ${block.chainId || 'N/A'}</p>
        <p><strong>Timestamp:</strong> ${new Date(block.timestamp).toLocaleString()}</p>
        <h4>Transactions (${block.transactions.length})</h4>
        ${block.transactions.map(tx => `
          <div style="margin-left: 1rem; padding: 0.5rem; background: var(--darker); border-radius: 8px; margin-top: 0.5rem;">
            <p><strong>Type:</strong> ${tx.type}</p>
            <p><strong>ID:</strong> ${tx.id}</p>
            ${tx.data.from ? `<p><strong>From:</strong> ${tx.data.from}</p>` : ''}
            ${tx.data.to ? `<p><strong>To:</strong> ${tx.data.to}</p>` : ''}
            ${tx.data.amount ? `<p><strong>Amount:</strong> ${tx.data.amount} SAYM</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    searchResult.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showResult('search', 'Block not found', 'error');
  }
}

async function loadRecentTransactions() {
  try {
    const res = await fetch(`${apiBase}/blocks?limit=10`);
    const data = await res.json();
    
    const list = document.getElementById('transactions-list');
    list.innerHTML = '';
    
    const transactions = [];
    data.blocks.reverse().forEach(block => {
      block.transactions.forEach(tx => {
        transactions.push({
          ...tx,
          blockIndex: block.index,
          blockHash: block.hash,
          timestamp: block.timestamp
        });
      });
    });
    
    if (transactions.length === 0) {
      list.innerHTML = '<p>No recent transactions</p>';
      return;
    }
    
    transactions.slice(0, 50).forEach(tx => {
      const div = document.createElement('div');
      div.className = 'block-item';
      div.innerHTML = `
        <h4>${tx.type} Transaction</h4>
        <p>ID: ${tx.id}</p>
        <p>Block: #${tx.blockIndex}</p>
        ${tx.data.from ? `<p>From: ${tx.data.from.substring(0, 16)}...</p>` : ''}
        ${tx.data.to ? `<p>To: ${tx.data.to.substring(0, 16)}...</p>` : ''}
        ${tx.data.amount ? `<p>Amount: ${tx.data.amount} SAYM</p>` : ''}
        <p>Time: ${new Date(tx.timestamp).toLocaleString()}</p>
      `;
      list.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading transactions:', error);
  }
}

async function searchBlockchain() {
  const query = document.getElementById('search-input').value.trim();
  
  if (!query) {
    showResult('search', 'Please enter a search term', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${apiBase}/search/${encodeURIComponent(query)}`);
    
    if (!res.ok) {
      showResult('search', 'Not found', 'error');
      return;
    }
    
    const data = await res.json();
    const searchResult = document.getElementById('search-result');
    
    if (data.type === 'block') {
      viewBlock(data.result.index);
    } else if (data.type === 'transaction') {
      searchResult.innerHTML = `
        <div class="block-item">
          <h3>Transaction Found</h3>
          <p><strong>Type:</strong> ${data.result.type}</p>
          <p><strong>ID:</strong> ${data.result.id}</p>
          <p><strong>Block:</strong> #${data.result.blockIndex}</p>
          ${data.result.data.from ? `<p><strong>From:</strong> ${data.result.data.from}</p>` : ''}
          ${data.result.data.to ? `<p><strong>To:</strong> ${data.result.data.to}</p>` : ''}
          ${data.result.data.amount ? `<p><strong>Amount:</strong> ${data.result.data.amount} SAYM</p>` : ''}
        </div>
      `;
    } else if (data.type === 'address') {
      window.location.href = `#address-${data.result}`;
      viewAddress(data.result);
    }
    
  } catch (error) {
    showResult('search', 'Error searching: ' + error.message, 'error');
  }
}

async function viewAddress(address) {
  try {
    const res = await fetch(`${apiBase}/address/${address}`);
    const data = await res.json();
    
    const searchResult = document.getElementById('search-result');
    searchResult.innerHTML = `
      <div class="block-item">
        <h3>Address Details</h3>
        <p><strong>Address:</strong> ${data.address}</p>
        <p><strong>Balance:</strong> ${data.balance} SAYM</p>
        <p><strong>Staked:</strong> ${data.stake} SAYM</p>
        ${data.isValidator ? '<p><strong>Status:</strong> Validator ✅</p>' : ''}
        <h4>Transaction History (${data.transactions.length})</h4>
        ${data.transactions.slice(0, 10).map(tx => `
          <div style="margin-left: 1rem; padding: 0.5rem; background: var(--darker); border-radius: 8px; margin-top: 0.5rem;">
            <p><strong>Type:</strong> ${tx.type}</p>
            <p><strong>Block:</strong> #${tx.blockIndex}</p>
            <p><strong>Time:</strong> ${new Date(tx.timestamp).toLocaleString()}</p>
          </div>
        `).join('')}
      </div>
    `;
    searchResult.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showResult('search', 'Address not found', 'error');
  }
}

// ... (Part 1 above)

// Validators
async function loadValidators() {
  try {
    const res = await fetch(`${apiBase}/validators`);
    const data = await res.json();

    document.getElementById('total-validators').textContent = data.totalValidators;
    document.getElementById('total-stake-val').textContent = data.totalStake + ' SAYM';
    document.getElementById('validator-apr').textContent = data.estimatedAPR + '%';

    const list = document.getElementById('validators-list');
    list.innerHTML = '';

    if (data.validators.length === 0) {
      list.innerHTML = '<p>No validators yet</p>';
      return;
    }

    data.validators.forEach(v => {
      const div = document.createElement('div');
      div.className = 'validator-item';
      div.innerHTML = `
        <div>
          <span class="address">${v.address.substring(0, 20)}...</span>
          ${v.isActive !== false ? '<span style="color: var(--success)">● Active</span>' : '<span style="color: var(--danger)">● Inactive</span>'}
        </div>
        <div>
          <strong>Stake:</strong> ${v.stake} SAYM (${v.percentage}%)
        </div>
        <div>
          <strong>Missed:</strong> ${v.missedBlocks || 0}
        </div>
        <div>
          ${v.slashed ? '<span style="color: var(--danger)">⚠️ Slashed</span>' : '<span style="color: var(--success)">✓ Good</span>'}
        </div>
      `;
      div.onclick = () => viewAddress(v.address);
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading validators:', error);
  }
}

// Wallet functions - CLIENT-SIDE GENERATION
async function createWallet() {
  try {
    showLoading('Creating wallet...');
    
    const wallet = new SaymanWallet();
    await wallet.initialize();
    
    currentWallet = wallet.export();
    saveWallet(currentWallet);
    displayWallet();
    
    hideLoading();
    showResult('wallet', '✅ Wallet created CLIENT-SIDE! Your private key never left your browser. Save it securely!', 'success');
  } catch (error) {
    hideLoading();
    showResult('wallet', 'Error creating wallet: ' + error.message, 'error');
  }
}

async function importWallet() {
  const privateKey = prompt('Enter your private key:');
  if (privateKey) {
    try {
      showLoading('Importing wallet...');
      
      const wallet = new SaymanWallet(privateKey);
      await wallet.initialize();
      
      currentWallet = wallet.export();
      saveWallet(currentWallet);
      displayWallet();
      
      hideLoading();
      showResult('wallet', '✅ Wallet imported successfully!', 'success');
    } catch (error) {
      hideLoading();
      showResult('wallet', 'Invalid private key', 'error');
    }
  }
}

function displayWallet() {
  if (currentWallet) {
    document.getElementById('wallet-info').classList.remove('hidden');
    document.getElementById('wallet-address').value = currentWallet.address;
    document.getElementById('wallet-key').value = currentWallet.privateKey;
  }
}

function toggleKey() {
  const keyInput = document.getElementById('wallet-key');
  const btn = event.target;
  if (keyInput.type === 'password') {
    keyInput.type = 'text';
    btn.textContent = 'Hide';
  } else {
    keyInput.type = 'password';
    btn.textContent = 'Show';
  }
}

function copyAddress() {
  const addr = document.getElementById('wallet-address');
  addr.select();
  document.execCommand('copy');
  showNotification('Address copied!');
}

function copyKey() {
  const key = document.getElementById('wallet-key');
  const originalType = key.type;
  key.type = 'text';
  key.select();
  document.execCommand('copy');
  key.type = originalType;
  showNotification('Private key copied!');
}

function saveWallet(wallet) {
  localStorage.setItem('sayman_wallet', JSON.stringify(wallet));
}

function loadWallet() {
  const saved = localStorage.getItem('sayman_wallet');
  if (saved) {
    currentWallet = JSON.parse(saved);
    displayWallet();
  }
}

// Send transaction - CLIENT-SIDE SIGNING
async function sendTransaction() {
  const to = document.getElementById('send-to').value;
  const amount = parseFloat(document.getElementById('send-amount').value);
  const privateKey = document.getElementById('send-key').value;

  if (!to || !amount || !privateKey) {
    showResult('send', 'Please fill all fields', 'error');
    return;
  }

  try {
    showLoading('Signing transaction...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    const txData = {
      type: 'TRANSFER',
      data: { from: wallet.address, to, amount },
      timestamp: Date.now()
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('send', '✅ Transaction signed CLIENT-SIDE and broadcast!', 'success');
      document.getElementById('send-to').value = '';
      document.getElementById('send-amount').value = '';
      document.getElementById('send-key').value = '';
      updateStats();
    } else {
      showResult('send', data.error || 'Transaction failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('send', error.message, 'error');
  }
}

// Stake - CLIENT-SIDE SIGNING
async function stakeTokens() {
  const amount = parseFloat(document.getElementById('stake-amount').value);
  const privateKey = document.getElementById('stake-key').value;

  if (!amount || !privateKey) {
    showResult('stake', 'Please fill all fields', 'error');
    return;
  }

  if (amount < networkConfig.minStake) {
    showResult('stake', `Minimum stake is ${networkConfig.minStake} SAYM`, 'error');
    return;
  }

  try {
    showLoading('Signing stake transaction...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    const txData = {
      type: 'STAKE',
      data: { from: wallet.address, amount },
      timestamp: Date.now()
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('stake', '✅ Stake signed CLIENT-SIDE and broadcast!', 'success');
      document.getElementById('stake-amount').value = '';
      document.getElementById('stake-key').value = '';
      updateStats();
    } else {
      showResult('stake', data.error || 'Staking failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('stake', error.message, 'error');
  }
}

async function unstakeTokens() {
  const privateKey = document.getElementById('unstake-key').value;

  if (!privateKey) {
    showResult('stake', 'Please enter private key', 'error');
    return;
  }

  try {
    showLoading('Signing unstake transaction...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    const txData = {
      type: 'UNSTAKE',
      data: { from: wallet.address },
      timestamp: Date.now()
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('stake', `✅ Unstake initiated! Funds available at block ${data.unlockBlock}`, 'success');
      document.getElementById('unstake-key').value = '';
      updateStats();
    } else {
      showResult('stake', data.error || 'Unstaking failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('stake', error.message, 'error');
  }
}

// Deploy contract - CLIENT-SIDE SIGNING
async function deployContract() {
  const code = document.getElementById('contract-code').value;
  const privateKey = document.getElementById('deploy-key').value;

  if (!code || !privateKey) {
    showResult('contract', 'Please fill all fields', 'error');
    return;
  }

  try {
    showLoading('Signing contract deployment...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    const txData = {
      type: 'CONTRACT_DEPLOY',
      data: { from: wallet.address, code },
      timestamp: Date.now()
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('contract', '✅ Contract deployment signed and broadcast!', 'success');
      document.getElementById('contract-code').value = '';
      document.getElementById('deploy-key').value = '';
      setTimeout(loadContracts, 6000);
    } else {
      showResult('contract', data.error || 'Deploy failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('contract', error.message, 'error');
  }
}

// Call contract - CLIENT-SIDE SIGNING
async function callContract() {
  const contractAddress = document.getElementById('call-address').value;
  const method = document.getElementById('call-method').value;
  const argsText = document.getElementById('call-args').value;
  const privateKey = document.getElementById('call-key').value;

  if (!contractAddress || !method || !privateKey) {
    showResult('contract', 'Please fill required fields', 'error');
    return;
  }

  try {
    showLoading('Signing contract call...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    const args = argsText ? JSON.parse(argsText) : {};
    
    const txData = {
      type: 'CONTRACT_CALL',
      data: { from: wallet.address, contractAddress, method, args },
      timestamp: Date.now()
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('contract', '✅ Contract call signed and broadcast!', 'success');
      document.getElementById('call-address').value = '';
      document.getElementById('call-method').value = '';
      document.getElementById('call-args').value = '';
      document.getElementById('call-key').value = '';
      setTimeout(() => loadContracts(), 6000);
    } else {
      showResult('contract', data.error || 'Call failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('contract', error.message, 'error');
  }
}

// Contracts
async function loadContracts() {
  try {
    const res = await fetch(`${apiBase}/contracts`);
    const data = await res.json();

    const list = document.getElementById('contracts-list');
    list.innerHTML = '';

    if (data.contracts.length === 0) {
      list.innerHTML = '<p>No contracts deployed yet</p>';
      return;
    }

    data.contracts.forEach(contract => {
      const div = document.createElement('div');
      div.className = 'contract-item';
      div.innerHTML = `
        <p><strong>Address:</strong> ${contract.address}</p>
        <p><strong>Creator:</strong> ${contract.creator.substring(0, 16)}...</p>
        <p><strong>State:</strong> <code>${JSON.stringify(contract.state)}</code></p>
        <p><strong>Created:</strong> ${new Date(contract.createdAt).toLocaleString()}</p>
      `;
      div.onclick = () => {
        document.getElementById('call-address').value = contract.address;
        showPage('contracts');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      list.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading contracts:', error);
  }
}

// Faucet
async function claimFaucet() {
  const address = document.getElementById('faucet-address').value.trim();

  if (!address) {
    showResult('faucet', 'Please enter a wallet address', 'error');
    return;
  }

  try {
    showLoading('Requesting faucet...');

    const res = await fetch(`${apiBase}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('faucet', `✅ ${data.amount} SAYM credited (pending in mempool)`, 'success');
      document.getElementById('faucet-address').value = '';
      updateStats();
    } else {
      showResult('faucet', data.error || 'Faucet request failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('faucet', error.message, 'error');
  }
}

// Utility functions
function showResult(page, message, type) {
  const resultDiv = document.getElementById(`${page}-result`);
  if (resultDiv) {
    resultDiv.textContent = message;
    resultDiv.className = `result ${type}`;
    setTimeout(() => {
      resultDiv.textContent = '';
      resultDiv.className = 'result';
    }, 5000);
  }
}

function showLoading(message) {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.textContent = message;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--success);
    color: white;
    padding: 1rem 2rem;
    border-radius: 12px;
    box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ... (existing code from Part 2)

// Gas estimation helper
async function estimateGas(type, data) {
  try {
    const res = await fetch(`${apiBase}/estimate-gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
    return await res.json();
  } catch (error) {
    console.error('Gas estimation error:', error);
    return { estimatedGas: 50000, recommendedGasLimit: 60000, minGasPrice: 1 };
  }
}

// Update sendTransaction to include gas (replace existing)
async function sendTransaction() {
  const to = document.getElementById('send-to').value;
  const amount = parseFloat(document.getElementById('send-amount').value);
  const privateKey = document.getElementById('send-key').value;

  if (!to || !amount || !privateKey) {
    showResult('send', 'Please fill all fields', 'error');
    return;
  }

  try {
    showLoading('Estimating gas...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    // Get nonce
    const addressData = await fetch(`${apiBase}/address/${wallet.address}`);
    const { nonce } = await addressData.json();
    
    // Estimate gas
    const gasEstimate = await estimateGas('TRANSFER', { from: wallet.address, to, amount });
    
    hideLoading();
    showLoading('Signing transaction...');
    
    const txData = {
      type: 'TRANSFER',
      data: { from: wallet.address, to, amount },
      timestamp: Date.now(),
      gasLimit: gasEstimate.recommendedGasLimit,
      gasPrice: gasEstimate.minGasPrice,
      nonce: nonce
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('send', `✅ Transaction broadcast! Gas: ${data.gasLimit} @ ${data.gasPrice} (Max cost: ${data.maxGasCost})`, 'success');
      document.getElementById('send-to').value = '';
      document.getElementById('send-amount').value = '';
      document.getElementById('send-key').value = '';
      updateStats();
    } else {
      showResult('send', data.error || 'Transaction failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('send', error.message, 'error');
  }
}

// Update stakeTokens with gas (replace existing)
async function stakeTokens() {
  const amount = parseFloat(document.getElementById('stake-amount').value);
  const privateKey = document.getElementById('stake-key').value;

  if (!amount || !privateKey) {
    showResult('stake', 'Please fill all fields', 'error');
    return;
  }

  try {
    showLoading('Estimating gas...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    const addressData = await fetch(`${apiBase}/address/${wallet.address}`);
    const { nonce } = await addressData.json();
    
    const gasEstimate = await estimateGas('STAKE', { from: wallet.address, amount });
    
    hideLoading();
    showLoading('Signing stake transaction...');
    
    const txData = {
      type: 'STAKE',
      data: { from: wallet.address, amount },
      timestamp: Date.now(),
      gasLimit: gasEstimate.recommendedGasLimit,
      gasPrice: gasEstimate.minGasPrice,
      nonce: nonce
    };
    
    const signature = await wallet.signTransaction(txData);
    
    const signedTx = {
      ...txData,
      signature: signature,
      publicKey: wallet.publicKey
    };
    
    hideLoading();
    showLoading('Broadcasting...');
    
    const res = await fetch(`${apiBase}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      showResult('stake', `✅ Stake broadcast! Gas: ${data.gasLimit} (Max cost: ${data.maxGasCost})`, 'success');
      document.getElementById('stake-amount').value = '';
      document.getElementById('stake-key').value = '';
      updateStats();
    } else {
      showResult('stake', data.error || 'Staking failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showResult('stake', error.message, 'error');
  }
}

// Similar updates for unstakeTokens, deployContract, callContract...
// (Apply same pattern: fetch nonce, estimate gas, include in txData)

// ... existing code

// Load network stats
// ✅ FIXED: Load network stats
async function loadNetworkStats() {
  try {
    const res = await fetch(`${apiBase}/network/stats`);
    const data = await res.json();
    
    // Update stat cards
    document.getElementById('net-peers').textContent = data.peers || 0;
    document.getElementById('net-height').textContent = data.blockHeight || 0;
    document.getElementById('net-blocktime').textContent = data.averageBlockTime || 0;
    document.getElementById('net-mempool').textContent = data.mempool || 0;
    
    // Update network info table
    document.getElementById('net-node-id').textContent = data.nodeId ? data.nodeId.substring(0, 32) + '...' : 'Unknown';
    document.getElementById('net-mode').textContent = data.mode ? data.mode.toUpperCase() : 'Unknown';
    document.getElementById('net-network').textContent = data.network || 'Unknown';
    document.getElementById('net-chain').textContent = data.chainId || 'Unknown';
    document.getElementById('net-uptime').textContent = formatUptime(data.uptime || 0);
    
    // Update peer list
    const peerListDiv = document.getElementById('peer-list');
    peerListDiv.innerHTML = '';
    
    if (!data.peerList || data.peerList.length === 0) {
      peerListDiv.innerHTML = '<p style="color: var(--mono-400); padding: 1rem;">No peers connected</p>';
      return;
    }
    
    data.peerList.forEach(peer => {
      const peerDiv = document.createElement('div');
      peerDiv.style.cssText = `
        padding: 1rem;
        border: var(--border);
        margin-bottom: 0.5rem;
        font-size: 12px;
        font-family: 'SF Mono', monospace;
      `;
      
      const lastSeenAgo = Math.floor((Date.now() - peer.lastSeen) / 1000);
      
      peerDiv.innerHTML = `
        <div><strong>Node ID:</strong> ${peer.nodeId ? peer.nodeId.substring(0, 16) + '...' : 'Unknown'}</div>
        <div><strong>Chain Height:</strong> ${peer.chainHeight || 'Unknown'}</div>
        <div><strong>Last Seen:</strong> ${lastSeenAgo}s ago</div>
      `;
      
      peerListDiv.appendChild(peerDiv);
    });
    
  } catch (error) {
    console.error('Error loading network stats:', error);
    document.getElementById('net-peers').textContent = '0';
    document.getElementById('net-height').textContent = '0';
    document.getElementById('net-blocktime').textContent = '0';
    document.getElementById('net-mempool').textContent = '0';
    document.getElementById('net-node-id').textContent = 'Loading...';
    document.getElementById('net-mode').textContent = 'Loading...';
    document.getElementById('net-network').textContent = 'Loading...';
    document.getElementById('net-chain').textContent = 'Loading...';
    document.getElementById('net-uptime').textContent = 'Loading...';
  }
}

function loadPeerList(peers) {
  const list = document.getElementById('peer-list');
  list.innerHTML = '';

  if (peers.length === 0) {
    list.innerHTML = '<p>No connected peers</p>';
    return;
  }

  peers.forEach(peer => {
    const div = document.createElement('div');
    div.className = 'peer-item';
    
    const timeSinceLastSeen = Math.floor((Date.now() - peer.lastSeen) / 1000);
    
    div.innerHTML = `
      <div>
        <strong>Node ID:</strong> ${peer.nodeId.substring(0, 16)}...
      </div>
      <div>
        <strong>Address:</strong> ${peer.ip}:${peer.port}
      </div>
      <div>
        <strong>Chain:</strong> ${peer.chainId}
      </div>
      <div>
        <strong>Version:</strong> ${peer.version}
      </div>
      <div>
        <strong>Last Seen:</strong> ${timeSinceLastSeen}s ago
      </div>
    `;
    
    list.appendChild(div);
  });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

// Update showPage function to load network stats
const originalShowPage = showPage;
showPage = function(pageId) {
  originalShowPage(pageId);
  
  if (pageId === 'network') {
    loadNetworkStats();
    // Auto-refresh every 3 seconds
    const networkInterval = setInterval(() => {
      if (document.getElementById('network').classList.contains('active')) {
        loadNetworkStats();
      } else {
        clearInterval(networkInterval);
      }
    }, 3000);
  }
};