// ============================================================
//  Sayman Wallet Manager — Premium Edition
//  Features: Multi-wallet, QR scan, JSON import/export,
//  analytics charts, per-wallet export, spending graphs,
//  invoice generation, staking, faucet, and more.
// ============================================================

(function() {
  'use strict';

  // ===== STATE =====
  let wallets = [];
  let activeWallet = null;
  let currentNetwork = 'testnet';
  let spendingChart = null;
  let monthlyChart = null;
  let qrCodeInstance = null;
  let chartPeriod = 7;

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

  const faucetEndpoints = {
      'testnet': 'https://sayman-faucet.onrender.com/faucet',
      'public-testnet': 'https://sayman-faucet.onrender.com/faucet',
      'mainnet': null
  };

  // ===== DOM REFS =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
      loading: $('#loading-screen'),
      app: $('#app'),
      walletList: $('#walletList'),
      totalBalance: $('#totalBalance'),
      walletCount: $('#walletCount'),
      txCount: $('#txCount'),
      totalStaked: $('#totalStaked'),
      detailName: $('#detailName'),
      detailAddress: $('#detailAddress'),
      detailBalance: $('#detailBalance'),
      detailStaked: $('#detailStaked'),
      detailNonce: $('#detailNonce'),
      detailTxList: $('#detailTxList'),
      networkBadge: $('#networkBadge'),
      // modals
      addWalletModal: $('#addWalletModal'),
      qrModal: $('#qrModal'),
      scanQrModal: $('#scanQrModal'),
      importJsonModal: $('#importJsonModal'),
      invoiceModal: $('#invoiceModal'),
      qrCodeContainer: $('#qrCodeContainer'),
      qrAddress: $('#qrAddress'),
      // buttons
      addWalletBtn: $('#addWalletBtn'),
      importJsonBtn: $('#importJsonBtn'),
      importQrBtn: $('#importQrBtn'),
      exportAllBtn: $('#exportAllBtn'),
      exportWalletBtn: $('#exportWalletBtn'),
      showQrBtn: $('#showQrBtn'),
      scanQrBtn: $('#scanQrBtn'),
      generateInvoiceBtn: $('#generateInvoiceBtn'),
      themeToggle: $('#themeToggle'),
      createWalletBtn: $('#createWalletBtn'),
      importPrivateKeyBtn: $('#importPrivateKeyBtn'),
      importKeyConfirmBtn: $('#importKeyConfirmBtn'),
      privateKeyInput: $('#privateKeyInput'),
      privateKeyInputArea: $('#privateKeyInputArea'),
      newWalletName: $('#newWalletName'),
      jsonFileInput: $('#jsonFileInput'),
      importJsonConfirmBtn: $('#importJsonConfirmBtn'),
      jsonImportStatus: $('#jsonImportStatus'),
      uploadQrBtn: $('#uploadQrBtn'),
      qrFileInput: $('#qrFileInput'),
      downloadQrBtn: $('#downloadQrBtn'),
      shareQrBtn: $('#shareQrBtn'),
      sendBtn: $('#sendBtn'),
      sendTo: $('#sendTo'),
      sendAmount: $('#sendAmount'),
      sendResult: $('#sendResult'),
      stakeBtn: $('#stakeBtn'),
      unstakeBtn: $('#unstakeBtn'),
      stakeAmount: $('#stakeAmount'),
      stakeResult: $('#stakeResult'),
      createResult: $('#createResult'),
      scanResult: $('#scanResult'),
      invoiceContent: $('#invoiceContent'),
  };

  // ===== HELPERS =====
  function getApiBase() {
      return networkEndpoints[currentNetwork];
  }

  function getNetworkType() {
      return networkTypes[currentNetwork];
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
      dom.networkBadge.textContent = currentNetwork;
  }

  function renderWalletList() {
      const networkWallets = wallets.filter(w => w.networkType === getNetworkType());

      if (networkWallets.length === 0) {
          dom.walletList.innerHTML = `
              <div style="padding:20px 8px; text-align:center; color:var(--text-muted); font-size:0.85rem;">
                  No wallets yet.<br>Click "+ New" to create one.
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
              <div class="wallet-actions">
                  <button class="wallet-delete" data-id="${w.id}" title="Delete">✕</button>
              </div>
          </div>
      `).join('');

      // Click to activate
      dom.walletList.querySelectorAll('.wallet-item').forEach(el => {
          el.addEventListener('click', (e) => {
              if (e.target.closest('.wallet-delete')) return;
              const id = el.dataset.id;
              activeWallet = wallets.find(w => w.id === id) || null;
              saveState();
              render();
              loadTransactionHistory();
          });
      });

      // Delete
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
          dom.detailName.textContent = 'Select a wallet';
          dom.detailAddress.textContent = '0x...';
          dom.detailBalance.textContent = '0.00';
          dom.detailStaked.textContent = '0.00';
          dom.detailNonce.textContent = '0';
          dom.detailTxList.innerHTML = '<p class="empty-state">No wallet selected</p>';
          return;
      }

      dom.detailName.textContent = w.name;
      dom.detailAddress.textContent = w.address || '0x...';
      dom.detailBalance.textContent = formatBalance(w.balance || 0);
      dom.detailStaked.textContent = formatBalance(w.stake || 0);
      dom.detailNonce.textContent = w.nonce || 0;

      const txs = w.transactions || [];
      if (txs.length === 0) {
          dom.detailTxList.innerHTML = '<p class="empty-state">No transactions yet</p>';
          return;
      }

      dom.detailTxList.innerHTML = txs.slice().reverse().slice(0, 20).map(tx => `
          <div class="tx-item">
              <span>${tx.type || 'transfer'}</span>
              <span class="tx-amount ${(tx.amount || 0) >= 0 ? 'positive' : 'negative'}">
                  ${(tx.amount || 0) >= 0 ? '+' : ''}${formatBalance(tx.amount || 0)} SAY
              </span>
              <span class="tx-time">${tx.time ? new Date(tx.time).toLocaleDateString() : ''}</span>
          </div>
      `).join('');
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
                  backgroundColor: 'rgba(91, 124, 250, 0.5)',
                  borderColor: '#5b7cfa',
                  borderWidth: 1,
                  borderRadius: 4,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                  y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                  x: { grid: { display: false } }
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
                  borderColor: '#4ade80',
                  backgroundColor: 'rgba(74, 222, 128, 0.1)',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 2,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                  y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                  x: { grid: { display: false } }
              }
          }
      });
  }

  // ===== QR CODE =====
  function generateQR(address) {
      dom.qrCodeContainer.innerHTML = '';
      if (!address) return;
      qrCodeInstance = new QRCode(dom.qrCodeContainer, {
          text: address,
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H,
      });
      dom.qrAddress.textContent = address;
  }

  // ===== NETWORK SWITCHING =====
  window.switchNetwork = function(network) {
      currentNetwork = network;
      document.querySelectorAll('.network-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.network === network);
      });
      dom.networkBadge.textContent = network;
      render();
      if (activeWallet) loadTransactionHistory();
      showToast(`Switched to ${networkNames[network]}`, 'success');
  };

  // ===== TRANSACTION HISTORY =====
  async function loadTransactionHistory() {
      if (!activeWallet) return;

      try {
          const res = await fetch(`${getApiBase()}/address/${activeWallet.address}`);
          if (!res.ok) return;

          const data = await res.json();
          if (data.transactions) {
              activeWallet.transactions = data.transactions;
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

  // ===== SEND TRANSACTION =====
  dom.sendBtn.addEventListener('click', async () => {
      if (!activeWallet) {
          showToast('Please select a wallet first', 'error');
          return;
      }

      try {
          const to = dom.sendTo.value.trim();
          const amount = parseFloat(dom.sendAmount.value);

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
              dom.sendResult.innerHTML = `
                  <div class="alert alert-success" style="padding:12px; border:1px solid var(--success); background:rgba(74,222,128,0.1); border-radius:8px; margin-top:12px;">
                      <strong>✅ Transaction Sent!</strong><br>
                      <small>TX ID: ${result.txId ? result.txId.substring(0, 16) + '...' : 'Pending'}</small>
                  </div>
              `;
              dom.sendTo.value = '';
              dom.sendAmount.value = '';
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
                  <div class="alert alert-success" style="padding:12px; border:1px solid var(--success); background:rgba(74,222,128,0.1); border-radius:8px; margin-top:12px;">
                      <strong>✅ Stake Transaction Broadcast!</strong><br>
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
                  <div class="alert alert-success" style="padding:12px; border:1px solid var(--success); background:rgba(74,222,128,0.1); border-radius:8px; margin-top:12px;">
                      <strong>✅ Unstake Transaction Broadcast!</strong><br>
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

  // ===== GENERATE INVOICE =====
  dom.generateInvoiceBtn.addEventListener('click', () => {
      if (!activeWallet) {
          showToast('Select a wallet first', 'error');
          return;
      }

      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${activeWallet.address}`;

      dom.invoiceContent.innerHTML = `
          <div style="text-align:center; padding:20px;">
              <h3 style="margin-bottom:16px;">Payment Invoice</h3>
              <img src="${qrUrl}" alt="QR Code" style="width:180px; height:180px; margin:0 auto 16px; border:1px solid var(--border-color); border-radius:8px; padding:8px; background:white;" />
              <div class="form-group">
                  <label>Address</label>
                  <input type="text" value="${activeWallet.address}" readonly style="font-family:monospace; font-size:0.7rem;" />
              </div>
              <div class="form-group">
                  <label>Network</label>
                  <input type="text" value="${networkNames[currentNetwork]}" readonly />
              </div>
              <div style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
                  <button class="btn-sm btn-outline" onclick="window.print()">Print</button>
                  <button class="btn-sm btn-outline" onclick="copyToClipboard('${activeWallet.address}', 'Address copied!')">Copy Address</button>
              </div>
          </div>
      `;

      openModal('invoiceModal');
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
          dom.jsonImportStatus.textContent = 'Please select a file.';
          dom.jsonImportStatus.style.color = 'var(--error)';
          return;
      }

      dom.jsonImportStatus.textContent = 'Importing...';
      dom.jsonImportStatus.style.color = 'var(--text-secondary)';

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
              dom.jsonImportStatus.innerHTML = `✅ Imported ${imported} wallet(s)!`;
              dom.jsonImportStatus.style.color = 'var(--success)';
              dom.jsonFileInput.value = '';
              setTimeout(() => closeModal('importJsonModal'), 1500);
              showToast(`Imported ${imported} wallet(s)!`, 'success');
          } else {
              throw new Error('No valid wallets found in file');
          }
      } catch (err) {
          dom.jsonImportStatus.textContent = '❌ ' + err.message;
          dom.jsonImportStatus.style.color = 'var(--error)';
      }
  });

  // ===== QR SCAN =====
  let html5QrCode = null;

  dom.importQrBtn.addEventListener('click', () => openModal('scanQrModal'));

  dom.scanQrBtn.addEventListener('click', () => openModal('scanQrModal'));

  dom.uploadQrBtn.addEventListener('click', () => dom.qrFileInput.click());

  dom.qrFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
          dom.scanResult.textContent = 'Processing image...';
          dom.scanResult.style.color = 'var(--text-secondary)';

          // Try to use html5-qrcode if available
          if (typeof Html5Qrcode !== 'undefined') {
              const result = await Html5Qrcode.scanFile(file, true);
              if (result) {
                  await importWalletFromQrData(result);
                  dom.qrFileInput.value = '';
                  closeModal('scanQrModal');
                  return;
              }
          }

          // Fallback: manual entry
          const manual = prompt('Could not auto-decode QR. Please paste the wallet data or private key:');
          if (manual) {
              await importWalletFromQrData(manual);
              dom.qrFileInput.value = '';
              closeModal('scanQrModal');
          }
      } catch (err) {
          dom.scanResult.textContent = '❌ Error: ' + err.message;
          dom.scanResult.style.color = 'var(--error)';
      }
      dom.qrFileInput.value = '';
  });

  async function importWalletFromQrData(data) {
      try {
          let walletData;
          try {
              walletData = JSON.parse(data);
          } catch (e) {
              // Maybe it's a private key
              const pk = data.replace('0x', '').trim();
              if (pk.length === 64) {
                  const name = prompt('Name for this wallet?', 'Scanned Wallet');
                  const w = await createWalletFromPrivateKey(pk, name || 'Scanned Wallet');
                  wallets.push(w);
                  activeWallet = w;
                  saveState();
                  render();
                  showToast('Wallet imported from QR scan!', 'success');
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
              showToast('Wallet imported from QR scan!', 'success');
          } else {
              throw new Error('No private key found');
          }
      } catch (err) {
          showToast('Failed to import wallet: ' + err.message, 'error');
          throw err;
      }
  }

  // ===== SHOW QR =====
  dom.showQrBtn.addEventListener('click', () => {
      if (!activeWallet) {
          showToast('Select a wallet first', 'error');
          return;
      }
      generateQR(activeWallet.address);
      openModal('qrModal');
  });

  dom.downloadQrBtn.addEventListener('click', () => {
      const canvas = dom.qrCodeContainer.querySelector('canvas');
      if (!canvas) { showToast('No QR to download', 'error'); return; }
      const link = document.createElement('a');
      link.download = `sayman_qr_${activeWallet.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
  });

  dom.shareQrBtn.addEventListener('click', async () => {
      const canvas = dom.qrCodeContainer.querySelector('canvas');
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
              // Fallback: copy address
              await copyToClipboard(activeWallet.address, 'Address copied!');
          }
      } catch (err) {
          if (err.name !== 'AbortError') {
              console.error('Share failed:', err);
          }
      }
  });

  // ===== MODAL CONTROLS =====
  function openModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('open');
  }

  function closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.classList.remove('open');
      });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
          const id = btn.dataset.modal;
          if (id) closeModal(id);
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
      dom.privateKeyInputArea.classList.toggle('hidden');
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
          dom.privateKeyInputArea.classList.add('hidden');
          closeModal('addWalletModal');
          saveState();
          render();
          showToast('Wallet imported!', 'success');
      } catch (err) {
          showToast('Invalid private key', 'error');
      }
  });

  // ===== TAB SWITCHING =====
  document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', function() {
          document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
          this.classList.add('active');
          const panel = document.getElementById('tab-' + this.dataset.tab);
          if (panel) panel.classList.add('active');

          if (this.dataset.tab === 'history') {
              loadTransactionHistory();
          }
      });
  });

  // ===== CHART PERIOD CONTROLS =====
  document.querySelectorAll('.chart-period-btn').forEach(btn => {
      btn.addEventListener('click', function() {
          const parent = this.closest('.chart-controls');
          parent.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('active'));
          this.classList.add('active');

          const period = parseInt(this.dataset.period);
          if (!isNaN(period)) {
              chartPeriod = period;
              updateCharts();
          }
      });
  });

  // ===== THEME TOGGLE =====
  dom.themeToggle.addEventListener('click', () => {
      const root = document.documentElement;
      const bg = getComputedStyle(root).getPropertyValue('--bg-primary').trim();
      if (bg === '#0b0d10') {
          root.style.setProperty('--bg-primary', '#f5f7fa');
          root.style.setProperty('--bg-secondary', '#edf0f5');
          root.style.setProperty('--bg-card', '#e4e8ef');
          root.style.setProperty('--bg-input', '#d5dbe6');
          root.style.setProperty('--border-color', '#c8ced8');
          root.style.setProperty('--text-primary', '#1a1e26');
          root.style.setProperty('--text-secondary', '#3d4555');
          root.style.setProperty('--text-muted', '#6a7488');
      } else {
          root.style.setProperty('--bg-primary', '#0b0d10');
          root.style.setProperty('--bg-secondary', '#13161b');
          root.style.setProperty('--bg-card', '#1a1e26');
          root.style.setProperty('--bg-input', '#232833');
          root.style.setProperty('--border-color', '#2a303c');
          root.style.setProperty('--text-primary', '#eef2f8');
          root.style.setProperty('--text-secondary', '#9aa4b8');
          root.style.setProperty('--text-muted', '#6a7488');
      }
  });

  // ===== TOAST SYSTEM =====
  function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = 'toast';
      const colors = {
          success: 'var(--success)',
          error: 'var(--error)',
          warning: 'var(--warning)',
          info: 'var(--accent)'
      };
      toast.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          padding: 12px 20px;
          background: ${colors[type] || colors.info};
          color: ${type === 'success' || type === 'error' ? 'white' : 'var(--text-primary)'};
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          z-index: 10000;
          animation: slideIn 0.3s ease;
          max-width: 400px;
          border: 1px solid var(--border-color);
          font-family: var(--font);
      `;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(400px)';
          toast.style.transition = 'all 0.3s ease';
          setTimeout(() => toast.remove(), 300);
      }, 3000);
  }

  window.showToast = showToast;

  // ===== COPY TO CLIPBOARD =====
  function copyToClipboard(text, message = 'Copied!') {
      navigator.clipboard.writeText(text).then(() => {
          showToast(message, 'success');
      }).catch(() => {
          // Fallback
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

  // ===== LOADING OVERLAY =====
  function showLoading(message = 'Loading...') {
      let overlay = document.getElementById('loading-overlay');
      if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'loading-overlay';
          overlay.style.cssText = `
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.7);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 9999;
              backdrop-filter: blur(4px);
          `;
          document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
          <div style="background:var(--bg-secondary); padding:32px; border-radius:12px; border:1px solid var(--border-color); text-align:center; max-width:300px;">
              <div class="loader-ring" style="margin:0 auto 16px;"></div>
              <div style="font-size:0.9rem; color:var(--text-primary);">${message}</div>
          </div>
      `;
      overlay.style.display = 'flex';
  }

  function hideLoading() {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.style.display = 'none';
  }

  window.showLoading = showLoading;
  window.hideLoading = hideLoading;

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
          e.preventDefault();
          openModal('addWalletModal');
      }
  });

  // ===== INIT =====
  async function init() {
      const hasState = loadState();

      setTimeout(async () => {
          if (wallets.length === 0) {
              const demo = await generateNewWallet('Main Wallet');
              demo.balance = 1250.75;
              demo.transactions = [
                  { type: 'received', amount: 500, time: new Date(Date.now() - 86400000 * 2).toISOString() },
                  { type: 'sent', amount: -120, time: new Date(Date.now() - 86400000 * 1.5).toISOString() },
                  { type: 'received', amount: 870.75, time: new Date(Date.now() - 86400000).toISOString() },
              ];
              wallets.push(demo);
              activeWallet = demo;
              saveState();
          }

          if (!activeWallet && wallets.length > 0) {
              activeWallet = wallets[0];
          }

          render();

          dom.loading.classList.add('fade-out');
          setTimeout(() => {
              dom.loading.style.display = 'none';
              dom.app.classList.remove('hidden');
          }, 400);

          if (activeWallet) {
              await loadTransactionHistory();
          }

          console.log('🚀 Sayman Wallet Manager v2.0 initialized');
          console.log(`📊 ${wallets.length} wallets loaded on ${currentNetwork}`);
      }, 400);
  }

  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }

})();