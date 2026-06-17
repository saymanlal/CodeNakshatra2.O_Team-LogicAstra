let wallets = [];
let activeWallet = null;
let currentNetwork = 'testnet';
let isLoading = false;

const networkEndpoints = {
  'testnet': 'https://sayman.onrender.com/api',
  'public-testnet': 'https://sayman.onrender.com/api',
  'mainnet': 'https://sayman.onrender.com/api'
};

const networkNames = {
  'testnet': 'Sayman Testnet',
  'public-testnet': 'Sayman Public Testnet',
  'mainnet': 'Sayman Mainnet'
};

const networkTypes = {
  'testnet': 'testnet',
  'public-testnet': 'testnet',
  'mainnet': 'mainnet'
};

const faucetEndpoints = {
  'testnet': 'https://sayman-faucet.onrender.com/faucet',
  'public-testnet': 'https://sayman-faucet.onrender.com/faucet',
  'mainnet': null
};

// Rest of file stays the same...
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Wallet Manager Initialized');
  loadWallets();
  renderWallets();
  updateStats();
});

function getApiBase() {
  return networkEndpoints[currentNetwork];
}

function getNetworkType() {
  return networkTypes[currentNetwork];
}

// Load wallets from localStorage
function loadWallets() {
  const saved = localStorage.getItem('sayman_wallets');
  if (saved) {
    try {
      wallets = JSON.parse(saved);
      console.log(`✅ Loaded ${wallets.length} wallets`);
    } catch (error) {
      console.error('Error loading wallets:', error);
      wallets = [];
    }
  }
}

// Save wallets to localStorage
function saveWallets() {
  try {
    localStorage.setItem('sayman_wallets', JSON.stringify(wallets));
    console.log(`✅ Saved ${wallets.length} wallets`);
  } catch (error) {
    console.error('Error saving wallets:', error);
    showToast('Error saving wallets', 'error');
  }
}

