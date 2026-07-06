// ── SAYMAN Blockchain — app.js ────────────────────────────────────────────────
// Pages: Dashboard · Explorer · Validators (with search) · Contracts (with search) · Network · Wallet

const API   = '/api';
const POLL  = 5000;
const PG_SZ = 20;

// ── State ─────────────────────────────────────────────────────────────────────
let explorerPage   = 1;
let explorerTotal  = 0;
let networkConfig  = null;
let allValidators  = [];
let allContracts   = [];
let allPeers       = [];
let currentWallet  = null;
let explorerTab    = 'blocks';

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadNetworkConfig();
  updateHeaderInfo();
  showPage('dashboard');

  // Hide loading overlay
  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }, 500);

  setInterval(poll, POLL);
  setInterval(updateHeaderInfo, POLL);
});

function poll() {
  const active = document.querySelector('.nav-btn.active');
  if (!active) return;
  switch (active.dataset.page) {
    case 'dashboard':  loadDashboard();                    break;
    case 'explorer':   loadExplorer(explorerPage);         break;
    case 'validators': loadValidators();                   break;
    case 'contracts':  loadContracts();                    break;
    case 'network':    loadNetwork();                      break;
    case 'wallet':     updateWalletBalance();              break;
  }
}

// ── Config & Header ───────────────────────────────────────────────────────────
async function loadNetworkConfig() {
  try { networkConfig = await apiFetch('/network'); } catch {}
}

async function updateHeaderInfo() {
  try {
    const d = await apiFetch('/network/stats');
    setEl('header-network', d.network  || '—');
    setEl('header-chain',   d.chainId  || '—');
    setEl('header-node',    (d.nodeId  || '').slice(0, 16) + '…');
    setEl('header-mode',    (d.mode    || '—').toUpperCase());
  } catch {
    setEl('header-network', 'Connection error');
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (btn) btn.classList.add('active');

  switch (pageId) {
    case 'dashboard':  loadDashboard();        break;
    case 'explorer':   loadExplorer(1);        break;
    case 'validators': loadValidators();       break;
    case 'contracts':  loadContracts();        break;
    case 'network':    loadNetwork();          break;
    case 'wallet':     initWallet();           break;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, blocksData, valData] = await Promise.all([
      apiFetch('/stats'),
      apiFetch('/blocks?page=1&limit=10'),
      apiFetch('/validators'),
    ]);

    setEl('stat-blocks',    stats.blocks     ?? 0);
    setEl('stat-validators', valData.validators?.length ?? 0);
    setEl('stat-stake',     sayn(valData.totalStake ?? 0, false));
    setEl('stat-mempool',   stats.mempool    ?? 0);
    setEl('stat-contracts', stats.contracts  ?? 0);
    setEl('stat-reward',    sayn(stats.blockReward ?? 0, false));
    setEl('stat-blocktime', Math.round((stats.blockTime ?? 5000) / 1000));
    setEl('stat-apr',       valData.estimatedAPR ?? 0);

    const blocks = (blocksData.blocks || []).sort((a, b) => b.index - a.index);
    const feed   = document.getElementById('block-feed');
    if (feed) {
      feed.innerHTML = blocks.map(b => `
        <div class="block-item" onclick="showBlockDetail('${b.index}')">
          <h4>#${b.index}</h4>
          <p><i class="fas fa-hash"></i> ${(b.hash || '').slice(0, 52)}…</p>
          <p><i class="fas fa-clock"></i> ${fmtTime(b.timestamp)}</p>
        </div>
      `).join('') || '<div style="padding:2rem;color:var(--text-muted);text-align:center;">No blocks yet</div>';
    }
  } catch (e) { console.error('Dashboard:', e); }
}

// ── Explorer ──────────────────────────────────────────────────────────────────
async function loadExplorer(page = 1) {
  explorerPage = page;

  try {
    const data = await apiFetch(`/blocks?page=${page}&limit=${PG_SZ}`);
    explorerTotal = data.total || 0;
    const totalPages = data.totalPages || Math.max(1, Math.ceil(explorerTotal / PG_SZ));
    const blocks = (data.blocks || []).sort((a, b) => b.index - a.index);

    renderExplorerRows(blocks);
    renderPagination(page, totalPages, explorerTotal);
  } catch (e) { console.error('Explorer:', e); }
}

