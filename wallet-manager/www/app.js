// ============================================================
//  Sayman Wallet Manager — Full Application
//  Features: multi-wallet, QR scan, JSON import/export,
//  analytics charts, per-wallet export, spending graphs.
// ============================================================

(function() {
  'use strict';

  // ---------- STATE ----------
  let wallets = [];
  let activeWalletId = null;
  let currentNetwork = 'testnet';
  let spendingChart = null;
  let monthlyChart = null;
  let qrCodeInstance = null;

  // DOM refs
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
      loading: $('#loading-screen'),
      app: $('#app'),
      walletList: $('#walletList'),
      totalBalance: $('#totalBalance'),
      walletCount: $('#walletCount'),
      txCount: $('#txCount'),
      detailName: $('#detailName'),
      detailAddress: $('#detailAddress'),
      detailBalance: $('#detailBalance'),
      detailTxList: $('#detailTxList'),
      networkBadge: $('#networkBadge'),
      // modals
      addWalletModal: $('#addWalletModal'),
      qrModal: $('#qrModal'),
      scanQrModal: $('#scanQrModal'),
      importJsonModal: $('#importJsonModal'),
      qrCodeContainer: $('#qrCodeContainer'),
      qrAddress: $('#qrAddress'),
      // buttons
      addWalletBtn: $('#addWalletBtn'),
      importWalletBtn: $('#importWalletBtn'),
      exportAllBtn: $('#exportAllBtn'),
      exportWalletBtn: $('#exportWalletBtn'),
      showQrBtn: $('#showQrBtn'),
      scanQrBtn: $('#scanQrBtn'),
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
  };

  // ---------- HELPERS ----------
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
      return wallets.find(w => w.id === activeWalletId) || null;
  }

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
              })),
              activeWalletId: activeWalletId,
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
          activeWalletId = data.activeWalletId || null;
          currentNetwork = data.network || 'testnet';
          return true;
      } catch (e) { return false; }
  }

  // ---------- WALLET FACTORY ----------
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
          transactions: [],
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
          transactions: [],
      };
  }

  // ---------- RENDER ----------
  function render() {
      renderWalletList();
      renderSummary();
      renderDetail();
      updateCharts();
      dom.networkBadge.textContent = currentNetwork;
  }

  function renderWalletList() {
      if (!dom.walletList) return;
      if (wallets.length === 0) {
          dom.walletList.innerHTML = `
              <div style="padding:20px 8px; text-align:center; color:var(--text-muted); font-size:0.85rem;">
                  No wallets yet.<br>Click "+ New" to create one.
              </div>
          `;
          return;
      }
      dom.walletList.innerHTML = wallets.map(w => `
          <div class="wallet-item ${w.id === activeWalletId ? 'active' : ''}" data-id="${w.id}">
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
              activeWalletId = id;
              saveState();
              render();
          });
      });

      // Delete
      dom.walletList.querySelectorAll('.wallet-delete').forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const id = btn.dataset.id;
              if (confirm('Delete this wallet?')) {
                  wallets = wallets.filter(w => w.id !== id);
                  if (activeWalletId === id) activeWalletId = wallets.length ? wallets[0].id : null;
                  saveState();
                  render();
              }
          });
      });
  }

  function renderSummary() {
      const total = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
      dom.totalBalance.textContent = formatBalance(total);
      dom.walletCount.textContent = wallets.length;
      const txCount = wallets.reduce((sum, w) => sum + (w.transactions || []).length, 0);
      dom.txCount.textContent = txCount;
  }

  function renderDetail() {
      const w = getActiveWallet();
      if (!w) {
          dom.detailName.textContent = 'Select a wallet';
          dom.detailAddress.textContent = '0x...';
          dom.detailBalance.textContent = '0.00';
          dom.detailTxList.innerHTML = '<p class="empty-state">No wallet selected</p>';
          return;
      }
      dom.detailName.textContent = w.name;
      dom.detailAddress.textContent = w.address || '0x...';
      dom.detailBalance.textContent = formatBalance(w.balance || 0);

      const txs = w.transactions || [];
      if (txs.length === 0) {
          dom.detailTxList.innerHTML = '<p class="empty-state">No transactions yet</p>';
          return;
      }
      dom.detailTxList.innerHTML = txs.slice().reverse().map(tx => `
          <div class="tx-item">
              <span>${tx.type || 'transfer'}</span>
              <span class="tx-amount ${(tx.amount || 0) >= 0 ? 'positive' : 'negative'}">
                  ${(tx.amount || 0) >= 0 ? '+' : ''}${formatBalance(tx.amount || 0)} SAY
              </span>
              <span class="tx-time">${tx.time || ''}</span>
          </div>
      `).join('');
  }

  // ---------- CHARTS ----------
  function updateCharts() {
      const w = getActiveWallet();
      if (!w) {
          if (spendingChart) { spendingChart.destroy();
              spendingChart = null; }
          if (monthlyChart) { monthlyChart.destroy();
              monthlyChart = null; }
          return;
      }
      renderSpendingChart(w);
      renderMonthlyChart(w);
  }

  function renderSpendingChart(wallet) {
      const ctx = document.getElementById('spendingChart');
      if (!ctx) return;
      const txs = wallet.transactions || [];
      // Last 7 days spending (outgoing only)
      const now = Date.now();
      const day = 86400000;
      const labels = [];
      const data = [];
      for (let i = 6; i >= 0; i--) {
          const d = new Date(now - i * day);
          labels.push(d.toLocaleDateString('en', { weekday: 'short' }));
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

  function renderMonthlyChart(wallet) {
      const ctx = document.getElementById('monthlyChart');
      if (!ctx) return;
      const txs = wallet.transactions || [];
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

  // ---------- QR CODE ----------
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

  // ---------- MODALS ----------
  function openModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add('open');
  }

  function closeModal(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
  }

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

  // ---------- SCAN QR (using html5-qrcode) ----------
  let html5QrCode = null;

  async function startQrScanner() {
      try {
          // Dynamically load html5-qrcode if needed
          if (typeof Html5Qrcode === 'undefined') {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
                  script.onload = resolve;
                  script.onerror = reject;
                  document.head.appendChild(script);
              });
          }
          const reader = document.getElementById('reader');
          reader.innerHTML = '';
          html5QrCode = new Html5Qrcode('reader');
          const config = { fps: 10, qrbox: { width: 250, height: 250 } };
          await html5QrCode.start({ facingMode: 'environment' }, config, onQrScanSuccess, onQrScanError);
      } catch (err) {
          console.warn('QR scan not available:', err);
          alert('Camera not available. Use "Upload Image" to scan a QR code from an image.');
      }
  }

  function onQrScanSuccess(decodedText) {
      if (html5QrCode) {
          html5QrCode.stop().catch(() => {});
      }
      closeModal('scanQrModal');
      // Try to import the scanned data
      importWalletFromQrData(decodedText);
  }

  function onQrScanError(err) {
      // ignore
  }

  async function importWalletFromQrData(data) {
      try {
          // Try to parse as JSON
          let walletData;
          try {
              walletData = JSON.parse(data);
          } catch (e) {
              // Maybe it's just a private key
              if (data.length === 64 || data.startsWith('0x') && data.length === 66) {
                  const pk = data.replace('0x', '');
                  const name = prompt('Name for this wallet?', 'Scanned Wallet');
                  const w = await createWalletFromPrivateKey(pk, name || 'Scanned Wallet');
                  wallets.push(w);
                  activeWalletId = w.id;
                  saveState();
                  render();
                  alert('Wallet imported from QR scan!');
                  return;
              }
              throw new Error('Invalid QR data');
          }
          // If it has privateKey, import it
          if (walletData.privateKey) {
              const name = walletData.name || 'Scanned Wallet';
              const w = await createWalletFromPrivateKey(walletData.privateKey, name);
              if (walletData.transactions) w.transactions = walletData.transactions;
              if (walletData.balance) w.balance = walletData.balance;
              wallets.push(w);
              activeWalletId = w.id;
              saveState();
              render();
              alert('Wallet imported from QR scan!');
          } else {
              throw new Error('No private key found');
          }
      } catch (err) {
          alert('Failed to import wallet from QR: ' + err.message);
      }
  }

  // ---------- JSON IMPORT / EXPORT ----------
  function exportAllWallets() {
      if (wallets.length === 0) {
          alert('No wallets to export.');
          return;
      }
      const data = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          network: currentNetwork,
          wallets: wallets.map(w => ({
              name: w.name,
              privateKey: w.privateKey,
              publicKey: w.publicKey,
              address: w.address,
              balance: w.balance || 0,
              transactions: w.transactions || [],
          })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sayman_wallets_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
  }

  function exportSingleWallet(wallet) {
      if (!wallet) return;
      const data = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          name: wallet.name,
          privateKey: wallet.privateKey,
          publicKey: wallet.publicKey,
          address: wallet.address,
          balance: wallet.balance || 0,
          transactions: wallet.transactions || [],
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sayman_${wallet.name}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
  }

  async function importWalletFromJson(file) {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
              try {
                  const data = JSON.parse(e.target.result);
                  // Support both single wallet and multi-wallet export
                  if (data.wallets && Array.isArray(data.wallets)) {
                      // Multi-wallet import
                      const imported = [];
                      for (const wData of data.wallets) {
                          if (wData.privateKey) {
                              const w = await createWalletFromPrivateKey(wData.privateKey, wData.name || 'Imported');
                              if (wData.transactions) w.transactions = wData.transactions;
                              if (wData.balance) w.balance = wData.balance;
                              wallets.push(w);
                              imported.push(w.name);
                          }
                      }
                      if (imported.length > 0) {
                          activeWalletId = imported.length > 0 ? wallets[wallets.length - 1].id : null;
                          saveState();
                          render();
                          resolve(`Imported ${imported.length} wallet(s): ${imported.join(', ')}`);
                      } else {
                          reject('No valid wallets found in file');
                      }
                  } else if (data.privateKey) {
                      // Single wallet import
                      const w = await createWalletFromPrivateKey(data.privateKey, data.name || 'Imported Wallet');
                      if (data.transactions) w.transactions = data.transactions;
                      if (data.balance) w.balance = data.balance;
                      wallets.push(w);
                      activeWalletId = w.id;
                      saveState();
                      render();
                      resolve(`Imported wallet: ${w.name}`);
                  } else {
                      reject('Invalid wallet file: missing privateKey');
                  }
              } catch (err) {
                  reject(err.message);
              }
          };
          reader.onerror = () => reject('Failed to read file');
          reader.readAsText(file);
      });
  }

  // ---------- EVENT BINDING ----------
  function init() {
      // Load state
      const hasState = loadState();

      // Show loading, then init
      setTimeout(async () => {
          // If no state, create a demo wallet
          if (wallets.length === 0) {
              const demo = await generateNewWallet('Main Wallet');
              demo.balance = 1250.75;
              demo.transactions = [
                  { type: 'received', amount: 500, time: new Date(Date.now() - 86400000 * 2).toISOString() },
                  { type: 'sent', amount: -120, time: new Date(Date.now() - 86400000 * 1.5).toISOString() },
                  { type: 'received', amount: 870.75, time: new Date(Date.now() - 86400000).toISOString() },
              ];
              wallets.push(demo);
              activeWalletId = demo.id;
              saveState();
          }

          // Set active wallet if not set
          if (!activeWalletId && wallets.length > 0) {
              activeWalletId = wallets[0].id;
          }

          render();

          // Hide loading
          dom.loading.classList.add('fade-out');
          setTimeout(() => {
              dom.loading.style.display = 'none';
              dom.app.classList.remove('hidden');
          }, 400);

          // If QR scanner is available, preload
          try {
              if (typeof Html5Qrcode !== 'undefined') {
                  // already loaded
              } else {
                  await new Promise((resolve) => {
                      const script = document.createElement('script');
                      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
                      script.onload = resolve;
                      script.onerror = resolve;
                      document.head.appendChild(script);
                  });
              }
          } catch (e) { /* ignore */ }
      }, 400);

      // ---------- EVENTS ----------
      // Add wallet
      dom.addWalletBtn.addEventListener('click', () => openModal('addWalletModal'));

      dom.createWalletBtn.addEventListener('click', async () => {
          const name = dom.newWalletName.value.trim() || 'New Wallet';
          const w = await generateNewWallet(name);
          wallets.push(w);
          activeWalletId = w.id;
          dom.newWalletName.value = '';
          closeModal('addWalletModal');
          saveState();
          render();
      });

      dom.importPrivateKeyBtn.addEventListener('click', () => {
          dom.privateKeyInputArea.classList.toggle('hidden');
      });

      dom.importKeyConfirmBtn.addEventListener('click', async () => {
          const pk = dom.privateKeyInput.value.trim().replace('0x', '');
          if (!pk || pk.length < 64) {
              alert('Please enter a valid private key (64 hex chars)');
              return;
          }
          const name = prompt('Name for this wallet?', 'Imported Wallet');
          try {
              const w = await createWalletFromPrivateKey(pk, name || 'Imported Wallet');
              wallets.push(w);
              activeWalletId = w.id;
              dom.privateKeyInput.value = '';
              dom.privateKeyInputArea.classList.add('hidden');
              closeModal('addWalletModal');
              saveState();
              render();
          } catch (err) {
              alert('Invalid private key: ' + err.message);
          }
      });

      // Import JSON
      dom.importWalletBtn.addEventListener('click', () => openModal('importJsonModal'));

      dom.importJsonConfirmBtn.addEventListener('click', async () => {
          const file = dom.jsonFileInput.files[0];
          if (!file) {
              dom.jsonImportStatus.textContent = 'Please select a file.';
              dom.jsonImportStatus.style.color = '#f87171';
              return;
          }
          dom.jsonImportStatus.textContent = 'Importing...';
          dom.jsonImportStatus.style.color = 'var(--text-secondary)';
          try {
              const result = await importWalletFromJson(file);
              dom.jsonImportStatus.textContent = '✅ ' + result;
              dom.jsonImportStatus.style.color = '#4ade80';
              dom.jsonFileInput.value = '';
              setTimeout(() => closeModal('importJsonModal'), 1200);
          } catch (err) {
              dom.jsonImportStatus.textContent = '❌ ' + err;
              dom.jsonImportStatus.style.color = '#f87171';
          }
      });

      // Export All
      dom.exportAllBtn.addEventListener('click', exportAllWallets);

      // Export Single
      dom.exportWalletBtn.addEventListener('click', () => {
          const w = getActiveWallet();
          if (!w) { alert('Select a wallet first'); return; }
          exportSingleWallet(w);
      });

      // Show QR
      dom.showQrBtn.addEventListener('click', () => {
          const w = getActiveWallet();
          if (!w) { alert('Select a wallet first'); return; }
          generateQR(w.address || w.publicKey);
          openModal('qrModal');
      });

      // Download QR
      dom.downloadQrBtn.addEventListener('click', () => {
          const canvas = dom.qrCodeContainer.querySelector('canvas');
          if (!canvas) { alert('No QR to download'); return; }
          const link = document.createElement('a');
          link.download = 'sayman_qr.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
      });

      // Scan QR
      dom.scanQrBtn.addEventListener('click', async () => {
          openModal('scanQrModal');
          // Reset reader
          const reader = document.getElementById('reader');
          reader.innerHTML = '';
          // Start scanner after modal opens
          setTimeout(async () => {
              try {
                  await startQrScanner();
              } catch (e) {
                  reader.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Camera not available. Use "Upload Image" to scan.</p>';
              }
          }, 300);
      });

      // Upload QR image
      dom.uploadQrBtn.addEventListener('click', () => {
          dom.qrFileInput.click();
      });

      dom.qrFileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
              const img = new Image();
              const url = URL.createObjectURL(file);
              img.src = url;
              await new Promise((resolve) => { img.onload = resolve; });
              // Use a simple QR decoder or fallback
              // For now, we'll use a simple prompt fallback
              // In production, use a proper QR decoder library
              alert('QR image uploaded. Please enter the wallet data manually, or use a dedicated QR decoder.');
              // Try to use html5-qrcode to decode from image
              try {
                  if (typeof Html5Qrcode !== 'undefined') {
                      const result = await Html5Qrcode.scanFile(file, true);
                      if (result) {
                          await importWalletFromQrData(result);
                          dom.qrFileInput.value = '';
                          closeModal('scanQrModal');
                          return;
                      }
                  }
              } catch (err) {
                  // fallback to manual entry
                  const manual = prompt('Could not auto-decode QR. Please paste the wallet data or private key:');
                  if (manual) {
                      await importWalletFromQrData(manual);
                      dom.qrFileInput.value = '';
                      closeModal('scanQrModal');
                  }
              }
              URL.revokeObjectURL(url);
          } catch (err) {
              alert('Error reading image: ' + err.message);
          }
          dom.qrFileInput.value = '';
      });

      // Theme toggle (light/dark)
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

      // Clean up QR scanner on modal close
      const scanModal = document.getElementById('scanQrModal');
      const observer = new MutationObserver(() => {
          if (!scanModal.classList.contains('open')) {
              if (html5QrCode) {
                  html5QrCode.stop().catch(() => {});
                  html5QrCode = null;
              }
          }
      });
      observer.observe(scanModal, { attributes: true, attributeFilter: ['class'] });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
              document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
          }
      });

      console.log('Sayman Wallet Manager initialized.');
  }

  // ---------- START ----------
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }

})();