// Network switching
function switchNetwork(network) {
  currentNetwork = network;
  
  document.querySelectorAll('.network-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-network="${network}"]`).classList.add('active');
  
  document.getElementById('active-network').textContent = networkNames[network];
  
  renderWallets();
  showToast(`Switched to ${networkNames[network]}`, 'success');
}

// Update stats
function updateStats() {
  const networkWallets = wallets.filter(w => w.networkType === getNetworkType());
  
  document.getElementById('total-wallets').textContent = networkWallets.length;
  document.getElementById('wallet-count').textContent = networkWallets.length;
  
  let totalBalance = 0;
  let totalStaked = 0;
  
  networkWallets.forEach(w => {
    totalBalance += w.balance || 0;
    totalStaked += w.stake || 0;
  });
  
  document.getElementById('total-balance').innerHTML = `${totalBalance.toFixed(2)} <span style="font-size: 14px; color: var(--mono-400);">SAYM</span>`;
  document.getElementById('total-staked').innerHTML = `${totalStaked.toFixed(2)} <span style="font-size: 14px; color: var(--mono-400);">SAYM</span>`;
}

// Render wallet list
async function renderWallets() {
  const list = document.getElementById('wallet-list');
  
  const networkWallets = wallets.filter(w => w.networkType === getNetworkType());
  
  if (networkWallets.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👛</div>
        <p>No ${getNetworkType()} wallets yet. Create your first wallet to get started.</p>
      </div>
    `;
    updateStats();
    return;
  }
  
  list.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading-spinner"></div> Loading wallets...</div>';
  
  const walletElements = [];
  
  for (const wallet of networkWallets) {
    let balance = 0;
    let stake = 0;
    
    try {
      const res = await fetch(`${getApiBase()}/address/${wallet.address}`);
      if (res.ok) {
        const data = await res.json();
        balance = data.balance || 0;
        stake = data.stake || 0;
        wallet.balance = balance;
        wallet.stake = stake;
      }
    } catch (error) {
      console.error(`Error fetching balance for ${wallet.address}:`, error);
    }
    
    const card = document.createElement('div');
    card.className = 'wallet-card';
    if (activeWallet && activeWallet.address === wallet.address) {
      card.classList.add('active');
    }
    
    const networkBadge = wallet.networkType === 'testnet' 
      ? '<span class="wallet-tag" style="background: #3b82f6; color: white; border: none;">TESTNET</span>'
      : '<span class="wallet-tag" style="background: #8b5cf6; color: white; border: none;">MAINNET</span>';
    
    card.innerHTML = `
      <div class="wallet-main">
        <div class="wallet-header">
          <div class="wallet-name">${wallet.name || 'Unnamed Wallet'}</div>
          ${networkBadge}
          ${activeWallet && activeWallet.address === wallet.address ? '<div class="wallet-tag">ACTIVE</div>' : ''}
        </div>
        <div class="wallet-address">
          ${wallet.address}
          <button class="copy-btn btn-small" onclick="copyToClipboard('${wallet.address}', 'Address copied!')" style="margin-left: 8px;">
            📋 Copy
          </button>
        </div>
        <div class="wallet-balance-row">
          <div class="balance-item">
            <div class="balance-label">Balance</div>
            <div class="balance-value">${balance.toFixed(2)}<span class="balance-unit">SAYM</span></div>
          </div>
          ${stake > 0 ? `
          <div class="balance-item">
            <div class="balance-label">Staked</div>
            <div class="balance-value">${stake.toFixed(2)}<span class="balance-unit">SAYM</span></div>
          </div>
          ` : ''}
        </div>
      </div>
      <div class="wallet-actions">
        <button class="btn btn-success" onclick="selectWallet('${wallet.address}')">
          ${activeWallet && activeWallet.address === wallet.address ? '✓ Selected' : 'Select'}
        </button>
        <button class="btn" onclick="showWalletDetails('${wallet.address}')">Details</button>
        <button class="btn" onclick="generateInvoice('${wallet.address}')">Invoice</button>
        <button class="btn btn-danger" onclick="deleteWallet('${wallet.address}')">Delete</button>
      </div>
    `;
    
    walletElements.push(card);
  }
  
  list.innerHTML = '';
  walletElements.forEach(el => list.appendChild(el));
  
  saveWallets();
  updateStats();
}

// Create wallet
async function createWallet() {
  try {
    if (isLoading) return;
    isLoading = true;
    
    const name = document.getElementById('wallet-name').value.trim() || `Wallet ${wallets.length + 1}`;
    
    showLoading('Generating wallet...');
    
    const wallet = new SaymanWallet();
    await wallet.initialize();
    
    const newWallet = {
      name,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      createdAt: Date.now(),
      balance: 0,
      stake: 0,
      networkType: getNetworkType()
    };
    
    wallets.push(newWallet);
    saveWallets();
    renderWallets();
    
    hideLoading();
    
    document.getElementById('create-result').innerHTML = `
      <div class="alert alert-success">
        <div style="flex: 1;">
          <strong>✅ ${getNetworkType().toUpperCase()} Wallet Created!</strong><br>
          <div style="margin-top: 8px; font-size: 11px;">
            Address: <code>${wallet.address.substring(0, 20)}...</code>
          </div>
          <div style="margin-top: 12px;">
            <strong style="color: var(--error);">⚠️ SAVE YOUR PRIVATE KEY:</strong>
          </div>
          <textarea readonly style="width: 100%; margin-top: 8px; font-size: 10px; height: 60px; font-family: 'SF Mono', monospace;">${wallet.privateKey}</textarea>
          <button class="btn btn-small" onclick="copyToClipboard('${wallet.privateKey}', 'Private key copied!')" style="margin-top: 8px;">
            📋 Copy Private Key
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('wallet-name').value = '';
    isLoading = false;
    
    showToast(`${getNetworkType().toUpperCase()} wallet created!`, 'success');
    
  } catch (error) {
    hideLoading();
    isLoading = false;
    showToast('Error creating wallet: ' + error.message, 'error');
    console.error('Create wallet error:', error);
  }
}

// Import wallet
async function importWallet() {
  try {
    if (isLoading) return;
    isLoading = true;
    
    const name = document.getElementById('import-name').value.trim() || 'Imported Wallet';
    const privateKey = document.getElementById('import-key').value.trim();
    
    if (!privateKey) {
      showToast('Please enter a private key', 'error');
      isLoading = false;
      return;
    }
    
    if (privateKey.length !== 64) {
      showToast('Private key must be 64 characters', 'error');
      isLoading = false;
      return;
    }
    
    showLoading('Importing wallet...');
    
    const wallet = new SaymanWallet(privateKey);
    await wallet.initialize();
    
    if (wallets.find(w => w.address === wallet.address && w.networkType === getNetworkType())) {
      hideLoading();
      isLoading = false;
      showToast('This wallet already exists in ' + getNetworkType(), 'error');
      return;
    }
    
    const newWallet = {
      name,
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      createdAt: Date.now(),
      balance: 0,
      stake: 0,
      networkType: getNetworkType()
    };
    
    wallets.push(newWallet);
    saveWallets();
    renderWallets();
    closeModal('import');
    
    hideLoading();
    isLoading = false;
    
    document.getElementById('import-name').value = '';
    document.getElementById('import-key').value = '';
    
    showToast(`${getNetworkType().toUpperCase()} wallet imported!`, 'success');
    
  } catch (error) {
    hideLoading();
    isLoading = false;
    showToast('Invalid private key', 'error');
    console.error('Import wallet error:', error);
  }
}

// Select wallet
function selectWallet(address) {
  activeWallet = wallets.find(w => w.address === address);
  renderWallets();
  document.getElementById('active-wallet-section').style.display = 'block';
  showToast(`Selected: ${activeWallet.name}`, 'success');
  loadTransactionHistory();
}

// Show wallet details
async function showWalletDetails(address) {
  const wallet = wallets.find(w => w.address === address);
  if (!wallet) return;
  
  showLoading('Loading wallet details...');
  
  let balance = 0;
  let stake = 0;
  let nonce = 0;
  
  try {
    const res = await fetch(`${getApiBase()}/address/${wallet.address}`);
    if (res.ok) {
      const data = await res.json();
      balance = data.balance || 0;
      stake = data.stake || 0;
      nonce = data.nonce || 0;
    }
  } catch (error) {
    console.error('Error fetching details:', error);
  }
  
  hideLoading();
  
  const content = document.getElementById('wallet-details-content');
  content.innerHTML = `
    <div class="input-group">
      <label class="input-label">Name</label>
      <input type="text" value="${wallet.name}" readonly>
    </div>
    <div class="input-group">
      <label class="input-label">Network Type</label>
      <input type="text" value="${wallet.networkType.toUpperCase()}" readonly>
    </div>
    <div class="input-group">
      <label class="input-label">Address</label>
      <div style="display: flex; gap: 8px;">
        <input type="text" value="${wallet.address}" readonly class="mono" style="flex: 1; font-family: 'SF Mono', monospace;">
        <button class="btn btn-small" onclick="copyToClipboard('${wallet.address}', 'Address copied!')">📋</button>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Balance</label>
      <input type="text" value="${balance} SAYM" readonly>
    </div>
    <div class="input-group">
      <label class="input-label">Staked</label>
      <input type="text" value="${stake} SAYM" readonly>
    </div>
    <div class="input-group">
      <label class="input-label">Nonce</label>
      <input type="text" value="${nonce}" readonly>
    </div>
    <div class="input-group">
      <label class="input-label">Public Key</label>
      <textarea readonly style="font-size: 10px; height: 80px; font-family: 'SF Mono', monospace;">${wallet.publicKey}</textarea>
    </div>
    <div class="input-group">
      <label class="input-label">Private Key</label>
      <textarea readonly style="font-size: 10px; height: 60px; font-family: 'SF Mono', monospace;">${wallet.privateKey}</textarea>
      <button class="btn btn-small" onclick="copyToClipboard('${wallet.privateKey}', 'Private key copied!')" style="margin-top: 8px;">
        📋 Copy Private Key
      </button>
      <div class="alert alert-warning" style="margin-top: 8px;">
        <strong>⚠️ Never share your private key with anyone!</strong>
      </div>
    </div>
    <div class="input-group">
      <label class="input-label">Created</label>
      <input type="text" value="${new Date(wallet.createdAt).toLocaleString()}" readonly>
    </div>
  `;
  
  openModal('details');
}

// Delete wallet
function deleteWallet(address) {
  const wallet = wallets.find(w => w.address === address);
  if (!wallet) return;
  
  if (!confirm(`Are you sure you want to delete "${wallet.name}"?\n\nThis action cannot be undone!`)) {
    return;
  }
  
  wallets = wallets.filter(w => w.address !== address);
  
  if (activeWallet && activeWallet.address === address) {
    activeWallet = null;
    document.getElementById('active-wallet-section').style.display = 'none';
  }
  
  saveWallets();
  renderWallets();
  showToast('Wallet deleted', 'success');
}

// Generate Invoice
function generateInvoice(address) {
  const wallet = wallets.find(w => w.address === address);
  if (!wallet) return;
  
  const content = document.getElementById('invoice-content');
  const qrPlaceholder = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${wallet.address}`;
  
  content.innerHTML = `
    <div style="text-align: center; padding: 32px; border: 2px solid var(--mono-800);">
      <h2 style="margin-bottom: 24px;">Payment Invoice</h2>
      
      <img src="${qrPlaceholder}" alt="QR Code" style="width: 200px; height: 200px; margin: 0 auto 24px;">
      
      <div class="input-group">
        <label class="input-label">Send Payment To</label>
        <textarea readonly style="font-size: 11px; height: 50px; text-align: center; font-family: 'SF Mono', monospace;">${wallet.address}</textarea>
        <button class="btn btn-small" onclick="copyToClipboard('${wallet.address}', 'Address copied!')" style="margin-top: 8px;">
          📋 Copy Address
        </button>
      </div>
      
      <div style="margin-top: 24px; display: flex; gap: 8px; justify-content: center;">
        <button class="btn" onclick="printInvoice()">🖨️ Print</button>
        <button class="btn" onclick="emailInvoice('${wallet.address}')">📧 Email</button>
      </div>
    </div>
  `;
  
  openModal('invoice');
}

// Print Invoice
function printInvoice() {
  window.print();
}

// Email Invoice
function emailInvoice(address) {
  const subject = encodeURIComponent('Sayman Payment Invoice');
  const body = encodeURIComponent(`Please send payment to this address:\n\n${address}\n\nNetwork: ${networkNames[currentNetwork]}\n\nThank you!`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  showToast('Opening email client...', 'success');
}

// Send transaction
async function sendTransaction() {
  if (!activeWallet) {
    showToast('Please select a wallet first', 'error');
    return;
  }
  
  try {
    const to = document.getElementById('send-to').value.trim();
    const amount = parseFloat(document.getElementById('send-amount').value);
    
    if (!to || !amount) {
      showToast('Please fill all fields', 'error');
      return;
    }
    
    if (to.length !== 40) {
      showToast('Invalid address format', 'error');
      return;
    }
    
    if (amount <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    
    showLoading('Preparing transaction...');
    
    const wallet = new SaymanWallet(activeWallet.privateKey);
    await wallet.initialize();
    
    const addressRes = await fetch(`${getApiBase()}/address/${wallet.address}`);
    const addressData = await addressRes.json();
    const nonce = addressData.nonce || 0;
    
    const gasEstimate = await fetch(`${getApiBase()}/estimate-gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TRANSFER',
        data: { from: wallet.address, to, amount }
      })
    });
    const gas = await gasEstimate.json();
    
    hideLoading();
    showLoading('Signing transaction...');
    
    const txData = {
      type: 'TRANSFER',
      data: { from: wallet.address, to, amount },
      timestamp: Date.now(),
      gasLimit: gas.recommendedGasLimit,
      gasPrice: gas.minGasPrice,
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
    
    const res = await fetch(`${getApiBase()}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });
    
    const result = await res.json();
    
    hideLoading();
    
    if (result.success) {
      document.getElementById('send-result').innerHTML = `
        <div class="alert alert-success">
          <div>
            <strong>✅ Transaction Sent!</strong><br>
            <div style="margin-top: 8px; font-size: 11px;">
              TX ID: <code>${result.txId.substring(0, 16)}...</code><br>
              Gas Cost: ${result.maxGasCost} wei
            </div>
            <button class="btn btn-small" onclick="printReceipt('${result.txId}', '${to}', ${amount})" style="margin-top: 8px;">
              🖨️ Print Receipt
            </button>
          </div>
        </div>
      `;
      
      document.getElementById('send-to').value = '';
      document.getElementById('send-amount').value = '';
      
      showToast('Transaction sent!', 'success');
      
      setTimeout(() => {
        renderWallets();
        loadTransactionHistory();
      }, 2000);
    } else {
      showToast(result.error || 'Transaction failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message, 'error');
    console.error('Send transaction error:', error);
  }
}

// Print Receipt
function printReceipt(txId, to, amount) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction Receipt</title>
      <style>
        body { font-family: Arial; padding: 40px; }
        h1 { text-align: center; }
        .receipt { border: 2px solid #000; padding: 20px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ccc; }
        .label { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <h1>TRANSACTION RECEIPT</h1>
        <div class="row">
          <span class="label">Network:</span>
          <span>${networkNames[currentNetwork]}</span>
        </div>
        <div class="row">
          <span class="label">From:</span>
          <span>${activeWallet.address}</span>
        </div>
        <div class="row">
          <span class="label">To:</span>
          <span>${to}</span>
        </div>
        <div class="row">
          <span class="label">Amount:</span>
          <span>${amount} SAYM</span>
        </div>
        <div class="row">
          <span class="label">Transaction ID:</span>
          <span>${txId}</span>
        </div>
        <div class="row">
          <span class="label">Date:</span>
          <span>${new Date().toLocaleString()}</span>
        </div>
      </div>
      <script>window.print(); window.close();</script>
    </body>
    </html>
  `);
}

