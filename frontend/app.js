let apiBase = window.location.origin + '/api';
let networkConfig = null;
let currentWallet = null;
let currentPage = 1;
let blocksPerPage = 20;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadNetworkConfig();
  await updateHeaderInfo();
  loadWallet();
  updateStats();
  updateBlockFeed();
  
  // Auto-refresh every 3 seconds
  setInterval(updateStats, 3000);
  setInterval(updateHeaderInfo, 5000);
  setInterval(updateBlockFeed, 5000);
});

// Load network configuration
async function loadNetworkConfig() {
  try {
    const res = await fetch(`${apiBase}/network`);
    networkConfig = await res.json();
    console.log('Network config loaded:', networkConfig);
  } catch (error) {
    console.error('Error loading network config:', error);
  }
}

// Update header information
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
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');

  // Load page-specific data
  if (pageId === 'explorer') {
    loadExplorerBlocks();
  } else if (pageId === 'validators') {
    loadValidators();
  } else if (pageId === 'contracts') {
    loadContracts();
  } else if (pageId === 'network') {
    loadNetworkStats();
  } else if (pageId === 'dashboard') {
    updateBlockFeed();
  }
}

// Update dashboard stats
async function updateStats() {
  try {
    const res = await fetch(`${apiBase}/stats`);
    const stats = await res.json();

    document.getElementById('stat-blocks').textContent = stats.blocks || 0;
    document.getElementById('stat-validators').textContent = stats.validators || 0;
    document.getElementById('stat-stake').textContent = stats.totalStake || 0;
    document.getElementById('stat-mempool').textContent = stats.mempool || 0;
    document.getElementById('stat-contracts').textContent = stats.contracts || 0;

    // Get validator data for APR
    const validatorsRes = await fetch(`${apiBase}/validators`);
    const validatorsData = await validatorsRes.json();
    document.getElementById('stat-apr').textContent = validatorsData.estimatedAPR || 0;

    if (currentWallet) {
      const balanceRes = await fetch(`${apiBase}/balance/${currentWallet.address}`);
      const balanceData = await balanceRes.json();
      if (document.getElementById('wallet-balance')) {
        document.getElementById('wallet-balance').textContent = balanceData.balance + ' SAYM';
      }
      if (document.getElementById('wallet-staked')) {
        document.getElementById('wallet-staked').textContent = balanceData.stake + ' SAYM';
      }
    }

  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Update live block feed
async function updateBlockFeed() {
  try {
    const res = await fetch(`${apiBase}/blocks?limit=10`);
    const data = await res.json();
    
    const feed = document.getElementById('block-feed');
    if (!feed) return;
    
    feed.innerHTML = '';
    
    // Show newest first
    const blocks = data.blocks.reverse();
    
    blocks.slice(0, 10).forEach(block => {
      const item = document.createElement('div');
      item.className = 'block-item';
      
      // Proper date formatting
      const date = new Date(block.timestamp);
      const timeStr = isNaN(date.getTime()) ? 'Pending...' : date.toLocaleString();
      
      item.innerHTML = `
        <div class="block-index">#${block.index}</div>
        <div class="block-hash">${block.hash || 'Generating...'}</div>
        <div class="block-time">${timeStr}</div>
      `;
      
      feed.appendChild(item);
    });
  } catch (error) {
    console.error('Error updating block feed:', error);
  }
}

// Load explorer blocks with HOVER DETAILS
async function loadExplorerBlocks() {
  try {
    const res = await fetch(`${apiBase}/blocks?limit=20`);
    const data = await res.json();
    
    const tbody = document.getElementById('explorer-blocks');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Show newest first
    const blocks = data.blocks.reverse();
    
    blocks.forEach(block => {
      const row = document.createElement('tr');
      
      // Proper date formatting
      const date = new Date(block.timestamp);
      const timeStr = isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
      
      // Calculate total gas used
      let gasUsed = 0;
      if (block.transactions && Array.isArray(block.transactions)) {
        block.transactions.forEach(tx => {
          if (tx.gasUsed) gasUsed += tx.gasUsed;
        });
      }
      
      row.innerHTML = `
        <td>#${block.index}</td>
        <td class="mono">${block.hash ? block.hash.substring(0, 16) + '...' : 'N/A'}</td>
        <td class="mono">${block.validator ? block.validator.substring(0, 16) + '...' : 'N/A'}</td>
        <td>${block.transactions ? block.transactions.length : 0}</td>
        <td>${gasUsed}</td>
        <td>${timeStr}</td>
      `;
      
      // Add hover tooltip with full details
      row.title = `Block #${block.index}
Hash: ${block.hash || 'N/A'}
Previous: ${block.previousHash || 'N/A'}
Validator: ${block.validator || 'N/A'}
Timestamp: ${timeStr}
Transactions: ${block.transactions ? block.transactions.length : 0}
Gas Used: ${gasUsed}
Chain ID: ${block.chainId || 'N/A'}`;
      
      row.style.cursor = 'pointer';
      
      // Click to view full details
      row.onclick = () => viewBlockDetails(block);
      
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading explorer blocks:', error);
  }
}

// View block details (modal/expanded view)
function viewBlockDetails(block) {
  const date = new Date(block.timestamp);
  const timeStr = isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
  
  let gasUsed = 0;
  if (block.transactions && Array.isArray(block.transactions)) {
    block.transactions.forEach(tx => {
      if (tx.gasUsed) gasUsed += tx.gasUsed;
    });
  }
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: calc(var(--grid) * 4);
  `;
  
  modal.innerHTML = `
    <div style="
      background: var(--mono-1000);
      border: var(--border);
      max-width: 800px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <div style="
        border-bottom: var(--border);
        padding: calc(var(--grid) * 3);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <h2 style="margin: 0;">Block #${block.index}</h2>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
          background: none;
          border: var(--border);
          padding: calc(var(--grid) * 1) calc(var(--grid) * 2);
          cursor: pointer;
          font-size: 12px;
        ">CLOSE</button>
      </div>
      
      <div style="padding: calc(var(--grid) * 3);">
        <table style="width: 100%; font-size: 12px;">
          <tr>
            <td style="padding: calc(var(--grid) * 1); color: var(--mono-400);">Hash</td>
            <td style="padding: calc(var(--grid) * 1); font-family: monospace; word-break: break-all;">${block.hash || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: calc(var(--grid) * 1); color: var(--mono-400);">Previous Hash</td>
            <td style="padding: calc(var(--grid) * 1); font-family: monospace; word-break: break-all;">${block.previousHash || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: calc(var(--grid) * 1); color: var(--mono-400);">Validator</td>
            <td style="padding: calc(var(--grid) * 1); font-family: monospace;">${block.validator || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: calc(var(--grid) * 1); color: var(--mono-400);">Timestamp</td>
            <td style="padding: calc(var(--grid) * 1);">${timeStr}</td>
          </tr>
          <tr>
            <td style="padding: calc(var(--grid) * 1); color: var(--mono-400);">Chain ID</td>
            <td style="padding: calc(var(--grid) * 1);">${block.chainId || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: calc(var(--grid) * 1); color: var(--mono-400);">Gas Used</td>
            <td style="padding: calc(var(--grid) * 1);">${gasUsed}</td>
          </tr>
        </table>
        
        <div style="margin-top: calc(var(--grid) * 3); border-top: var(--border); padding-top: calc(var(--grid) * 2);">
          <h3 style="font-size: 14px; margin-bottom: calc(var(--grid) * 2);">Transactions (${block.transactions ? block.transactions.length : 0})</h3>
          ${block.transactions && block.transactions.length > 0 ? 
            block.transactions.map(tx => `
              <div style="
                border: var(--border);
                padding: calc(var(--grid) * 2);
                margin-bottom: calc(var(--grid) * 1);
                font-size: 11px;
              ">
                <div><strong>Type:</strong> ${tx.type}</div>
                <div><strong>ID:</strong> <span style="font-family: monospace;">${tx.id}</span></div>
                ${tx.data.from ? `<div><strong>From:</strong> <span style="font-family: monospace;">${tx.data.from}</span></div>` : ''}
                ${tx.data.to ? `<div><strong>To:</strong> <span style="font-family: monospace;">${tx.data.to}</span></div>` : ''}
                ${tx.data.amount ? `<div><strong>Amount:</strong> ${tx.data.amount} SAYM</div>` : ''}
                ${tx.gasUsed ? `<div><strong>Gas Used:</strong> ${tx.gasUsed}</div>` : ''}
              </div>
            `).join('') 
            : '<p style="color: var(--mono-400); font-size: 12px;">No transactions</p>'
          }
        </div>
      </div>
    </div>
  `;
  
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  };
  
  document.body.appendChild(modal);
}

// Load validators
async function loadValidators() {
  try {
    const res = await fetch(`${apiBase}/validators`);
    const data = await res.json();
    
    const tbody = document.getElementById('validator-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    console.log('Validators data:', data);
    
    if (!data.validators || data.validators.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--mono-400);">No validators found</td></tr>';
      return;
    }
    
    data.validators.forEach(validator => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="mono">${validator.address ? validator.address.substring(0, 20) + '...' : 'Unknown'}</td>
        <td>${validator.stake || 0} SAYM</td>
        <td>${validator.percentage || 0}%</td>
        <td>${validator.missedBlocks || 0}</td>
      `;
      
      // Add hover tooltip
      row.title = `Validator: ${validator.address || 'Unknown'}
Stake: ${validator.stake || 0} SAYM
Share: ${validator.percentage || 0}%
Missed Blocks: ${validator.missedBlocks || 0}
Status: ${validator.isActive ? 'Active' : 'Inactive'}`;
      
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading validators:', error);
    const tbody = document.getElementById('validator-list');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #ef4444;">Error loading validators</td></tr>';
    }
  }
}

// Load contracts
async function loadContracts() {
  try {
    const res = await fetch(`${apiBase}/contracts`);
    const data = await res.json();
    
    const tbody = document.getElementById('contract-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!data.contracts || data.contracts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--mono-400);">No contracts deployed yet</td></tr>';
      return;
    }
    
    data.contracts.forEach(contract => {
      const row = document.createElement('tr');
      const codeSize = contract.code ? contract.code.length : 0;
      
      row.innerHTML = `
        <td class="mono">${contract.address ? contract.address.substring(0, 20) + '...' : 'Unknown'}</td>
        <td class="mono">${contract.creator ? contract.creator.substring(0, 20) + '...' : 'Unknown'}</td>
        <td>${codeSize} bytes</td>
      `;
      
      // Add hover tooltip
      row.title = `Contract: ${contract.address || 'Unknown'}
Creator: ${contract.creator || 'Unknown'}
Code Size: ${codeSize} bytes
Created: ${contract.createdAt ? new Date(contract.createdAt).toLocaleString() : 'Unknown'}`;
      
      row.style.cursor = 'pointer';
      
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading contracts:', error);
  }
}

// Load network stats
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

// Format uptime
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

// Wallet functions
function loadWallet() {
  const saved = localStorage.getItem('sayman_wallet');
  if (saved) {
    currentWallet = JSON.parse(saved);
    displayWallet();
  }
}

function displayWallet() {
  if (currentWallet) {
    const walletInfo = document.getElementById('wallet-info');
    if (walletInfo) {
      walletInfo.classList.remove('hidden');
      document.getElementById('wallet-address').value = currentWallet.address;
      document.getElementById('wallet-key').value = currentWallet.privateKey;
    }
  }
}

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

function saveWallet(wallet) {
  localStorage.setItem('sayman_wallet', JSON.stringify(wallet));
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

// Stake - CLIENT-SIDE SIGNING
async function stakeTokens() {
  const amount = parseFloat(document.getElementById('stake-amount').value);
  const privateKey = document.getElementById('stake-key').value;

  if (!amount || !privateKey) {
    showResult('stake', 'Please fill all fields', 'error');
    return;
  }

  if (networkConfig && amount < networkConfig.minStake) {
    showResult('stake', `Minimum stake is ${networkConfig.minStake} SAYM`, 'error');
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

// Unstake tokens
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
    
    const addressData = await fetch(`${apiBase}/address/${wallet.address}`);
    const { nonce } = await addressData.json();
    
    const gasEstimate = await estimateGas('UNSTAKE', { from: wallet.address });
    
    const txData = {
      type: 'UNSTAKE',
      data: { from: wallet.address },
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
    
    const addressData = await fetch(`${apiBase}/address/${wallet.address}`);
    const { nonce } = await addressData.json();
    
    const gasEstimate = await estimateGas('CONTRACT_DEPLOY', { from: wallet.address, code });
    
    const txData = {
      type: 'CONTRACT_DEPLOY',
      data: { from: wallet.address, code },
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
    
    const addressData = await fetch(`${apiBase}/address/${wallet.address}`);
    const { nonce } = await addressData.json();
    
    const args = argsText ? JSON.parse(argsText) : {};
    
    const gasEstimate = await estimateGas('CONTRACT_CALL', { from: wallet.address, contractAddress, method, args });
    
    const txData = {
      type: 'CONTRACT_CALL',
      data: { from: wallet.address, contractAddress, method, args },
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
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    color: white;
    font-size: 1.5rem;
    font-weight: 600;
  `;
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
    background: #10b981;
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

// Auto-refresh network stats when on network page
setInterval(() => {
  const networkPage = document.getElementById('network');
  if (networkPage && networkPage.classList.contains('active')) {
    loadNetworkStats();
  }
}, 3000);