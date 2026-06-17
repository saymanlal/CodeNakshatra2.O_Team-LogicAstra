// ============================================================
//  Sayman Wallet Manager Pro — FIXED VERSION
//  Fixes: QR scan auto-fills recipient address for sending
//  Transaction amounts now show correctly
// ============================================================

(function() {
  'use strict';

  // ===== STATE =====
  let wallets = [];
  let activeWallet = null;
  let currentNetwork = 'testnet';
  let chartPeriod = 7;
  let spendingChart = null;
  let monthlyChart = null;
  let categoryChart = null;
  let netWorthChart = null;
  let qrCodeInstance = null;
  let html5QrCode = null;
  let filteredTxs = [];
  let isScanning = false;

  // ===== API ENDPOINTS =====
  const networkEndpoints = {
      'testnet': 'https://sayman.onrender.com/api',
      'public-testnet': 'https://sayman.onrender.com/api',
      'mainnet': 'https://sayman.onrender.com/api'
  };

  const networkNames = {
      'testnet': 'Testnet',
      'public-testnet': 'Public Testnet',
      'mainnet': 'Mainnet'
  };

  const networkTypes = {
      'testnet': 'testnet',
      'public-testnet': 'testnet',
      'mainnet': 'mainnet'
  };

  // ===== DOM REFS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
      loading: $('#loadingOverlay'),
      progressBar: $('#progressBar'),
      progressText: $('#progressText'),
      app: $('#app'),
      walletList: $('#walletList'),
      walletSearch: $('#walletSearch'),
      totalBalance: $('#totalBalance'),
      walletCount: $('#walletCount'),
      txCount: $('#txCount'),
      totalStaked: $('#totalStaked'),
      detailName: $('#detailName'),
      detailStatus: $('#detailStatus'),
      detailAddress: $('#detailAddress'),
      detailBalance: $('#detailBalance'),
      detailStaked: $('#detailStaked'),
      detailNonce: $('#detailNonce'),
      detailNetwork: $('#detailNetwork'),
      detailTxList: $('#detailTxList'),
      networkSelect: $('#networkSelect'),
      refreshBtn: $('#refreshBtn'),
      addWalletModal: $('#addWalletModal'),
      detailsModal: $('#detailsModal'),
      qrModal: $('#qrModal'),
      scanQrModal: $('#scanQrModal'),
      importJsonModal: $('#importJsonModal'),
      txDetailModal: $('#txDetailModal'),
      qrContainer: $('#qrContainer'),
      qrAddressDisplay: $('#qrAddressDisplay'),
      txDetailContent: $('#txDetailContent'),
      addWalletBtn: $('#addWalletBtn'),
      importJsonBtn: $('#importJsonBtn'),
      importQrBtn: $('#importQrBtn'),
      exportAllBtn: $('#exportAllBtn'),
      exportWalletBtn: $('#exportWalletBtn'),
      showQrBtn: $('#showQrBtn'),
      viewDetailsBtn: $('#viewDetailsBtn'),
      scanQrNavBtn: $('#scanQrNavBtn'),
      createWalletBtn: $('#createWalletBtn'),
      importPrivateKeyBtn: $('#importPrivateKeyBtn'),
      importKeyConfirmBtn: $('#importKeyConfirmBtn'),
      privateKeyInput: $('#privateKeyInput'),
      privateKeyArea: $('#privateKeyArea'),
      newWalletName: $('#newWalletName'),
      jsonFileInput: $('#jsonFileInput'),
      importJsonConfirmBtn: $('#importJsonConfirmBtn'),
      jsonImportStatus: $('#jsonImportStatus'),
      uploadQrBtn: $('#uploadQrBtn'),
      qrFileInput: $('#qrFileInput'),
      stopScanBtn: $('#stopScanBtn'),
      downloadQrBtn: $('#downloadQrBtn'),
      shareQrBtn: $('#shareQrBtn'),
      printQrBtn: $('#printQrBtn'),
      sendBtn: $('#sendBtn'),
      sendTo: $('#sendTo'),
      sendAmount: $('#sendAmount'),
      sendGasPrice: $('#sendGasPrice'),
      sendGasLimit: $('#sendGasLimit'),
      sendResult: $('#sendResult'),
      stakeBtn: $('#stakeBtn'),
      unstakeBtn: $('#unstakeBtn'),
      claimRewardsBtn: $('#claimRewardsBtn'),
      stakeAmount: $('#stakeAmount'),
      stakeResult: $('#stakeResult'),
      createResult: $('#createResult'),
      scanResult: $('#scanResult'),
      detailsContent: $('#detailsContent'),
      txTypeFilter: $('#txTypeFilter'),
      txDateFilter: $('#txDateFilter'),
      txDateFrom: $('#txDateFrom'),
      txDateTo: $('#txDateTo'),
      applyFilterBtn: $('#applyFilterBtn'),
      resetFilterBtn: $('#resetFilterBtn'),
      txTotalAmount: $('#txTotalAmount'),
      txTotalCount: $('#txTotalCount'),
      annualSummary: $('#annualSummary'),
      heatmapGrid: $('#heatmapGrid'),
      qrScanner: $('#qrScanner'),
  };

  // ===== HELPERS =====
  function getApiBase() {
      return networkEndpoints[currentNetwork];
  }

  function getNetworkType() {
      return networkTypes[currentNetwork];
  }

  function getNetworkName() {
      return networkNames[currentNetwork];
  }

  function shortAddr(addr) {
      if (!addr) return '0x...';
      return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function formatBalance(b) {
      return Number(b).toFixed(2);
  }

  function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function getActiveWallet() {
      return activeWallet;
  }

  // ===== STORAGE =====
  function saveState() {
      try {
          const data = {
              wallets: wallets.map(w => ({
                  id: w.id,
                  name: w.name,
                  privateKey: w.privateKey,
                  publicKey: w.publicKey,
                  address: w.address,
                  transactions: w.transactions || [],
                  balance: w.balance || 0,
                  stake: w.stake || 0,
                  createdAt: w.createdAt || Date.now(),
                  networkType: w.networkType || getNetworkType()
              })),
              activeWalletId: activeWallet ? activeWallet.id : null,
              network: currentNetwork,
          };
          localStorage.setItem('sayman_wallet_state', JSON.stringify(data));
      } catch (e) { /* ignore */ }
  }

  function loadState() {
      try {
          const raw = localStorage.getItem('sayman_wallet_state');
          if (!raw) return false;
          const data = JSON.parse(raw);
          wallets = data.wallets || [];
          if (data.activeWalletId) {
              activeWallet = wallets.find(w => w.id === data.activeWalletId) || null;
          }
          if (data.network) currentNetwork = data.network;
          return true;
      } catch (e) { return false; }
  }

  // ===== WALLET FACTORY =====
  async function createWalletFromPrivateKey(privateKey, name) {
      const wallet = new SaymanWallet(privateKey);
      await wallet.initialize();
      return {
          id: generateId(),
          name: name || 'Unnamed',
          privateKey: wallet.privateKey,
          publicKey: wallet.publicKey,
          address: wallet.address,
          balance: 0,
          stake: 0,
          transactions: [],
          createdAt: Date.now(),
          networkType: getNetworkType()
      };
  }

  async function generateNewWallet(name) {
      const wallet = new SaymanWallet();
      await wallet.initialize();
      return {
          id: generateId(),
          name: name || 'New Wallet',
          privateKey: wallet.privateKey,
          publicKey: wallet.publicKey,
          address: wallet.address,
          balance: 0,
          stake: 0,
          transactions: [],
          createdAt: Date.now(),
          networkType: getNetworkType()
      };
  }

  // ===== RENDER FUNCTIONS =====
  function render() {
      renderWalletList();
      renderStats();
      renderDetail();
      updateCharts();
      updateAnalytics();
  }

  function renderWalletList() {
      const searchTerm = dom.walletSearch.value.toLowerCase().trim();
      let networkWallets = wallets.filter(w => w.networkType === getNetworkType());

      if (searchTerm) {
          networkWallets = networkWallets.filter(w =>
              w.name.toLowerCase().includes(searchTerm) ||
              w.address.toLowerCase().includes(searchTerm)
          );
      }

      if (networkWallets.length === 0) {
          dom.walletList.innerHTML = `
              <div class="empty-state" style="padding:20px 8px;">
                  <i class="fas fa-wallet" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px;"></i>
                  <p style="color:var(--text-muted);font-size:0.85rem;">No wallets found</p>
              </div>
          `;
          return;
      }

      dom.walletList.innerHTML = networkWallets.map(w => `
          <div class="wallet-item ${w.id === (activeWallet ? activeWallet.id : null) ? 'active' : ''}" data-id="${w.id}">
              <span class="wallet-dot"></span>
              <div class="wallet-info">
                  <div class="wallet-name">${w.name}</div>
                  <div class="wallet-balance-sm">${formatBalance(w.balance || 0)} SAY</div>
              </div>
              <button class="wallet-delete" data-id="${w.id}" title="Delete">
                  <i class="fas fa-times"></i>
              </button>
          </div>
      `).join('');

      dom.walletList.querySelectorAll('.wallet-item').forEach(el => {
          el.addEventListener('click', (e) => {
              if (e.target.closest('.wallet-delete')) return;
              const id = el.dataset.id;
              activeWallet = wallets.find(w => w.id === id) || null;
              saveState();
              render();
              loadTransactionHistory();
              showToast(`Selected: ${activeWallet ? activeWallet.name : ''}`, 'success');
          });
      });

      dom.walletList.querySelectorAll('.wallet-delete').forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const id = btn.dataset.id;
              if (confirm('Delete this wallet?')) {
                  wallets = wallets.filter(w => w.id !== id);
                  if (activeWallet && activeWallet.id === id) {
                      activeWallet = wallets.length ? wallets[0] : null;
                  }
                  saveState();
                  render();
                  showToast('Wallet deleted', 'success');
              }
          });
      });
  }

  function renderStats() {
      const networkWallets = wallets.filter(w => w.networkType === getNetworkType());
      const total = networkWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
      const staked = networkWallets.reduce((sum, w) => sum + (w.stake || 0), 0);
      const txCount = networkWallets.reduce((sum, w) => sum + (w.transactions || []).length, 0);

      dom.totalBalance.textContent = formatBalance(total);
      dom.walletCount.textContent = networkWallets.length;
      dom.txCount.textContent = txCount;
      dom.totalStaked.textContent = formatBalance(staked);
  }

  function renderDetail() {
      const w = activeWallet;
      if (!w) {
          dom.detailName.textContent = 'Select a Wallet';
          dom.detailStatus.className = 'detail-status';
          dom.detailStatus.innerHTML = '<i class="fas fa-circle"></i> Inactive';
          dom.detailAddress.textContent = '0x0000000000000000000000000000000000000000';
          dom.detailBalance.textContent = '0.00';
          dom.detailStaked.textContent = '0.00';
          dom.detailNonce.textContent = '0';
          dom.detailNetwork.textContent = getNetworkName();
          dom.detailTxList.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Select a wallet to view transactions</p></div>';
          return;
      }

      dom.detailName.textContent = w.name;
      dom.detailStatus.className = 'detail-status active';
      dom.detailStatus.innerHTML = '<i class="fas fa-circle"></i> Active';
      dom.detailAddress.textContent = w.address || '0x...';
      dom.detailBalance.textContent = formatBalance(w.balance || 0);
      dom.detailStaked.textContent = formatBalance(w.stake || 0);
      dom.detailNonce.textContent = w.nonce || 0;
      dom.detailNetwork.textContent = getNetworkName();

      renderTransactionHistory();
  }

  // ===== TRANSACTION HISTORY - FIXED AMOUNTS =====
  async function loadTransactionHistory() {
      if (!activeWallet) return;

      try {
          const res = await fetch(`${getApiBase()}/address/${activeWallet.address}`);
          if (!res.ok) return;

          const data = await res.json();
          if (data.transactions) {
              // FIX: Properly extract amounts from transaction data
              activeWallet.transactions = data.transactions.map(tx => {
                  let amount = 0;
                  
                  // Extract amount from data field
                  if (tx.data && tx.data.amount !== undefined) {
                      amount = parseFloat(tx.data.amount) || 0;
                  } else if (tx.amount !== undefined) {
                      amount = parseFloat(tx.amount) || 0;
                  }
                  
                  // For TRANSFER type, determine direction
                  if (tx.type === 'TRANSFER' && tx.data) {
                      if (tx.data.to === activeWallet.address) {
                          // Received - positive
                          amount = Math.abs(amount);
                      } else if (tx.data.from === activeWallet.address) {
                          // Sent - negative
                          amount = -Math.abs(amount);
                      }
                  }
                  
                  // For STAKE - negative (spending)
                  if (tx.type === 'STAKE') {
                      amount = -Math.abs(amount);
                  }
                  
                  // For REWARD - positive (earning)
                  if (tx.type === 'REWARD') {
                      amount = Math.abs(amount);
                  }
                  
                  // For UNSTAKE - positive (returning)
                  if (tx.type === 'UNSTAKE') {
                      amount = Math.abs(amount);
                  }
                  
                  return { ...tx, amount: amount };
              });
              
              activeWallet.balance = data.balance || 0;
              activeWallet.stake = data.stake || 0;
              activeWallet.nonce = data.nonce || 0;
              saveState();
              render();
          }
      } catch (error) {
          console.error('Error loading transaction history:', error);
      }
  }

  function renderTransactionHistory() {
      const w = activeWallet;
      if (!w) return;

      let txs = w.transactions || [];

      // Apply filters
      const typeFilter = dom.txTypeFilter.value;
      const dateFilter = dom.txDateFilter.value;

      if (typeFilter !== 'all') {
          txs = txs.filter(tx => tx.type === typeFilter);
      }

      if (dateFilter === 'today') {
          const today = new Date().toDateString();
          txs = txs.filter(tx => new Date(tx.time || 0).toDateString() === today);
      } else if (dateFilter === 'week') {
          const weekAgo = Date.now() - 7 * 86400000;
          txs = txs.filter(tx => (tx.time || 0) > weekAgo);
      } else if (dateFilter === 'month') {
          const monthAgo = Date.now() - 30 * 86400000;
          txs = txs.filter(tx => (tx.time || 0) > monthAgo);
      } else if (dateFilter === 'year') {
          const yearAgo = Date.now() - 365 * 86400000;
          txs = txs.filter(tx => (tx.time || 0) > yearAgo);
      } else if (dateFilter === 'custom') {
          const from = dom.txDateFrom.value;
          const to = dom.txDateTo.value;
          if (from) {
              const fromTime = new Date(from).getTime();
              txs = txs.filter(tx => (tx.time || 0) >= fromTime);
          }
          if (to) {
              const toTime = new Date(to).getTime() + 86400000;
              txs = txs.filter(tx => (tx.time || 0) <= toTime);
          }
      }

      filteredTxs = txs;

      // Update summary - FIX: Use actual amounts
      const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      dom.txTotalAmount.textContent = formatBalance(totalAmount);
      dom.txTotalCount.textContent = txs.length;

      if (txs.length === 0) {
          dom.detailTxList.innerHTML = `
              <div class="empty-state">
                  <i class="fas fa-inbox" style="font-size:32px;opacity:0.3;display:block;margin-bottom:8px;"></i>
                  <p>No transactions found</p>
              </div>
          `;
          return;
      }

      dom.detailTxList.innerHTML = txs.slice().reverse().map((tx, index) => {
          const typeClass = (tx.type || 'transfer').toLowerCase().replace('_', '');
          const isPositive = (tx.amount || 0) >= 0;
          const displayAmount = (tx.amount || 0);
          const time = tx.time ? new Date(tx.time).toLocaleString() : '';
          
          // Get address display
          let addressDisplay = '';
          if (tx.data) {
              if (tx.data.to && tx.data.to !== w.address) {
                  addressDisplay = shortAddr(tx.data.to);
              } else if (tx.data.from && tx.data.from !== w.address) {
                  addressDisplay = shortAddr(tx.data.from);
              } else if (tx.data.to) {
                  addressDisplay = shortAddr(tx.data.to);
              }
          }

          const iconMap = {
              'TRANSFER': isPositive ? 'fa-arrow-down' : 'fa-arrow-up',
              'STAKE': 'fa-lock',
              'UNSTAKE': 'fa-unlock',
              'REWARD': 'fa-gift',
              'default': 'fa-exchange-alt'
          };
          const icon = iconMap[tx.type] || iconMap.default;

          return `
              <div class="tx-item" data-index="${index}">
                  <span class="tx-type-badge ${typeClass}">
                      <i class="fas ${icon}"></i>
                      ${tx.type || 'transfer'}
                  </span>
                  <span class="tx-address-cell">${addressDisplay || '—'}</span>
                  <span class="tx-amount ${isPositive ? 'positive' : 'negative'}">
                      ${isPositive ? '+' : ''}${formatBalance(displayAmount)} SAY
                  </span>
                  <span class="tx-time">${time}</span>
              </div>
          `;
      }).join('');

      // Click to show transaction details
      dom.detailTxList.querySelectorAll('.tx-item').forEach(el => {
          el.addEventListener('click', function() {
              const index = parseInt(this.dataset.index);
              const tx = filteredTxs.slice().reverse()[index];
              if (tx) {
                  showTransactionDetails(tx);
              }
          });
      });
  }

  // ===== TRANSACTION DETAILS =====
  function showTransactionDetails(tx) {
      const content = dom.txDetailContent;
      const isPositive = (tx.amount || 0) >= 0;
      const typeClass = (tx.type || 'transfer').toLowerCase();

      content.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--border-color);">
                  <span class="tx-type-badge ${typeClass}" style="font-size:0.8rem;padding:4px 16px;">
                      <i class="fas ${isPositive ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                      ${tx.type || 'Transfer'}
                  </span>
                  <span class="tx-amount ${isPositive ? 'positive' : 'negative'}" style="font-size:1.2rem;">
                      ${isPositive ? '+' : ''}${formatBalance(tx.amount || 0)} SAY
                  </span>
              </div>
              <div class="form-group">
                  <label>Transaction ID</label>
                  <input type="text" value="${tx.txId || tx.hash || 'N/A'}" readonly style="font-family:monospace;font-size:0.7rem;" />
              </div>
              ${tx.data ? `
                  ${tx.data.from ? `
                  <div class="form-group">
                      <label>From</label>
                      <input type="text" value="${tx.data.from}" readonly style="font-family:monospace;font-size:0.7rem;" />
                  </div>
                  ` : ''}
                  ${tx.data.to ? `
                  <div class="form-group">
                      <label>To</label>
                      <input type="text" value="${tx.data.to}" readonly style="font-family:monospace;font-size:0.7rem;" />
                  </div>
                  ` : ''}
                  ${tx.data.amount !== undefined ? `
                  <div class="form-group">
                      <label>Amount</label>
                      <input type="text" value="${formatBalance(tx.data.amount)} SAY" readonly />
                  </div>
                  ` : ''}
              ` : ''}
              <div class="form-group">
                  <label>Timestamp</label>
                  <input type="text" value="${tx.time ? new Date(tx.time).toLocaleString() : 'N/A'}" readonly />
              </div>
              ${tx.gasPrice || tx.gasLimit ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  ${tx.gasPrice ? `
                  <div class="form-group">
                      <label>Gas Price</label>
                      <input type="text" value="${tx.gasPrice}" readonly />
                  </div>
                  ` : ''}
                  ${tx.gasLimit ? `
                  <div class="form-group">
                      <label>Gas Limit</label>
                      <input type="text" value="${tx.gasLimit}" readonly />
                  </div>
                  ` : ''}
              </div>
              ` : ''}
              ${tx.nonce !== undefined ? `
              <div class="form-group">
                  <label>Nonce</label>
                  <input type="text" value="${tx.nonce}" readonly />
              </div>
              ` : ''}
              <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border-color);">
                  <button class="btn-outline-sm" onclick="closeModal('txDetailModal')">Close</button>
              </div>
          </div>
      `;

      openModal('txDetailModal');
  }

  // ===== CHARTS =====
  function updateCharts() {
      if (!activeWallet) {
          if (spendingChart) { spendingChart.destroy();
              spendingChart = null; }
          if (monthlyChart) { monthlyChart.destroy();
              monthlyChart = null; }
          return;
      }
      renderSpendingChart();
      renderMonthlyChart();
  }

  function renderSpendingChart() {
      const ctx = document.getElementById('spendingChart');
      if (!ctx) return;
      const txs = activeWallet.transactions || [];

      const now = Date.now();
      const day = 86400000;
      const labels = [];
      const data = [];

      for (let i = chartPeriod - 1; i >= 0; i--) {
          const d = new Date(now - i * day);
          labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
          const dayTxs = txs.filter(tx => {
              const txTime = new Date(tx.time || 0).getTime();
              return txTime >= now - (i + 1) * day && txTime < now - i * day;
          });
          const total = dayTxs.reduce((sum, tx) => sum + (tx.amount < 0 ? tx.amount : 0), 0);
          data.push(Math.abs(total));
      }

      if (spendingChart) { spendingChart.destroy(); }

      spendingChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: labels,
              datasets: [{
                  label: 'Spending',
                  data: data,
                  backgroundColor: 'rgba(79, 110, 247, 0.5)',
                  borderColor: '#4f6ef7',
                  borderWidth: 1,
                  borderRadius: 4,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } }
              },
              animation: {
                  duration: 800,
                  easing: 'easeOutQuart'
              }
          }
      });
  }

  function renderMonthlyChart() {
      const ctx = document.getElementById('monthlyChart');
      if (!ctx) return;
      const txs = activeWallet.transactions || [];

      const months = {};
      txs.forEach(tx => {
          const d = new Date(tx.time || 0);
          const key = d.toLocaleDateString('en', { month: 'short', year: 'numeric' });
          if (!months[key]) months[key] = 0;
          months[key] += tx.amount || 0;
      });

      const labels = Object.keys(months);
      const data = Object.values(months);

      if (monthlyChart) { monthlyChart.destroy(); }

      monthlyChart = new Chart(ctx, {
          type: 'line',
          data: {
              labels: labels,
              datasets: [{
                  label: 'Net Flow',
                  data: data,
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 3,
                  pointBackgroundColor: '#10b981',
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                  y: { grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } }
              },
              animation: {
                  duration: 800,
                  easing: 'easeOutQuart'
              }
          }
      });
  }

  // ===== ANALYTICS =====
  function updateAnalytics() {
      if (!activeWallet) {
          dom.annualSummary.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> Select a wallet to view analytics</p>';
          return;
      }
      renderCategoryChart();
      renderNetWorthChart();
      renderHeatmap();
      renderAnnualSummary();
  }

  function renderCategoryChart() {
      const ctx = document.getElementById('categoryChart');
      if (!ctx) return;
      const txs = activeWallet.transactions || [];

      const categories = {
          'TRANSFER': 0,
          'STAKE': 0,
          'UNSTAKE': 0,
          'REWARD': 0,
          'OTHER': 0
      };

      txs.forEach(tx => {
          const type = tx.type || 'OTHER';
          if (categories[type] !== undefined) {
              categories[type] += Math.abs(tx.amount || 0);
          } else {
              categories['OTHER'] += Math.abs(tx.amount || 0);
          }
      });

      const labels = Object.keys(categories);
      const data = Object.values(categories);

      if (categoryChart) { categoryChart.destroy(); }

      const colors = ['#4f6ef7', '#f59e0b', '#ef4444', '#10b981', '#8a94a8'];

      categoryChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
              labels: labels,
              datasets: [{
                  data: data,
                  backgroundColor: colors,
                  borderWidth: 0,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                  legend: {
                      position: 'right',
                      labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
                  }
              },
              cutout: '65%',
              animation: {
                  duration: 800,
                  easing: 'easeOutQuart'
              }
          }
      });
  }

  function renderNetWorthChart() {
      const ctx = document.getElementById('netWorthChart');
      if (!ctx) return;
      const txs = activeWallet.transactions || [];

      const sorted = txs.slice().sort((a, b) => (a.time || 0) - (b.time || 0));
      const labels = [];
      const data = [];
      let running = 0;

      sorted.forEach(tx => {
          running += (tx.amount || 0);
          labels.push(new Date(tx.time || 0).toLocaleDateString('en', { month: 'short', day: 'numeric' }));
          data.push(running);
      });

      if (netWorthChart) { netWorthChart.destroy(); }

      netWorthChart = new Chart(ctx, {
          type: 'line',
          data: {
              labels: labels.length > 0 ? labels : ['No Data'],
              datasets: [{
                  label: 'Net Worth',
                  data: data.length > 0 ? data : [0],
                  borderColor: '#4f6ef7',
                  backgroundColor: 'rgba(79, 110, 247, 0.05)',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 1,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                  y: { grid: { color: 'rgba(0,0,0,0.05)' } },
                  x: { grid: { display: false } }
              },
              animation: {
                  duration: 800,
                  easing: 'easeOutQuart'
              }
          }
      });
  }

  function renderHeatmap() {
      const grid = dom.heatmapGrid;
      if (!grid) return;
      const txs = activeWallet.transactions || [];

      const dayMap = {};
      for (let i = 0; i < 7; i++) {
          dayMap[i] = 0;
      }

      txs.forEach(tx => {
          const d = new Date(tx.time || 0);
          const day = d.getDay();
          dayMap[day] = (dayMap[day] || 0) + 1;
      });

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const maxCount = Math.max(...Object.values(dayMap), 1);

      grid.innerHTML = days.map((day, i) => {
          const count = dayMap[i] || 0;
          const intensity = count / maxCount;
          let className = 'heatmap-cell';
          if (count > 0) className += ' has-tx';
          if (intensity > 0.5) className += ' many-tx';
          return `<div class="${className}" title="${day}: ${count} transactions">${day.substring(0, 1)}</div>`;
      }).join('');
  }

  function renderAnnualSummary() {
      const container = dom.annualSummary;
      if (!container) return;
      const txs = activeWallet.transactions || [];

      const years = {};
      txs.forEach(tx => {
          const year = new Date(tx.time || 0).getFullYear();
          if (!years[year]) years[year] = { total: 0, count: 0 };
          years[year].total += tx.amount || 0;
          years[year].count += 1;
      });

      const sortedYears = Object.keys(years).sort();

      if (sortedYears.length === 0) {
          container.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> No annual data available</p>';
          return;
      }

      container.innerHTML = sortedYears.map(year => `
          <div class="annual-item">
              <div class="year">${year}</div>
              <div class="amount ${years[year].total >= 0 ? 'text-success' : 'text-error'}">
                  ${years[year].total >= 0 ? '+' : ''}${formatBalance(years[year].total)}
              </div>
              <div class="count">${years[year].count} tx</div>
          </div>
      `).join('');
  }

  // ===== QR CODE GENERATION (For receiving payments) =====
  function generateQR(address) {
      dom.qrContainer.innerHTML = '';
      if (!address) return;
      qrCodeInstance = new QRCode(dom.qrContainer, {
          text: address,
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H,
      });
      dom.qrAddressDisplay.textContent = address;
  }

  // ===== NETWORK SWITCHING =====
  dom.networkSelect.addEventListener('change', function() {
      currentNetwork = this.value;
      dom.detailNetwork.textContent = getNetworkName();
      render();
      if (activeWallet) loadTransactionHistory();
      showToast(`Switched to ${getNetworkName()}`, 'success');
  });

  // ===== REFRESH =====
  dom.refreshBtn.addEventListener('click', () => {
      if (activeWallet) {
          showLoading('Refreshing...');
          loadTransactionHistory().then(() => {
              hideLoading();
              showToast('Data refreshed!', 'success');
          });
      } else {
          render();
          showToast('Refreshed!', 'success');
      }
  });

  // ===== SEND TRANSACTION =====
  dom.sendBtn.addEventListener('click', async () => {
      if (!activeWallet) {
          showToast('Please select a wallet first', 'error');
          return;
      }

      try {
          const to = dom.sendTo.value.trim();
          const amount = parseFloat(dom.sendAmount.value);
          const gasPrice = parseInt(dom.sendGasPrice.value) || undefined;
          const gasLimit = parseInt(dom.sendGasLimit.value) || undefined;

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
              gasLimit: gasLimit || gas.recommendedGasLimit || 21000,
              gasPrice: gasPrice || gas.minGasPrice || 1,
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
              dom.sendResult.innerHTML = `
                  <div class="success-message">
                      <i class="fas fa-check-circle"></i>
                      <strong>Transaction Sent!</strong><br>
                      <small>TX ID: ${result.txId ? result.txId.substring(0, 16) + '...' : 'Pending'}</small>
                  </div>
              `;
              dom.sendTo.value = '';
              dom.sendAmount.value = '';
              dom.sendGasPrice.value = '';
              dom.sendGasLimit.value = '';
              showToast('Transaction sent!', 'success');

              setTimeout(() => {
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
  });

  // ===== STAKE / UNSTAKE =====
  dom.stakeBtn.addEventListener('click', async () => {
      if (!activeWallet) {
          showToast('Please select a wallet first', 'error');
          return;
      }

      try {
          const amount = parseFloat(dom.stakeAmount.value);

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
              gasLimit: gas.recommendedGasLimit || 21000,
              gasPrice: gas.minGasPrice || 1,
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
              dom.stakeResult.innerHTML = `
                  <div class="success-message">
                      <i class="fas fa-check-circle"></i>
                      <strong>Stake Transaction Broadcast!</strong><br>
                      <small>TX ID: ${result.txId ? result.txId.substring(0, 16) + '...' : 'Pending'}</small>
                  </div>
              `;
              dom.stakeAmount.value = '';
              showToast('Tokens staked!', 'success');

              setTimeout(() => {
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
  });

  dom.unstakeBtn.addEventListener('click', async () => {
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
              gasLimit: gas.recommendedGasLimit || 21000,
              gasPrice: gas.minGasPrice || 1,
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
              dom.stakeResult.innerHTML = `
                  <div class="success-message">
                      <i class="fas fa-check-circle"></i>
                      <strong>Unstake Transaction Broadcast!</strong><br>
                      <small>TX ID: ${result.txId ? result.txId.substring(0, 16) + '...' : 'Pending'}</small>
                  </div>
              `;
              showToast('Unstake initiated!', 'success');

              setTimeout(() => {
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
  });

  dom.claimRewardsBtn.addEventListener('click', async () => {
      if (!activeWallet) {
          showToast('Please select a wallet first', 'error');
          return;
      }
      showToast('Reward claiming feature coming soon!', 'warning');
  });

  // ===== EXPORT FUNCTIONS =====
  dom.exportAllBtn.addEventListener('click', () => {
      if (wallets.length === 0) {
          showToast('No wallets to export', 'error');
          return;
      }

      const exportData = {
          version: '2.0',
          exportedAt: new Date().toISOString(),
          network: currentNetwork,
          wallets: wallets.map(w => ({
              name: w.name,
              address: w.address,
              privateKey: w.privateKey,
              publicKey: w.publicKey,
              balance: w.balance || 0,
              stake: w.stake || 0,
              transactions: w.transactions || [],
              createdAt: w.createdAt,
              networkType: w.networkType
          }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sayman_wallets_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Wallets exported!', 'success');
  });

  dom.exportWalletBtn.addEventListener('click', () => {
      if (!activeWallet) {
          showToast('Select a wallet first', 'error');
          return;
      }

      const exportData = {
          version: '2.0',
          exportedAt: new Date().toISOString(),
          name: activeWallet.name,
          address: activeWallet.address,
          privateKey: activeWallet.privateKey,
          publicKey: activeWallet.publicKey,
          balance: activeWallet.balance || 0,
          stake: activeWallet.stake || 0,
          transactions: activeWallet.transactions || [],
          createdAt: activeWallet.createdAt,
          networkType: activeWallet.networkType
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sayman_${activeWallet.name}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Wallet exported!', 'success');
  });

  // ===== IMPORT JSON =====
  dom.importJsonBtn.addEventListener('click', () => openModal('importJsonModal'));

  dom.importJsonConfirmBtn.addEventListener('click', async () => {
      const file = dom.jsonFileInput.files[0];
      if (!file) {
          dom.jsonImportStatus.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Please select a file.</div>';
          return;
      }

      dom.jsonImportStatus.innerHTML = '<div style="padding:8px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Importing...</div>';

      try {
          const text = await file.text();
          const data = JSON.parse(text);

          let imported = 0;

          if (data.wallets && Array.isArray(data.wallets)) {
              for (const wData of data.wallets) {
                  if (wData.privateKey) {
                      const w = await createWalletFromPrivateKey(wData.privateKey, wData.name || 'Imported');
                      if (wData.transactions) w.transactions = wData.transactions;
                      if (wData.balance) w.balance = wData.balance;
                      if (wData.stake) w.stake = wData.stake;
                      wallets.push(w);
                      imported++;
                  }
              }
          } else if (data.privateKey) {
              const w = await createWalletFromPrivateKey(data.privateKey, data.name || 'Imported Wallet');
              if (data.transactions) w.transactions = data.transactions;
              if (data.balance) w.balance = data.balance;
              if (data.stake) w.stake = data.stake;
              wallets.push(w);
              imported++;
          }

          if (imported > 0) {
              activeWallet = wallets[wallets.length - 1];
              saveState();
              render();
              dom.jsonImportStatus.innerHTML = `<div class="success-message"><i class="fas fa-check-circle"></i> Imported ${imported} wallet(s)!</div>`;
              dom.jsonFileInput.value = '';
              setTimeout(() => closeModal('importJsonModal'), 1500);
              showToast(`Imported ${imported} wallet(s)!`, 'success');
          } else {
              throw new Error('No valid wallets found in file');
          }
      } catch (err) {
          dom.jsonImportStatus.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${err.message}</div>`;
      }
  });

  // ===== QR SCAN - FIXED: Auto-fills recipient address for sending =====
  dom.importQrBtn.addEventListener('click', () => {
      openModal('scanQrModal');
      setTimeout(startQrScanner, 500);
  });

  dom.scanQrNavBtn.addEventListener('click', () => {
      openModal('scanQrModal');
      setTimeout(startQrScanner, 500);
  });

  async function startQrScanner() {
      if (isScanning) return;

      try {
          if (typeof Html5Qrcode === 'undefined') {
              dom.scanResult.innerHTML = `
                  <div class="error-message">
                      <i class="fas fa-exclamation-circle"></i> 
                      QR scanner library not loaded. Please refresh.
                  </div>
              `;
              return;
          }

          dom.qrScanner.innerHTML = '';
          html5QrCode = new Html5Qrcode('qrScanner');

          const config = {
              fps: 15,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
          };

          isScanning = true;
          dom.stopScanBtn.style.display = 'inline-flex';
          dom.scanResult.innerHTML = `
              <div style="padding:8px;color:var(--text-secondary);">
                  <i class="fas fa-spinner fa-spin"></i> Starting camera...
              </div>
          `;

          await html5QrCode.start({
              facingMode: 'environment'
          }, config, onQrScanSuccess, onQrScanError);

          dom.scanResult.innerHTML = `
              <div style="padding:8px;color:var(--success);">
                  <i class="fas fa-check-circle"></i> Camera active. Scan a QR code to auto-fill recipient address.
              </div>
          `;

      } catch (err) {
          isScanning = false;
          dom.stopScanBtn.style.display = 'none';
          dom.scanResult.innerHTML = `
              <div class="error-message">
                  <i class="fas fa-exclamation-circle"></i> 
                  Camera access denied. 
                  <button class="btn-outline-sm" onclick="document.getElementById('qrFileInput').click()" style="margin-top:8px;">
                      <i class="fas fa-upload"></i> Upload Image
                  </button>
              </div>
          `;
          console.error('QR Scanner error:', err);
      }
  }

  function onQrScanSuccess(decodedText) {
      // Stop scanner immediately
      stopQrScanner();
      
      // Close the scanner modal
      closeModal('scanQrModal');
      
      // FIX: Auto-fill the send form with the scanned address
      if (decodedText && decodedText.length === 40) {
          // It's a valid address - auto-fill send form
          dom.sendTo.value = decodedText;
          
          // Switch to send tab
          document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          document.querySelector('[data-tab="send"]').classList.add('active');
          document.getElementById('tab-send').classList.add('active');
          
          showToast('✅ Recipient address auto-filled from QR scan!', 'success');
      } else {
          // Try to parse as JSON with address field
          try {
              const data = JSON.parse(decodedText);
              if (data.address && data.address.length === 40) {
                  dom.sendTo.value = data.address;
                  
                  // Auto-fill amount if present
                  if (data.amount) {
                      dom.sendAmount.value = data.amount;
                  }
                  
                  document.querySelector('[data-tab="send"]').classList.add('active');
                  document.getElementById('tab-send').classList.add('active');
                  
                  showToast('✅ Payment details auto-filled from QR scan!', 'success');
              } else if (data.privateKey) {
                  // This is a wallet export QR - import it
                  importWalletFromQrData(decodedText);
              } else {
                  showToast('⚠️ QR contains invalid address', 'error');
              }
          } catch (e) {
              // Check if it's a private key
              const cleaned = decodedText.replace('0x', '').trim();
              if (cleaned.length === 64) {
                  // Import wallet from private key
                  importWalletFromQrData(decodedText);
              } else {
                  showToast('⚠️ QR does not contain a valid address', 'error');
              }
          }
      }
      
      dom.scanResult.innerHTML = '';
  }

  function onQrScanError(err) {
      // Ignore - this fires constantly during scanning
  }

  function stopQrScanner() {
      if (html5QrCode) {
          try {
              html5QrCode.stop().catch(() => {});
          } catch (e) {}
          html5QrCode = null;
      }
      isScanning = false;
      dom.stopScanBtn.style.display = 'none';
  }

  dom.stopScanBtn.addEventListener('click', () => {
      stopQrScanner();
      dom.scanResult.innerHTML = '<div style="padding:8px;color:var(--text-muted);">Scanner stopped</div>';
  });

  dom.uploadQrBtn.addEventListener('click', () => dom.qrFileInput.click());

  dom.qrFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
          dom.scanResult.innerHTML = '<div style="padding:8px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Processing image...</div>';

          stopQrScanner();

          if (typeof Html5Qrcode !== 'undefined') {
              const tempScanner = new Html5Qrcode('qrScanner');
              try {
                  const result = await tempScanner.scanFile(file, false);
                  if (result) {
                      onQrScanSuccess(result);
                      dom.qrFileInput.value = '';
                      return;
                  }
              } catch (err) {
                  console.log('File scan error:', err);
              }
          }

          // If auto-scan fails, show manual entry option
          dom.scanResult.innerHTML = `
              <div class="error-message">
                  <i class="fas fa-exclamation-circle"></i> 
                  Could not decode QR from image.
                  <button class="btn-outline-sm" onclick="document.getElementById('qrFileInput').click()" style="margin-top:8px;">
                      <i class="fas fa-upload"></i> Try Another Image
                  </button>
              </div>
          `;
      } catch (err) {
          dom.scanResult.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${err.message}</div>`;
      }
      dom.qrFileInput.value = '';
  });

  async function importWalletFromQrData(data) {
      try {
          let walletData;
          try {
              walletData = JSON.parse(data);
          } catch (e) {
              const pk = data.replace('0x', '').trim();
              if (pk.length === 64) {
                  const name = prompt('Name for this wallet?', 'Scanned Wallet');
                  const w = await createWalletFromPrivateKey(pk, name || 'Scanned Wallet');
                  wallets.push(w);
                  activeWallet = w;
                  saveState();
                  render();
                  showToast('✅ Wallet imported from QR scan!', 'success');
                  return;
              }
              throw new Error('Invalid QR data');
          }

          if (walletData.privateKey) {
              const name = walletData.name || 'Scanned Wallet';
              const w = await createWalletFromPrivateKey(walletData.privateKey, name);
              if (walletData.transactions) w.transactions = walletData.transactions;
              if (walletData.balance) w.balance = walletData.balance;
              if (walletData.stake) w.stake = walletData.stake;
              wallets.push(w);
              activeWallet = w;
              saveState();
              render();
              showToast('✅ Wallet imported from QR scan!', 'success');
          } else {
              throw new Error('No private key found in QR data');
          }
      } catch (err) {
          showToast('Failed to import wallet: ' + err.message, 'error');
          throw err;
      }
  }

  // ===== SHOW QR (For receiving payments) =====
  dom.showQrBtn.addEventListener('click', () => {
      if (!activeWallet) {
          showToast('Select a wallet first', 'error');
          return;
      }
      generateQR(activeWallet.address);
      openModal('qrModal');
  });

  dom.downloadQrBtn.addEventListener('click', () => {
      const canvas = dom.qrContainer.querySelector('canvas');
      if (!canvas) { showToast('No QR to download', 'error'); return; }
      const link = document.createElement('a');
      link.download = `sayman_qr_${activeWallet.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('QR downloaded!', 'success');
  });

  dom.shareQrBtn.addEventListener('click', async () => {
      const canvas = dom.qrContainer.querySelector('canvas');
      if (!canvas) { showToast('No QR to share', 'error'); return; }
      try {
          const blob = await new Promise(resolve => canvas.toBlob(resolve));
          if (navigator.share) {
              await navigator.share({
                  title: 'Sayman Wallet QR',
                  text: `Send payment to: ${activeWallet.address}`,
                  files: [new File([blob], 'sayman_qr.png', { type: 'image/png' })]
              });
          } else {
              await copyToClipboard(activeWallet.address, 'Address copied!');
          }
      } catch (err) {
          if (err.name !== 'AbortError') {
              console.error('Share failed:', err);
          }
      }
  });

  dom.printQrBtn.addEventListener('click', () => {
      const canvas = dom.qrContainer.querySelector('canvas');
      if (!canvas) { showToast('No QR to print', 'error'); return; }
      const win = window.open('', '_blank');
      win.document.write(`
          <html><head><title>QR Code</title>
          <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}</style>
          </head>
          <body>
              <img src="${canvas.toDataURL('image/png')}" style="max-width:300px;" />
              <script>window.print();window.close();<\/script>
          </body></html>
      `);
  });

  // ===== VIEW DETAILS =====
  dom.viewDetailsBtn.addEventListener('click', () => {
      if (!activeWallet) {
          showToast('Select a wallet first', 'error');
          return;
      }
      showWalletDetails(activeWallet);
  });

  function showWalletDetails(wallet) {
      const content = dom.detailsContent;
      content.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group">
                  <label><i class="fas fa-tag"></i> Name</label>
                  <input type="text" value="${wallet.name}" readonly />
              </div>
              <div class="form-group">
                  <label><i class="fas fa-network-wired"></i> Network</label>
                  <input type="text" value="${wallet.networkType.toUpperCase()}" readonly />
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                  <label><i class="fas fa-address-book"></i> Address</label>
                  <div style="display:flex;gap:8px;">
                      <input type="text" value="${wallet.address}" readonly style="flex:1;font-family:monospace;font-size:0.8rem;" />
                      <button class="btn-outline-sm" onclick="copyToClipboard('${wallet.address}','Address copied!')"><i class="fas fa-copy"></i></button>
                  </div>
              </div>
              <div class="form-group">
                  <label><i class="fas fa-coins"></i> Balance</label>
                  <input type="text" value="${formatBalance(wallet.balance || 0)} SAY" readonly />
              </div>
              <div class="form-group">
                  <label><i class="fas fa-lock"></i> Staked</label>
                  <input type="text" value="${formatBalance(wallet.stake || 0)} SAY" readonly />
              </div>
              <div class="form-group">
                  <label><i class="fas fa-hashtag"></i> Nonce</label>
                  <input type="text" value="${wallet.nonce || 0}" readonly />
              </div>
              <div class="form-group">
                  <label><i class="fas fa-calendar"></i> Created</label>
                  <input type="text" value="${new Date(wallet.createdAt).toLocaleString()}" readonly />
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                  <label><i class="fas fa-key"></i> Public Key</label>
                  <textarea readonly style="width:100%;height:60px;font-family:monospace;font-size:0.7rem;padding:8px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-input);">${wallet.publicKey}</textarea>
              </div>
              <div class="form-group" style="grid-column:1/-1;">
                  <label><i class="fas fa-key"></i> Private Key</label>
                  <div style="display:flex;gap:8px;">
                      <input type="password" value="${wallet.privateKey}" readonly style="flex:1;font-family:monospace;font-size:0.8rem;" id="privateKeyDisplay" />
                      <button class="btn-outline-sm" onclick="togglePrivateKey()"><i class="fas fa-eye"></i></button>
                      <button class="btn-outline-sm" onclick="copyToClipboard('${wallet.privateKey}','Private key copied!')"><i class="fas fa-copy"></i></button>
                  </div>
                  <div style="margin-top:8px;padding:8px 12px;background:var(--error-light);border:1px solid var(--error);border-radius:var(--radius-sm);font-size:0.75rem;color:var(--error);">
                      <i class="fas fa-exclamation-triangle"></i> Never share your private key with anyone!
                  </div>
              </div>
              <div class="form-group" style="grid-column:1/-1;text-align:center;padding-top:8px;border-top:1px solid var(--border-color);">
                  <button class="btn-outline-sm" onclick="closeModal('detailsModal')"><i class="fas fa-times"></i> Close</button>
              </div>
          </div>
      `;
      window._privateKey = wallet.privateKey;
      openModal('detailsModal');
  }

  window.togglePrivateKey = function() {
      const input = document.getElementById('privateKeyDisplay');
      if (input) {
          const icon = input.parentElement.querySelector('.btn-outline-sm i');
          if (input.type === 'password') {
              input.type = 'text';
              icon.className = 'fas fa-eye-slash';
          } else {
              input.type = 'password';
              icon.className = 'fas fa-eye';
          }
      }
  };

  window.copyAddress = function() {
      if (activeWallet) {
          copyToClipboard(activeWallet.address, 'Address copied!');
      }
  };

  // ===== FILTERS =====
  dom.applyFilterBtn.addEventListener('click', () => {
      if (dom.txDateFilter.value === 'custom') {
          dom.txDateFrom.style.display = 'inline-block';
          dom.txDateTo.style.display = 'inline-block';
      } else {
          dom.txDateFrom.style.display = 'none';
          dom.txDateTo.style.display = 'none';
      }
      renderTransactionHistory();
      showToast('Filters applied', 'success');
  });

  dom.resetFilterBtn.addEventListener('click', () => {
      dom.txTypeFilter.value = 'all';
      dom.txDateFilter.value = 'all';
      dom.txDateFrom.value = '';
      dom.txDateTo.value = '';
      dom.txDateFrom.style.display = 'none';
      dom.txDateTo.style.display = 'none';
      renderTransactionHistory();
      showToast('Filters reset', 'success');
  });

  dom.txDateFilter.addEventListener('change', function() {
      if (this.value === 'custom') {
          dom.txDateFrom.style.display = 'inline-block';
          dom.txDateTo.style.display = 'inline-block';
      } else {
          dom.txDateFrom.style.display = 'none';
          dom.txDateTo.style.display = 'none';
      }
  });

  // ===== CHART PERIOD CONTROLS =====
  document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', function() {
          const parent = this.closest('.chart-periods');
          parent.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');

          const period = parseInt(this.dataset.period);
          if (!isNaN(period)) {
              chartPeriod = period;
              updateCharts();
              showToast(`Showing ${period} day${period > 1 ? 's' : ''}`, 'info');
          }
      });
  });

  // ===== SEARCH =====
  dom.walletSearch.addEventListener('input', renderWalletList);

  // ===== MODAL CONTROLS =====
  function openModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('open');
      document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
      document.body.style.overflow = 'auto';
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
              overlay.classList.remove('open');
              document.body.style.overflow = 'auto';
              if (overlay.id === 'scanQrModal') {
                  stopQrScanner();
              }
          }
      });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
          const id = btn.dataset.modal;
          if (id) {
              closeModal(id);
              if (id === 'scanQrModal') {
                  stopQrScanner();
              }
          }
      });
  });

  // ===== ADD WALLET =====
  dom.addWalletBtn.addEventListener('click', () => openModal('addWalletModal'));

  dom.createWalletBtn.addEventListener('click', async () => {
      const name = dom.newWalletName.value.trim() || 'New Wallet';
      const w = await generateNewWallet(name);
      wallets.push(w);
      activeWallet = w;
      dom.newWalletName.value = '';
      closeModal('addWalletModal');
      saveState();
      render();
      showToast('Wallet created!', 'success');
  });

  dom.importPrivateKeyBtn.addEventListener('click', () => {
      dom.privateKeyArea.classList.toggle('hidden');
  });

  dom.importKeyConfirmBtn.addEventListener('click', async () => {
      const pk = dom.privateKeyInput.value.trim().replace('0x', '');
      if (!pk || pk.length !== 64) {
          showToast('Please enter a valid private key (64 hex chars)', 'error');
          return;
      }

      try {
          const name = prompt('Name for this wallet?', 'Imported Wallet');
          const w = await createWalletFromPrivateKey(pk, name || 'Imported Wallet');
          wallets.push(w);
          activeWallet = w;
          dom.privateKeyInput.value = '';
          dom.privateKeyArea.classList.add('hidden');
          closeModal('addWalletModal');
          saveState();
          render();
          showToast('Wallet imported!', 'success');
      } catch (err) {
          showToast('Invalid private key', 'error');
      }
  });

  // ===== TAB SWITCHING =====
  document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.addEventListener('click', function() {
          document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
          this.classList.add('active');
          const panel = document.getElementById('tab-' + this.dataset.tab);
          if (panel) panel.classList.add('active');

          if (this.dataset.tab === 'history') {
              renderTransactionHistory();
          } else if (this.dataset.tab === 'analytics') {
              updateAnalytics();
          }
      });
  });

  // ===== TOAST SYSTEM =====
  function showToast(message, type = 'info') {
      const existing = document.querySelector('.toast-container');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.className = 'toast-container';
      container.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 99999;
          animation: fadeUp 0.4s ease;
      `;

      const toast = document.createElement('div');
      const colors = {
          success: 'var(--success)',
          error: 'var(--error)',
          warning: 'var(--warning)',
          info: 'var(--accent)'
      };
      const bgColors = {
          success: 'var(--success-light)',
          error: 'var(--error-light)',
          warning: 'var(--warning-light)',
          info: 'var(--accent-light)'
      };
      const icons = {
          success: 'fa-check-circle',
          error: 'fa-exclamation-circle',
          warning: 'fa-exclamation-triangle',
          info: 'fa-info-circle'
      };

      toast.style.cssText = `
          padding: 12px 20px;
          background: ${bgColors[type] || bgColors.info};
          color: ${type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : 'var(--text-primary)'};
          border: 1px solid ${colors[type] || colors.info};
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          box-shadow: var(--shadow-lg);
          font-family: var(--font);
          max-width: 400px;
          display: flex;
          align-items: center;
          gap: 10px;
      `;

      toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${message}`;
      container.appendChild(toast);
      document.body.appendChild(container);

      setTimeout(() => {
          container.style.opacity = '0';
          container.style.transform = 'translateX(400px)';
          container.style.transition = 'all 0.3s ease';
          setTimeout(() => container.remove(), 300);
      }, 4000);
  }

  window.showToast = showToast;

  // ===== COPY TO CLIPBOARD =====
  function copyToClipboard(text, message = 'Copied!') {
      navigator.clipboard.writeText(text).then(() => {
          showToast(message, 'success');
      }).catch(() => {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showToast(message, 'success');
      });
  }

  window.copyToClipboard = copyToClipboard;

  // ===== LOADING =====
  function showLoading(message = 'Loading...') {
      let overlay = document.getElementById('customLoading');
      if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'customLoading';
          overlay.style.cssText = `
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.5);
              backdrop-filter: blur(4px);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 99998;
          `;
          document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
          <div style="background:var(--bg-secondary);padding:32px;border-radius:var(--radius-lg);border:1px solid var(--border-color);text-align:center;max-width:300px;">
              <div class="loader-spinner" style="margin:0 auto 16px;"></div>
              <div style="font-weight:500;">${message}</div>
          </div>
      `;
      overlay.style.display = 'flex';
  }

  function hideLoading() {
      const overlay = document.getElementById('customLoading');
      if (overlay) overlay.style.display = 'none';
  }

  window.showLoading = showLoading;
  window.hideLoading = hideLoading;

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
          document.body.style.overflow = 'auto';
          stopQrScanner();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
          e.preventDefault();
          openModal('addWalletModal');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          dom.walletSearch.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
          e.preventDefault();
          dom.refreshBtn.click();
      }
  });

  // ===== PROGRESS LOADING =====
  function updateProgress(percent) {
      dom.progressBar.style.width = percent + '%';
      dom.progressText.textContent = percent + '%';
  }

  // ===== INIT =====
  async function init() {
      let progress = 0;
      const interval = setInterval(() => {
          progress += Math.random() * 8 + 2;
          if (progress > 90) {
              clearInterval(interval);
              progress = 90;
              updateProgress(progress);
          } else {
              updateProgress(Math.min(progress, 90));
          }
      }, 200);

      const hasState = loadState();
      dom.networkSelect.value = currentNetwork;

      setTimeout(async () => {
          if (wallets.length === 0) {
              const demo = await generateNewWallet('Main Wallet');
              demo.balance = 1250.75;
              demo.transactions = [
                  { type: 'TRANSFER', amount: 500, time: new Date(Date.now() - 86400000 * 2).toISOString(), data: { from: '0x1234', to: '0x5678' } },
                  { type: 'TRANSFER', amount: -120, time: new Date(Date.now() - 86400000 * 1.5).toISOString(), data: { from: '0x5678', to: '0x1234' } },
                  { type: 'STAKE', amount: -300, time: new Date(Date.now() - 86400000).toISOString(), data: { from: '0x1234', amount: 300 } },
                  { type: 'REWARD', amount: 45.75, time: new Date(Date.now() - 43200000).toISOString(), data: { from: 'system', to: '0x1234' } },
              ];
              wallets.push(demo);
              activeWallet = demo;
              saveState();
          }

          if (!activeWallet && wallets.length > 0) {
              activeWallet = wallets[0];
          }

          updateProgress(100);
          setTimeout(() => {
              dom.loading.classList.add('hidden');
          }, 400);

          render();

          if (activeWallet) {
              await loadTransactionHistory();
          }

          console.log('🚀 Sayman Wallet Manager Pro v2.0 initialized');
          console.log(`📊 ${wallets.length} wallets loaded on ${getNetworkName()}`);
      }, 600);

      // Auto-start QR scanner when modal opens
      const scanModal = document.getElementById('scanQrModal');
      const observer = new MutationObserver(() => {
          if (scanModal.classList.contains('open')) {
              setTimeout(startQrScanner, 300);
          } else {
              stopQrScanner();
          }
      });
      observer.observe(scanModal, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }

})();