// Stake tokens
async function stakeTokens() {
  if (!activeWallet) {
    showToast('Please select a wallet first', 'error');
    return;
  }
  
  try {
    const amount = parseFloat(document.getElementById('stake-amount').value);
    
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    
    showLoading('Preparing stake...');
    
    const wallet = new SaymanWallet(activeWallet.privateKey);
    await wallet.initialize();
    
    const addressRes = await fetch(`${getApiBase()}/address/${wallet.address}`);
    const addressData = await addressRes.json();
    const nonce = addressData.nonce || 0;
    
    const gasEstimate = await fetch(`${getApiBase()}/estimate-gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'STAKE',
        data: { from: wallet.address, amount }
      })
    });
    const gas = await gasEstimate.json();
    
    hideLoading();
    showLoading('Signing stake...');
    
    const txData = {
      type: 'STAKE',
      data: { from: wallet.address, amount },
      timestamp: Date.now(),
      gasLimit: gas.recommendedGasLimit,
      gasPrice: gas.minGasPrice,
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
    
    const res = await fetch(`${getApiBase()}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });
    
    const result = await res.json();
    
    hideLoading();
    
    if (result.success) {
      document.getElementById('stake-result').innerHTML = `
        <div class="alert alert-success">
          <div>
            <strong>✅ Stake Transaction Broadcast!</strong><br>
            <div style="margin-top: 8px; font-size: 11px;">
              TX ID: <code>${result.txId.substring(0, 16)}...</code>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('stake-amount').value = '';
      
      showToast('Tokens staked!', 'success');
      
      setTimeout(() => {
        renderWallets();
        loadTransactionHistory();
      }, 2000);
    } else {
      showToast(result.error || 'Staking failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message, 'error');
    console.error('Stake error:', error);
  }
}

// Unstake tokens
async function unstakeTokens() {
  if (!activeWallet) {
    showToast('Please select a wallet first', 'error');
    return;
  }
  
  if (!confirm('Unstake all tokens? They will be locked for a period before becoming available.')) {
    return;
  }
  
  try {
    showLoading('Preparing unstake...');
    
    const wallet = new SaymanWallet(activeWallet.privateKey);
    await wallet.initialize();
    
    const addressRes = await fetch(`${getApiBase()}/address/${wallet.address}`);
    const addressData = await addressRes.json();
    const nonce = addressData.nonce || 0;
    
    const gasEstimate = await fetch(`${getApiBase()}/estimate-gas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'UNSTAKE',
        data: { from: wallet.address }
      })
    });
    const gas = await gasEstimate.json();
    
    hideLoading();
    showLoading('Signing unstake...');
    
    const txData = {
      type: 'UNSTAKE',
      data: { from: wallet.address },
      timestamp: Date.now(),
      gasLimit: gas.recommendedGasLimit,
      gasPrice: gas.minGasPrice,
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
    
    const res = await fetch(`${getApiBase()}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });
    
    const result = await res.json();
    
    hideLoading();
    
    if (result.success) {
      document.getElementById('stake-result').innerHTML = `
        <div class="alert alert-success">
          <div>
            <strong>✅ Unstake Transaction Broadcast!</strong><br>
            <div style="margin-top: 8px; font-size: 11px;">
              TX ID: <code>${result.txId.substring(0, 16)}...</code>
            </div>
          </div>
        </div>
      `;
      
      showToast('Unstake initiated!', 'success');
      
      setTimeout(() => {
        renderWallets();
        loadTransactionHistory();
      }, 2000);
    } else {
      showToast(result.error || 'Unstaking failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showToast(error.message, 'error');
    console.error('Unstake error:', error);
  }
}

// Claim faucet
async function claimFaucet() {
  if (!activeWallet) {
    showToast('Please select a wallet first', 'error');
    return;
  }
  
  if (activeWallet.networkType === 'mainnet') {
    showToast('Faucet not available on mainnet', 'error');
    return;
  }
  
  const faucetUrl = faucetEndpoints[currentNetwork];
  
  if (!faucetUrl) {
    showToast('Faucet not available for this network', 'error');
    return;
  }
  
  try {
    showLoading('Requesting faucet...');
    
    const res = await fetch(faucetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: activeWallet.address })
    });
    
    const data = await res.json();
    
    hideLoading();
    
    if (data.success) {
      document.getElementById('faucet-result').innerHTML = `
        <div class="alert alert-success">
          <div>
            <strong>✅ ${data.amount || 100} SAYM credited!</strong><br>
            <small>TX ID: ${data.txId ? data.txId.substring(0, 16) + '...' : 'Pending'}</small><br>
            <small>Check your balance in a few seconds</small>
          </div>
        </div>
      `;
      
      showToast('Faucet claimed successfully!', 'success');
      
      setTimeout(() => {
        renderWallets();
        loadTransactionHistory();
      }, 3000);
    } else {
      document.getElementById('faucet-result').innerHTML = `
        <div class="alert alert-error">
          ${data.error || 'Faucet request failed'}
        </div>
      `;
      showToast(data.error || 'Faucet request failed', 'error');
    }
  } catch (error) {
    hideLoading();
    showToast('Faucet error: ' + error.message, 'error');
    console.error('Faucet error:', error);
  }
}

// Load transaction history
async function loadTransactionHistory() {
  if (!activeWallet) return;
  
  try {
    const res = await fetch(`${getApiBase()}/address/${activeWallet.address}`);
    if (!res.ok) return;
    
    const data = await res.json();
    const txList = document.getElementById('tx-history-list');
    
    if (!data.transactions || data.transactions.length === 0) {
      txList.innerHTML = `
        <div class="empty-state" style="padding: calc(var(--grid) * 4);">
          <p>No transaction history</p>
        </div>
      `;
      return;
    }
    
    txList.innerHTML = '';
    
    data.transactions.slice(0, 20).forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      
      let icon = '↔️';
      let iconClass = 'send';
      let label = tx.type;
      
      if (tx.type === 'TRANSFER') {
        if (tx.data.from === activeWallet.address) {
          icon = '↑';
          iconClass = 'send';
          label = 'Sent';
        } else {
          icon = '↓';
          iconClass = 'receive';
          label = 'Received';
        }
      } else if (tx.type === 'STAKE') {
        icon = '🔒';
        iconClass = 'stake';
        label = 'Staked';
      } else if (tx.type === 'UNSTAKE') {
        icon = '🔓';
        iconClass = 'stake';
        label = 'Unstaked';
      } else if (tx.type === 'REWARD') {
        icon = '🎁';
        iconClass = 'receive';
        label = 'Reward';
      }
      
      const address = tx.data.to || tx.data.from || '';
      const amount = tx.data.amount || 0;
      
      item.innerHTML = `
        <div class="tx-icon ${iconClass}">${icon}</div>
        <div class="tx-details">
          <div class="tx-type">${label}</div>
          ${address ? `<div class="tx-address">${address.substring(0, 16)}...</div>` : ''}
        </div>
        <div class="tx-amount">${amount > 0 ? amount.toFixed(2) + ' SAYM' : ''}</div>
      `;
      
      txList.appendChild(item);
    });
    
  } catch (error) {
    console.error('Error loading transaction history:', error);
  }
}

// Export all wallets
function exportAllWallets() {
  if (wallets.length === 0) {
    showToast('No wallets to export', 'error');
    return;
  }
  
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    wallets: wallets.map(w => ({
      name: w.name,
      address: w.address,
      privateKey: w.privateKey,
      publicKey: w.publicKey,
      createdAt: w.createdAt,
      networkType: w.networkType
    }))
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sayman-wallets-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Wallets exported!', 'success');
}

// Tab switching
function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  event.target.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  if (tabName === 'history') {
    loadTransactionHistory();
  }
}

// Modal controls
function openModal(id) {
  document.getElementById(`${id}-modal`).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(`${id}-modal`).classList.remove('active');
  document.body.style.overflow = 'auto';
}

// Copy to clipboard
function copyToClipboard(text, message = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message, 'success');
  }).catch(err => {
    console.error('Copy failed:', err);
    showToast('Copy failed', 'error');
  });
}

// Loading overlay
function showLoading(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    `;
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div style="background: var(--mono-1000); padding: 32px; border-radius: 8px; border: var(--border); text-align: center;">
      <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
      <div style="font-size: 14px; color: var(--mono-100);">${message}</div>
    </div>
  `;
  overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const colors = {
    success: 'var(--success)',
    error: 'var(--error)',
    warning: 'var(--warning)',
    info: 'var(--mono-100)'
  };
  
  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Close modals on outside click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
      document.body.style.overflow = 'auto';
    });
  }
});