function switchExplorerTab(tab) {
  explorerTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.explorer-tab').forEach(t => t.classList.remove('active'));
  
  if (tab === 'blocks') {
    document.querySelector('.tab-btn:first-child').classList.add('active');
    document.getElementById('blocks-tab').classList.add('active');
    loadExplorer(explorerPage);
  } else {
    document.querySelector('.tab-btn:last-child').classList.add('active');
    document.getElementById('transactions-tab').classList.add('active');
    loadTransactions();
  }
}

async function loadTransactions() {
  try {
    const data = await apiFetch('/transactions?limit=100');
    const txs = data.transactions || [];
    const tbody = document.getElementById('explorer-transactions');
    
    if (!txs.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:2rem;color:var(--text-muted);text-align:center;">No transactions found</td></tr>`;
      return;
    }

    tbody.innerHTML = txs.map(tx => `
      <tr onclick="showTransactionDetail('${tx.id}')">
        <td class="mono">${(tx.id || '').slice(0, 16)}…</td>
        <td>${tx.type || '—'}</td>
        <td class="mono">${(tx.data?.from || '—').slice(0, 16)}…</td>
        <td class="mono">${(tx.data?.to || '—').slice(0, 16)}…</td>
        <td>${tx.data?.amount ? sayn(tx.data.amount) : '—'}</td>
        <td>${tx.gasUsed?.toLocaleString() || '—'}</td>
        <td>${fmtTime(tx.timestamp)}</td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Transactions:', e);
  }
}

// Search: by block number or hash prefix
async function searchExplorer() {
  const q = (document.getElementById('explorer-search')?.value || '').trim();
  if (!q) { loadExplorer(1); return; }

  clearPagination();
  const tbody = document.getElementById('explorer-blocks');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem;color:var(--text-muted);text-align:center;">Searching…</td></tr>`;

  try {
    if (/^\d+$/.test(q)) {
      const block = await apiFetch(`/block/${q}`);
      renderExplorerRows(block ? [block] : []);
      setEl('explorer-page-info', block ? '1 result' : 'Block not found');
      return;
    }
    const block = await apiFetch(`/block/hash/${q}`);
    renderExplorerRows(block ? [block] : []);
    setEl('explorer-page-info', block ? '1 result' : 'No block found for that hash');
  } catch {
    try {
      const data = await apiFetch(`/blocks?page=1&limit=100`);
      const matches = (data.blocks || []).filter(b =>
        String(b.index) === q ||
        (b.hash || '').toLowerCase().includes(q.toLowerCase()) ||
        (b.validator || '').toLowerCase().includes(q.toLowerCase())
      ).sort((a, b) => b.index - a.index);
      renderExplorerRows(matches);
      setEl('explorer-page-info', `${matches.length} result${matches.length !== 1 ? 's' : ''}`);
    } catch (e2) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem;color:var(--danger);text-align:center;">Search error</td></tr>`;
    }
  }
}

function clearSearch() {
  const el = document.getElementById('explorer-search');
  if (el) el.value = '';
  loadExplorer(1);
}

function jumpToPage() {
  const el  = document.getElementById('explorer-jump');
  const val = parseInt(el?.value || '0', 10);
  const totalPages = Math.max(1, Math.ceil(explorerTotal / PG_SZ));
  if (val >= 1 && val <= totalPages) {
    loadExplorer(val);
    if (el) el.value = '';
  }
}

function renderExplorerRows(blocks) {
  const tbody = document.getElementById('explorer-blocks');
  if (!tbody) return;

  if (!blocks.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem;text-align:center;color:var(--text-muted);">No blocks found</td></tr>`;
    return;
  }

  tbody.innerHTML = blocks.map(b => {
    const gas = b.gasUsed ?? (b.transactions || []).reduce((s, tx) => s + (tx.gasUsed || 0), 0);
    return `
      <tr onclick="showBlockDetail(${b.index})">
        <td><strong>#${b.index}</strong></td>
        <td class="mono">${(b.hash || '').slice(0, 20)}…</td>
        <td class="mono" onclick="event.stopPropagation();showValidatorDetail('${b.validator || ''}')">${(b.validator || '—').slice(0, 16)}…</td>
        <td>${b.transactions?.length ?? 0}</td>
        <td>${gas.toLocaleString()}</td>
        <td>${fmtTime(b.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

// ── Pagination ──────────────────────────────────────────────────────────────
function renderPagination(page, totalPages, total) {
  const ctrl = document.getElementById('pagination-controls');
  if (!ctrl) return;

  if (totalPages <= 1) {
    ctrl.innerHTML = `<span style="color:var(--text-muted);">${total} block${total !== 1 ? 's' : ''}</span>`;
    return;
  }

  ctrl.innerHTML = `
    <button onclick="loadExplorer(1)" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-angle-double-left"></i></button>
    <button onclick="loadExplorer(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-angle-left"></i> Previous</button>
    <span id="explorer-page-info" style="color:var(--text-muted);margin:0 0.5rem;">
      Page ${page} of ${totalPages} · ${total} blocks
    </span>
    <button onclick="loadExplorer(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next <i class="fas fa-angle-right"></i></button>
    <button onclick="loadExplorer(${totalPages})" ${page >= totalPages ? 'disabled' : ''}><i class="fas fa-angle-double-right"></i></button>
    <span style="display:flex;align-items:center;gap:0.5rem;margin-left:1rem;">
      <input id="explorer-jump" type="number" min="1" max="${totalPages}"
             placeholder="#"
             style="width:60px;padding:0.5rem;border:1px solid var(--border);border-radius:8px;background:var(--darker);color:var(--text);text-align:center;"
             onkeydown="if(event.key==='Enter')jumpToPage()">
      <button onclick="jumpToPage()" style="padding:0.5rem 1rem;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text);cursor:pointer;"><i class="fas fa-arrow-right"></i></button>
    </span>
  `;
}

function clearPagination() {
  const ctrl = document.getElementById('pagination-controls');
  if (ctrl) ctrl.innerHTML = '';
}

// ── Block Detail Modal ────────────────────────────────────────────────────────
async function showBlockDetail(index) {
  try {
    const block = await apiFetch(`/block/${index}`);
    if (!block) {
      showNotification('Block not found');
      return;
    }

    const gas = block.gasUsed ?? (block.transactions || []).reduce((s, tx) => s + (tx.gasUsed || 0), 0);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3><i class="fas fa-cube"></i> Block #${block.index}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> CLOSE</button>
        </div>
        <div class="modal-body">
          <table style="width:100%;font-size:0.9rem;border-collapse:collapse;">
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-hash"></i> Hash</td><td class="mono" style="word-break:break-all;">${block.hash || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-link"></i> Previous Hash</td><td class="mono" style="word-break:break-all;">${block.previousHash || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-user-check"></i> Validator</td><td class="mono">${block.validator || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-clock"></i> Timestamp</td><td>${fmtTime(block.timestamp)}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-link"></i> Chain ID</td><td>${block.chainId || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-gas-pump"></i> Gas Used</td><td>${gas.toLocaleString()}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-database"></i> State Root</td><td class="mono" style="word-break:break-all;">${block.stateRoot || '—'}</td></tr>
          </table>

          <div style="margin-top:2rem;border-top:1px solid var(--border);padding-top:1.5rem;">
            <div style="font-weight:600;margin-bottom:1rem;">
              <i class="fas fa-exchange-alt"></i> Transactions (${block.transactions?.length ?? 0})
            </div>
            ${(block.transactions?.length
              ? block.transactions.map(tx => `
                  <div class="tx-item">
                    <div><strong>Type:</strong> ${tx.type}</div>
                    <div><strong>ID:</strong> <span class="mono">${tx.id}</span></div>
                    ${tx.data?.from   ? `<div><strong>From:</strong> <span class="mono">${tx.data.from}</span></div>`   : ''}
                    ${tx.data?.to     ? `<div><strong>To:</strong> <span class="mono">${tx.data.to}</span></div>`     : ''}
                    ${tx.data?.amount ? `<div><strong>Amount:</strong> ${sayn(tx.data.amount)}</div>`                 : ''}
                    ${tx.gasUsed      ? `<div><strong>Gas:</strong> ${tx.gasUsed}</div>`                              : ''}
                  </div>
                `).join('')
              : '<p style="color:var(--text-muted);">No transactions in this block</p>'
            )}
          </div>
        </div>
      </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch (e) {
    showNotification('Error loading block details');
  }
}

// ── Validators ────────────────────────────────────────────────────────────────
async function loadValidators() {
  const tbody = document.getElementById('validator-list');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;color:var(--text-muted);text-align:center;">Loading…</td></tr>`;

  try {
    const data = await apiFetch('/validators');
    allValidators = data.validators || [];

    if (!tbody) return;

    if (!allValidators.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--text-muted);">No validators found</td></tr>`;
      return;
    }

    renderValidatorList(allValidators);
    updateValidatorStats(allValidators);

  } catch (e) {
    console.error('Validators:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;color:var(--danger);text-align:center;">Failed to load validators</td></tr>`;
  }
}

// ── NEW: Validator Search Filter ─────────────────────────────────────────────
function filterValidators() {
  const searchTerm = (document.getElementById('validator-search')?.value || '').toLowerCase().trim();
  
  if (!allValidators.length) return;
  
  if (!searchTerm) {
    renderValidatorList(allValidators);
    updateValidatorStats(allValidators);
    return;
  }

  const filtered = allValidators.filter(v => 
    (v.address || '').toLowerCase().includes(searchTerm)
  );

  renderValidatorList(filtered);
  updateValidatorStats(filtered);

  // Show "No validator found" if empty
  const tbody = document.getElementById('validator-list');
  if (tbody && filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:var(--text-muted);">No validator found.</td></tr>`;
  }
}

function renderValidatorList(validators) {
  const tbody = document.getElementById('validator-list');
  if (!tbody) return;

  tbody.innerHTML = validators.map(v => `
    <tr onclick="showValidatorDetail('${v.address || ''}')">
      <td class="mono">${(v.address || '').slice(0, 20)}…</td>
      <td>${sayn(v.stake ?? 0)}</td>
      <td>${v.percentage ?? 0}%</td>
      <td>${v.missedBlocks ?? 0}</td>
      <td>
        <span class="status-badge ${v.isActive ? 'active' : 'inactive'}">
          ${v.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  `).join('');
}

function updateValidatorStats(validators) {
  const totalStake = validators.reduce((sum, v) => sum + (v.stake || 0), 0);
  setEl('val-count', validators.length);
  setEl('val-total-stake', sayn(totalStake));
  setEl('val-apr', (validators[0]?.estimatedAPR ?? 0) + '%');
}

// ── Show validator blocks ─────────────────────────────────────────────────────
async function showValidatorDetail(address) {
  if (!address) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3><i class="fas fa-user-check"></i> Validator: ${address.slice(0, 20)}…</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> CLOSE</button>
      </div>
      <div class="modal-body">
        <div id="vd-loading" style="color:var(--text-muted);padding:1rem;text-align:center;">Loading blocks…</div>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  try {
    const data = await apiFetch(`/blocks?page=1&limit=200`);
    const blocks = (data.blocks || [])
      .filter(b => (b.validator || '').toLowerCase() === address.toLowerCase())
      .sort((a, b) => b.index - a.index);

    const container = document.getElementById('vd-loading');
    if (!container) return;

    if (!blocks.length) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No blocks validated by this address (last 200 blocks).</p>';
      return;
    }

    container.innerHTML = `
      <div style="color:var(--text-muted);margin-bottom:1rem;">
        <i class="fas fa-cubes"></i> ${blocks.length} block${blocks.length !== 1 ? 's' : ''} validated (last 200 checked)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead style="border-bottom:1px solid var(--border);">
          <tr>
            <th style="text-align:left;padding:0.5rem;color:var(--text-muted);">Block</th>
            <th style="text-align:left;padding:0.5rem;color:var(--text-muted);">Hash</th>
            <th style="text-align:left;padding:0.5rem;color:var(--text-muted);">Txs</th>
            <th style="text-align:left;padding:0.5rem;color:var(--text-muted);">Gas</th>
            <th style="text-align:left;padding:0.5rem;color:var(--text-muted);">Time</th>
          </tr>
        </thead>
        <tbody>
          ${blocks.map(b => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:0.5rem;"><strong>#${b.index}</strong></td>
              <td style="padding:0.5rem;font-family:monospace;font-size:0.8rem;">${(b.hash||'').slice(0,20)}…</td>
              <td style="padding:0.5rem;">${b.transactions?.length ?? 0}</td>
              <td style="padding:0.5rem;">${(b.gasUsed ?? 0).toLocaleString()}</td>
              <td style="padding:0.5rem;">${fmtTime(b.timestamp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    const c = document.getElementById('vd-loading');
    if (c) c.innerHTML = '<p style="color:var(--danger);text-align:center;">Error loading validator blocks.</p>';
  }
}

// ── Contracts ─────────────────────────────────────────────────────────────────
async function loadContracts() {
  try {
    const data = await apiFetch('/contracts');
    allContracts = data.contracts || [];
    renderContracts(allContracts);
  } catch (e) { console.error('Contracts:', e); }
}

// ── NEW: Contract Search Filter ──────────────────────────────────────────────
function filterContracts() {
  const searchTerm = (document.getElementById('contract-search')?.value || '').toLowerCase().trim();
  
  if (!allContracts.length) return;
  
  if (!searchTerm) {
    renderContracts(allContracts);
    return;
  }

  const filtered = allContracts.filter(c => 
    (c.address || '').toLowerCase().includes(searchTerm) ||
    (c.creator || '').toLowerCase().includes(searchTerm)
  );

  renderContracts(filtered);
}

function renderContracts(contracts) {
  const tbody = document.getElementById('contract-list');
  if (!tbody) return;

  if (!contracts.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding:2rem;text-align:center;color:var(--text-muted);">No contracts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = contracts.map(c => `
    <tr onclick="showContractDetail('${c.address}')">
      <td class="mono">${(c.address || '').slice(0, 20)}…</td>
      <td class="mono">${(c.creator || '').slice(0, 20)}…</td>
      <td>${(c.code?.length ?? 0).toLocaleString()} bytes</td>
    </tr>
  `).join('');
}

// ── Network ───────────────────────────────────────────────────────────────────
async function loadNetwork() {
  try {
    const d = await apiFetch('/network/stats');

    setEl('net-peers',     d.peers       ?? 0);
    setEl('net-height',    d.blockHeight ?? 0);
    setEl('net-blocktime', Math.round(d.averageBlockTime || 5000));
    setEl('net-mempool',   d.mempool     ?? 0);
    setEl('net-node-id',   (d.nodeId  || '').slice(0, 32) + '…');
    setEl('net-mode',      (d.mode    || '—').toUpperCase());
    setEl('net-network',   d.network  || '—');
    setEl('net-chain',     d.chainId  || '—');
    setEl('net-uptime',    fmtUptime(d.uptime || 0));

    const peerDiv = document.getElementById('peer-list');
    if (!peerDiv) return;

    allPeers = d.peerList || [];
    renderPeers(allPeers);

  } catch (e) { console.error('Network:', e); }
}

// ── NEW: Peer Search Filter ──────────────────────────────────────────────────
function filterPeers() {
  const searchTerm = (document.getElementById('peer-search')?.value || '').toLowerCase().trim();
  
  if (!searchTerm) {
    renderPeers(allPeers);
    return;
  }

  const filtered = allPeers.filter(p => 
    (p.nodeId || '').toLowerCase().includes(searchTerm)
  );

  renderPeers(filtered);
}

function renderPeers(peers) {
  const peerDiv = document.getElementById('peer-list');
  if (!peerDiv) return;

  if (!peers.length) {
    peerDiv.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">No peers connected</p>';
    return;
  }

  peerDiv.innerHTML = peers.map(p => `
    <div class="peer-item">
      <div><strong><i class="fas fa-id-card"></i> Node ID:</strong> ${(p.nodeId || '—').slice(0, 20)}…</div>
      <div><strong><i class="fas fa-layer-group"></i> Height:</strong> ${p.chainHeight ?? '—'}</div>
      <div><strong><i class="fas fa-clock"></i> Last seen:</strong> ${fmtTimeAgo(p.lastSeen)}</div>
    </div>
  `).join('');
}

// ── Wallet ──────────────────────────────────────────────────────────────────
async function initWallet() {
  if (!currentWallet) {
    // Check if wallet exists in localStorage
    const saved = localStorage.getItem('sayman-wallet');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        currentWallet = new SaymanWallet(data.privateKey);
        await currentWallet.initialize();
        updateWalletUI();
      } catch (e) {
        console.error('Failed to load wallet:', e);
      }
    }
  }
  if (currentWallet) {
    updateWalletUI();
    updateWalletBalance();
  }
}

function createWallet() {
  if (confirm('Create a new wallet? Make sure to save your private key!')) {
    currentWallet = new SaymanWallet();
    currentWallet.initialize().then(() => {
      const data = currentWallet.export();
      localStorage.setItem('sayman-wallet', JSON.stringify(data));
      updateWalletUI();
      updateWalletBalance();
      showNotification('Wallet created successfully!');
    });
  }
}

function importWallet() {
  const key = prompt('Enter your private key (hex):');
  if (key) {
    try {
      currentWallet = new SaymanWallet(key);
      currentWallet.initialize().then(() => {
        const data = currentWallet.export();
        localStorage.setItem('sayman-wallet', JSON.stringify(data));
        updateWalletUI();
        updateWalletBalance();
        showNotification('Wallet imported successfully!');
      });
    } catch (e) {
      showNotification('Invalid private key');
    }
  }
}

function updateWalletUI() {
  if (!currentWallet) return;
  const data = currentWallet.export();
  document.getElementById('wallet-address').value = data.address;
  document.getElementById('wallet-public').value = data.publicKey;
  document.getElementById('wallet-private').value = data.privateKey;
}

async function updateWalletBalance() {
  if (!currentWallet) return;
  try {
    const data = await apiFetch(`/balance/${currentWallet.address}`);
    document.getElementById('wallet-balance').textContent = sayn(data.balance || 0);
    document.getElementById('wallet-gas').textContent = sayn(data.gasBalance || 0);
  } catch (e) {
    // Balance might not be available
  }
}

function copyAddress() {
  const input = document.getElementById('wallet-address');
  navigator.clipboard.writeText(input.value).then(() => {
    showNotification('Address copied!');
  });
}

function copyPublicKey() {
  const input = document.getElementById('wallet-public');
  navigator.clipboard.writeText(input.value).then(() => {
    showNotification('Public key copied!');
  });
}

function togglePrivateKey() {
  const input = document.getElementById('wallet-private');
  const btn = document.querySelector('.btn-toggle');
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide';
  } else {
    input.type = 'password';
    btn.innerHTML = '<i class="fas fa-eye"></i> Show';
  }
}

async function sendTransaction() {
  if (!currentWallet) {
    showNotification('Please create or import a wallet first');
    return;
  }

  const to = document.getElementById('send-to').value.trim();
  const amount = parseFloat(document.getElementById('send-amount').value);
  const gasLimit = parseInt(document.getElementById('send-gas').value) || 21000;

  if (!to || !amount || amount <= 0) {
    showNotification('Please enter valid recipient and amount');
    return;
  }

  try {
    const result = document.getElementById('send-result');
    result.innerHTML = '<div class="result" style="color:var(--text-muted);">Sending transaction...</div>';

    // Get nonce
    const nonceData = await apiFetch(`/nonce/${currentWallet.address}`);
    const nonce = nonceData.nonce || 0;

    // Create transaction
    const tx = {
      type: 'transfer',
      timestamp: Date.now(),
      data: {
        from: currentWallet.address,
        to: to,
        amount: amount * 10000 // Convert to base units
      },
      gasLimit: gasLimit,
      gasPrice: 1,
      nonce: nonce
    };

    // Sign transaction
    const signature = await currentWallet.signTransaction(tx);
    const signedTx = { ...tx, signature };

    // Send transaction
    const response = await fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await response.json();
    if (response.ok) {
      result.innerHTML = `<div class="result success"><i class="fas fa-check-circle"></i> Transaction sent! ID: ${data.txId}</div>`;
      updateWalletBalance();
    } else {
      result.innerHTML = `<div class="result error"><i class="fas fa-exclamation-circle"></i> ${data.error || 'Transaction failed'}</div>`;
    }
  } catch (e) {
    document.getElementById('send-result').innerHTML = `<div class="result error"><i class="fas fa-exclamation-circle"></i> Error: ${e.message}</div>`;
  }
}

async function deployContract() {
  if (!currentWallet) {
    showNotification('Please create or import a wallet first');
    return;
  }

  const code = document.getElementById('contract-code').value.trim();
  const gasLimit = parseInt(document.getElementById('contract-gas').value) || 100000;

  if (!code) {
    showNotification('Please enter contract bytecode');
    return;
  }

  try {
    const result = document.getElementById('deploy-result');
    result.innerHTML = '<div class="result" style="color:var(--text-muted);">Deploying contract...</div>';

    // Get nonce
    const nonceData = await apiFetch(`/nonce/${currentWallet.address}`);
    const nonce = nonceData.nonce || 0;

    // Create transaction
    const tx = {
      type: 'deploy',
      timestamp: Date.now(),
      data: {
        from: currentWallet.address,
        code: code
      },
      gasLimit: gasLimit,
      gasPrice: 1,
      nonce: nonce
    };

    // Sign transaction
    const signature = await currentWallet.signTransaction(tx);
    const signedTx = { ...tx, signature };

    // Send transaction
    const response = await fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signedTx)
    });

    const data = await response.json();
    if (response.ok) {
      result.innerHTML = `<div class="result success"><i class="fas fa-check-circle"></i> Contract deployed! Address: ${data.contractAddress}</div>`;
    } else {
      result.innerHTML = `<div class="result error"><i class="fas fa-exclamation-circle"></i> ${data.error || 'Deployment failed'}</div>`;
    }
  } catch (e) {
    document.getElementById('deploy-result').innerHTML = `<div class="result error"><i class="fas fa-exclamation-circle"></i> Error: ${e.message}</div>`;
  }
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Formatters ────────────────────────────────────────────────────────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === null || value === undefined) ? '—' : value;
}

function fmtTime(ts) {
  if (ts === null || ts === undefined || ts === '') return '—';
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '—';
  try { return new Date(n).toLocaleString(); } catch { return '—'; }
}

function fmtTimeAgo(ts) {
  if (!ts) return '—';
  const d = Date.now() - Number(ts);
  if (d < 60000)    return Math.round(d / 1000)   + 's ago';
  if (d < 3600000)  return Math.round(d / 60000)  + 'm ago';
  return Math.round(d / 3600000) + 'h ago';
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

function sayn(baseUnits, withUnit = true) {
  if (baseUnits === null || baseUnits === undefined) return '—';
  const v = Number(baseUnits) / 10000;
  return Number.isFinite(v) ? v.toFixed(4) + (withUnit ? ' SAYN' : '') : '—';
}

function showNotification(msg) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--card-bg);color:var(--text);padding:1rem 1.5rem;border-radius:12px;border:1px solid var(--border);z-index:10000;box-shadow:0 10px 30px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;';
  n.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.opacity = '0';
    n.style.transition = 'opacity 0.3s ease';
    setTimeout(() => n.remove(), 300);
  }, 3000);
}