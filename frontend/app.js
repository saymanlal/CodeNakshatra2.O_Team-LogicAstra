// ── SAYMAN Blockchain — app.js ────────────────────────────────────────────────
// Pages: Dashboard · Explorer (search + jump-to-page) · Validators (with block history) · Contracts · Network · Docs

let API   = '/api';
const POLL  = 5000;
const PG_SZ = 20;

// ── State ─────────────────────────────────────────────────────────────────────
let explorerPage   = 1;
let explorerTotal  = 0;
let networkConfig  = null;
let allValidators  = [];
let allContracts   = [];
let allPeers       = [];

async function loadExplorerEnv() {
  const paths = ['.env', 'explorer.env'];
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) {
        const text = await res.text();
        const env = {};
        const lines = text.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;
          const idx = line.indexOf('=');
          if (idx === -1) continue;
          const key = line.substring(0, idx).trim();
          let val = line.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          env[key] = val;
        }
        if (env.API_BASE) {
          API = env.API_BASE;
          console.log(`✅ Loaded explorer API base from ${p}: ${API}`);
        }
        break;
      }
    } catch (e) {
      // ignore
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadExplorerEnv();
  await loadNetworkConfig();
  updateHeaderInfo();

  // Sync theme toggle button
  const savedTheme = localStorage.getItem('theme') || 'light';
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    if (savedTheme === 'dark') {
      btn.innerHTML = '<i class="fas fa-sun"></i> Theme';
    } else {
      btn.innerHTML = '<i class="fas fa-moon"></i> Theme';
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const pageParam = urlParams.get('page');
  if (pageParam && ['dashboard', 'explorer', 'validators', 'contracts', 'layers', 'network'].includes(pageParam)) {
    showPage(pageParam);
  } else {
    showPage('dashboard');
  }

  // Handle path-based routing for blocks, txs, and contracts
  const path = window.location.pathname;
  if (path.startsWith('/block/')) {
    const parts = path.split('/');
    const blockIndex = parts[2];
    if (blockIndex) {
      showPage('explorer');
      showBlockDetail(blockIndex);
    }
  } else if (path.startsWith('/tx/')) {
    const parts = path.split('/');
    const txHash = parts[2];
    if (txHash) {
      showPage('explorer');
      apiFetch(`/search/${txHash}`).then(res => {
        if (res && res.type === 'transaction' && res.result) {
          showBlockDetail(res.result.blockIndex).then(() => {
            setTimeout(() => {
              const txElements = document.querySelectorAll('.tx-item');
              txElements.forEach(el => {
                if (el.textContent.includes(txHash)) {
                  el.style.border = '1px solid var(--mono-100)';
                  el.style.padding = 'calc(var(--grid)*1.5)';
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              });
            }, 500);
          });
        } else {
          showNotification('Transaction not found');
        }
      }).catch(() => {
        showNotification('Error loading transaction');
      });
    }
  } else if (path.startsWith('/contract/')) {
    const parts = path.split('/');
    const address = parts[2];
    if (address) {
      showPage('contracts');
      showContractDetail(address);
    }
  }

  setInterval(poll, POLL);
  setInterval(updateHeaderInfo, POLL);
});

window.toggleExplorerTheme = function() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  if (isDark) {
    document.documentElement.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-moon"></i> Theme';
  } else {
    document.documentElement.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-sun"></i> Theme';
  }
};

function poll() {
  const active = document.querySelector('.nav-btn.active');
  if (!active) return;
  switch (active.dataset.page) {
    case 'dashboard':  loadDashboard();                    break;
    case 'explorer':   loadExplorer(explorerPage);         break;
    case 'validators': loadValidators();                   break;
    case 'contracts':  loadContracts();                    break;
    case 'layers':     loadLayers();                       break;
    case 'network':    loadNetwork();                      break;
    case 'docs':       break;
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
    case 'layers':     loadLayers();           break;
    case 'network':    loadNetwork();          break;
    case 'docs':       break;
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

    const dec = (networkConfig && networkConfig.decimals) || 100_000_000;

    setEl('stat-blocks',    stats.blocks     ?? 0);
    setEl('stat-validators', valData.validators?.length ?? 0);
    setEl('stat-stake',     sayn(valData.totalStake ?? 0, false));
    setEl('stat-mempool',   stats.mempool    ?? 0);
    setEl('stat-contracts', stats.contracts  ?? 0);
    setEl('stat-reward',    sayn(stats.blockReward ?? 0, false));
    setEl('stat-blocktime', Math.round((stats.blockTime ?? 5000) / 1000));
    setEl('stat-apr',       valData.estimatedAPR ?? 0);

    // ── TPS ───────────────────────────────────────────────────────────
    setEl('stat-tps', stats.tps ?? '0');

    // ── Denomination card — eliminate all confusion about SAYN vs base units ──
    const ticker = (networkConfig && networkConfig.ticker) || 'SAYN';
    setEl('stat-denom',      `1 ${ticker} = ${dec.toLocaleString()} base units`);
    setEl('stat-denom-note', `All on-chain amounts are integers (base units). Divide by ${dec} to get ${ticker}.`);

    // ── Show raw base-unit values below SAYN values for clarity ──────────────
    const stakeRaw = document.getElementById('stat-stake-raw');
    if (stakeRaw) stakeRaw.textContent = `${(valData.totalStake ?? 0).toLocaleString()} base units`;

    const rewardRaw = document.getElementById('stat-reward-raw');
    if (rewardRaw) rewardRaw.textContent = `${(stats.blockReward ?? 0).toLocaleString()} base units`;

    const blocks = (blocksData.blocks || []).sort((a, b) => b.index - a.index);
    const feed   = document.getElementById('block-feed');
    if (feed) {
      feed.innerHTML = blocks.map(b => `
        <div class="block-item" onclick="showBlockDetail('${b.index}')">
          <div class="block-index">#${b.index}</div>
          <div class="block-hash">${(b.hash || '').slice(0, 52)}…</div>
          <div class="block-time">${fmtTime(b.timestamp)}</div>
        </div>
      `).join('') || '<div style="padding:calc(var(--grid)*2);color:var(--mono-400);font-size:12px;">No blocks yet</div>';
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

// Search: by block number or hash prefix
async function searchExplorer() {
  const q = (document.getElementById('explorer-search')?.value || '').trim();
  if (!q) { loadExplorer(1); return; }

  clearPagination();
  const tbody = document.getElementById('explorer-blocks');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:calc(var(--grid)*3);color:var(--mono-400);font-size:12px;text-align:center;">Searching…</td></tr>`;

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
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:calc(var(--grid)*2);color:#c00;font-size:12px;text-align:center;">Search error</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="6" style="padding:calc(var(--grid)*3);text-align:center;color:var(--mono-400);font-size:12px;">No blocks found</td></tr>`;
    return;
  }

  tbody.innerHTML = blocks.map(b => {
    const gas = b.gasUsed ?? (b.transactions || []).reduce((s, tx) => s + (tx.gasUsed || 0), 0);
    return `
      <tr onclick="showBlockDetail(${b.index})">
        <td>#${b.index}</td>
        <td class="mono">${(b.hash || '').slice(0, 20)}…</td>
        <td class="mono" onclick="event.stopPropagation();showValidatorDetail('${b.validator || ''}')">${(b.validator || '—').slice(0, 16)}…</td>
        <td>${b.transactions?.length ?? 0}</td>
        <td>${gas.toLocaleString()} gas</td>
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
    ctrl.innerHTML = `<span style="font-size:12px;color:var(--mono-400)">${total} block${total !== 1 ? 's' : ''}</span>`;
    return;
  }

  ctrl.innerHTML = `
    <button onclick="loadExplorer(1)" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-angle-double-left"></i></button>
    <button onclick="loadExplorer(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="fas fa-angle-left"></i> Previous</button>
    <span id="explorer-page-info" style="font-size:12px;color:var(--mono-400);margin:0 calc(var(--grid)*1);">
      Page ${page} of ${totalPages} · ${total} blocks
    </span>
    <button onclick="loadExplorer(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next <i class="fas fa-angle-right"></i></button>
    <button onclick="loadExplorer(${totalPages})" ${page >= totalPages ? 'disabled' : ''}><i class="fas fa-angle-double-right"></i></button>
    <span style="display:flex;align-items:center;gap:4px;margin-left:calc(var(--grid)*2)">
      <input id="explorer-jump" type="number" min="1" max="${totalPages}"
             placeholder="#"
             style="width:60px;padding:5px 8px;border:var(--border);font-size:12px;text-align:center;"
             onkeydown="if(event.key==='Enter')jumpToPage()">
      <button onclick="jumpToPage()" style="padding:5px 12px;border:var(--border);background:var(--mono-1000);cursor:pointer;font-size:11px;"><i class="fas fa-arrow-right"></i></button>
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
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-hash"></i> Hash</td><td class="mono" style="word-break:break-all;">${block.hash || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-link"></i> Previous Hash</td><td class="mono" style="word-break:break-all;">${block.previousHash || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-user-check"></i> Validator</td><td class="mono">${block.validator || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-clock"></i> Timestamp</td><td>${fmtTime(block.timestamp)}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-link"></i> Chain ID</td><td>${block.chainId || '—'}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-gas-pump"></i> Gas Used</td><td>${gas.toLocaleString()} gas</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-coins"></i> Block Fees</td><td>${sayn(block.transactions?.reduce((sum, tx) => sum + (tx.gasUsed || 0) * (tx.gasPrice || 0), 0) || 0)}</td></tr>
            <tr class="detail-row"><td class="detail-label"><i class="fas fa-database"></i> State Root</td><td class="mono" style="word-break:break-all;">${block.stateRoot || '—'}</td></tr>
          </table>

          <div style="margin-top:calc(var(--grid)*3);border-top:var(--border);padding-top:calc(var(--grid)*2);">
            <div style="font-size:12px;font-weight:500;margin-bottom:calc(var(--grid)*1);">
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
                    ${tx.gasUsed      ? `<div><strong>Gas Used:</strong> ${tx.gasUsed.toLocaleString()} gas</div>`   : ''}
                    ${tx.gasUsed && tx.gasPrice ? `<div><strong>Fee:</strong> ${sayn((tx.gasUsed || 0) * (tx.gasPrice || 0))}</div>` : ''}
                  </div>
                `).join('')
              : '<p style="color:var(--mono-400);font-size:12px;">No transactions in this block</p>'
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
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*2);color:var(--mono-400);font-size:12px;text-align:center;">Loading…</td></tr>`;

  try {
    const data = await apiFetch('/validators');
    allValidators = data.validators || [];

    if (!tbody) return;

    if (!allValidators.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*3);text-align:center;color:var(--mono-400)">No validators found</td></tr>`;
      return;
    }

    renderValidatorList(allValidators);
    updateValidatorStats(allValidators);

  } catch (e) {
    console.error('Validators:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*2);color:#c00;font-size:12px;text-align:center;">Failed to load validators</td></tr>`;
  }
}

// ── Validator Search Filter ──────────────────────────────────────────────────
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

  const tbody = document.getElementById('validator-list');
  if (tbody && filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*3);text-align:center;color:var(--mono-400);font-size:12px;">No validator found.</td></tr>`;
  }
}

function renderValidatorList(validators) {
  const tbody = document.getElementById('validator-list');
  if (!tbody) return;

  tbody.innerHTML = validators.map(v => `
    <tr onclick="showValidatorDetail('${v.address || ''}')">
      <td class="mono">${(v.address || '').slice(0, 20)}…</td>
      <td>${sayn(v.stake ?? 0)} <span style="font-size:10px;color:var(--mono-500)">(${(v.stake ?? 0).toLocaleString()} bu)</span></td>
      <td style="font-size:11px;color:var(--mono-500)">${(v.stake ?? 0).toLocaleString()}</td>
      <td>${v.percentage ?? 0}%</td>
      <td>${v.reputation ?? 0}</td>
      <td>${v.missedBlocks ?? 0}</td>
      <td>
        <span style="font-size:11px;padding:2px 8px;border:1px solid ${v.isActive ? '#2a7a2a' : 'var(--mono-800)'};color:${v.isActive ? '#2a7a2a' : 'var(--mono-400)'}">
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
        <div id="vd-loading" style="color:var(--mono-400);font-size:12px;padding:calc(var(--grid)*2);text-align:center;">Loading blocks…</div>
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
      container.innerHTML = '<p style="color:var(--mono-400);font-size:12px;text-align:center;">No blocks validated by this address (last 200 blocks).</p>';
      return;
    }

    container.innerHTML = `
      <div style="font-size:12px;color:var(--mono-400);margin-bottom:calc(var(--grid)*2);">
        <i class="fas fa-cubes"></i> ${blocks.length} block${blocks.length !== 1 ? 's' : ''} validated (last 200 checked)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="border-bottom:var(--border);">
          <tr>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:10px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em;">Block</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:10px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em;">Hash</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:10px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em;">Txs</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:10px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em;">Gas</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:10px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em;">Time</th>
          </tr>
        </thead>
        <tbody>
          ${blocks.map(b => `
            <tr style="border-bottom:1px solid var(--mono-900);">
              <td style="padding:calc(var(--grid)*1);">#${b.index}</td>
              <td style="padding:calc(var(--grid)*1);font-family:'SF Mono',monospace;font-size:11px;">${(b.hash||'').slice(0,20)}…</td>
              <td style="padding:calc(var(--grid)*1);">${b.transactions?.length ?? 0}</td>
              <td style="padding:calc(var(--grid)*1);">${(b.gasUsed ?? 0).toLocaleString()} gas</td>
              <td style="padding:calc(var(--grid)*1);">${fmtTime(b.timestamp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    const c = document.getElementById('vd-loading');
    if (c) c.innerHTML = '<p style="color:#c00;font-size:12px;text-align:center;">Error loading validator blocks.</p>';
  }
}

// ── Layers ─────────────────────────────────────────────────────────────────────────
async function loadLayers() {
  try {
    const net = await apiFetch('/network');
    setEl('layer-level',    net.layer ? 'Layer ' + net.layer : 'Layer 1 (Main)');
    setEl('layer-chain-id', net.chainId || '—');
    setEl('layer-blocktime', net.blockTime || '—');
    setEl('layer-decimals', net.decimals
      ? `${net.decimals.toLocaleString()} (1 SAYN = ${net.decimals.toLocaleString()} base units)`
      : '—'
    );
  } catch (e) { console.error('Layers:', e); }
}

// ── Contracts ─────────────────────────────────────────────────────────────────
async function loadContracts() {
  try {
    const data = await apiFetch('/contracts');
    allContracts = data.contracts || [];
    renderContracts(allContracts);
  } catch (e) { console.error('Contracts:', e); }
}

// ── Contract Search Filter ───────────────────────────────────────────────────
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
    tbody.innerHTML = `<tr><td colspan="3" style="padding:calc(var(--grid)*3);text-align:center;color:var(--mono-400);font-size:12px;">No contracts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = contracts.map(c => `
    <tr onclick="showContractDetail('${c.address || ''}')">
      <td class="mono">${(c.address || '').slice(0, 20)}…</td>
      <td class="mono">${(c.creator || '').slice(0, 20)}…</td>
      <td>${(c.code?.length ?? 0).toLocaleString()} bytes</td>
    </tr>
  `).join('');
}

// Helper to sanitize contract state for privacy, security and compliance
function sanitizeContractState(stateObj) {
  if (!stateObj || typeof stateObj !== 'object') return stateObj;
  
  const sanitized = Array.isArray(stateObj) ? [] : {};
  const sensitiveKeys = ['secret', 'key', 'password', 'pass', 'salt', 'seed', 'pwd', 'private', 'sk', 'priv'];
  
  for (const [key, val] of Object.entries(stateObj)) {
    const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk));
    if (isSensitive) {
      if (Array.isArray(sanitized)) {
        sanitized.push("[REDACTED FOR SECURITY & PRIVACY]");
      } else {
        sanitized[key] = "[REDACTED FOR SECURITY & PRIVACY]";
      }
    } else if (val && typeof val === 'object') {
      if (Array.isArray(sanitized)) {
        sanitized.push(sanitizeContractState(val));
      } else {
        sanitized[key] = sanitizeContractState(val);
      }
    } else {
      if (Array.isArray(sanitized)) {
        sanitized.push(val);
      } else {
        sanitized[key] = val;
      }
    }
  }
  return sanitized;
}

// ── Show contract detail modal (Realtime) ──────────────────────────────────────
async function showContractDetail(address) {
  if (!address) return;

  // Clear any existing poll interval
  if (window.contractPollInterval) {
    clearInterval(window.contractPollInterval);
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 900px; max-height: 90vh;">
      <div class="modal-header">
        <h3><i class="fas fa-file-contract"></i> Contract: <span class="mono" style="font-size:12px; font-weight:bold;">${address}</span></h3>
        <button class="modal-close" id="contract-modal-close"><i class="fas fa-times"></i> CLOSE</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: calc(var(--grid)*3); height: 100%; overflow: hidden;">
        
        <!-- Metadata and Tech Specs Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: calc(var(--grid)*3); flex-shrink: 0;">
          <div style="border: var(--border); padding: calc(var(--grid)*2); background: var(--mono-950); border-radius: 4px;">
            <h4 style="font-size: 11px; text-transform: uppercase; color: var(--mono-400); margin-bottom: var(--grid); border-bottom: 1px solid var(--mono-900); padding-bottom: 2px;">Metadata</h4>
            <table style="width: 100%; font-size: 11px;">
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Name:</td><td style="padding: 4px 0; border: none; font-weight: bold;" id="c-meta-name">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Version:</td><td style="padding: 4px 0; border: none; font-weight: bold;" id="c-meta-version">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Creator:</td><td style="padding: 4px 0; border: none;" class="mono" id="c-meta-creator">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Created At:</td><td style="padding: 4px 0; border: none;" id="c-meta-created">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Block:</td><td style="padding: 4px 0; border: none; font-weight: bold;" id="c-meta-block">—</td></tr>
            </table>
          </div>
          <div style="border: var(--border); padding: calc(var(--grid)*2); background: var(--mono-950); border-radius: 4px;">
            <h4 style="font-size: 11px; text-transform: uppercase; color: var(--mono-400); margin-bottom: var(--grid); border-bottom: 1px solid var(--mono-900); padding-bottom: 2px;">Tech Specs</h4>
            <table style="width: 100%; font-size: 11px;">
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Code Size:</td><td style="padding: 4px 0; border: none;" id="c-tech-size">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Code Hash:</td><td style="padding: 4px 0; border: none;" class="mono" id="c-tech-hash">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Exposed Methods:</td><td style="padding: 4px 0; border: none;" id="c-tech-methods">—</td></tr>
              <tr><td style="padding: 4px 0; border: none; color: var(--mono-400);">Last Update:</td><td style="padding: 4px 0; border: none;" id="c-tech-updated">—</td></tr>
            </table>
          </div>
        </div>

        <!-- Detail content with Split layout: left state (realtime), right ABI -->
        <div style="display: flex; gap: calc(var(--grid)*3); flex: 1; overflow: hidden; min-height: 0;">
          
          <!-- Left: State View (Realtime & Sanitized) -->
          <div style="flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%;">
            <h4 style="font-size: 11px; text-transform: uppercase; color: var(--mono-400); margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
              <span>On-Chain State</span>
              <span style="font-size: 9px; padding: 2px 6px; background: #2a7a2a; color: white; border-radius: 2px; text-transform: none;"><i class="fas fa-sync fa-spin"></i> Live Realtime updates</span>
            </h4>
            <div style="flex: 1; border: var(--border); border-radius: 4px; overflow: auto; background: var(--mono-950); padding: calc(var(--grid)*1.5);">
              <pre id="c-state" class="mono" style="font-size: 11px; margin: 0; white-space: pre-wrap; word-break: break-all; color: var(--mono-100);">Loading state…</pre>
            </div>
          </div>
          
          <!-- Right: Exposed Interface (ABI) View -->
          <div style="flex: 1.2; display: flex; flex-direction: column; min-width: 0; height: 100%;">
            <h4 style="font-size: 11px; text-transform: uppercase; color: var(--mono-400); margin-bottom: 4px;">Exposed Interface (ABI)</h4>
            <div style="flex: 1; border: var(--border); border-radius: 4px; overflow: auto; background: var(--mono-950); padding: calc(var(--grid)*2);" id="c-abi-container">
              <p style="color:var(--mono-400); font-size:11px;">Loading interface details…</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  `;

  const closeBtn = modal.querySelector('#contract-modal-close');
  const cleanUp = () => {
    clearInterval(window.contractPollInterval);
    window.contractPollInterval = null;
    modal.remove();
  };

  closeBtn.addEventListener('click', cleanUp);
  modal.addEventListener('click', e => { if (e.target === modal) cleanUp(); });
  document.body.appendChild(modal);

  async function fetchAndUpdate() {
    try {
      const contract = await apiFetch(`/contracts/${address}`);
      if (!contract) throw new Error('Contract not returned');

      setEl('c-meta-name', contract.name || 'UnnamedContract');
      setEl('c-meta-version', contract.version || '1.0.0');
      setEl('c-meta-creator', contract.creator ? (contract.creator.slice(0, 30) + '…') : '—');
      setEl('c-meta-created', contract.createdAt ? fmtTime(contract.createdAt) : '—');
      setEl('c-meta-block', contract.blockIndex !== undefined && contract.blockIndex !== null ? `#${contract.blockIndex}` : '—');

      setEl('c-tech-size', contract.code ? (contract.code.length.toLocaleString() + ' bytes') : '0 bytes');
      setEl('c-tech-hash', contract.codeHash ? (contract.codeHash.slice(0, 16) + '…') : '—');
      
      const methods = contract.abi && Array.isArray(contract.abi) 
        ? contract.abi.map(m => typeof m === 'string' ? m : (m.name || 'anonymous')).join(', ')
        : '—';
      setEl('c-tech-methods', methods || 'none');
      setEl('c-tech-updated', fmtTime(Date.now()));

      // Render Sanitized State (Hides secrets, keys, passwords, salts)
      const stateEl = document.getElementById('c-state');
      if (stateEl) {
        if (contract.state && Object.keys(contract.state).length > 0) {
          const sanitizedState = sanitizeContractState(contract.state);
          stateEl.textContent = JSON.stringify(sanitizedState, null, 2);
        } else {
          stateEl.textContent = 'No state storage variables initialized yet.';
        }
      }

      // Populate ABI interface list securely without revealing intellectual property
      const abiContainer = document.getElementById('c-abi-container');
      if (abiContainer) {
        if (contract.abi && Array.isArray(contract.abi) && contract.abi.length > 0) {
          abiContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${contract.abi.map(m => {
                const name = typeof m === 'string' ? m : (m.name || 'anonymous');
                const inputs = m.inputs && Array.isArray(m.inputs)
                  ? m.inputs.map(i => `${i.name || i}`).join(', ')
                  : (m.args && Array.isArray(m.args) ? m.args.join(', ') : '');
                const isConst = m.constant || m.stateMutability === 'view' || m.stateMutability === 'pure';
                
                return `
                  <div style="border-bottom: 1px solid var(--mono-900); padding-bottom: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <strong class="mono" style="color:var(--mono-100); font-size:12px;">${name}(${inputs})</strong>
                      <span style="font-size:9px; padding:2px 6px; background:${isConst ? 'var(--mono-900)' : 'var(--mono-100)'}; color:${isConst ? 'var(--mono-400)' : 'var(--mono-1000)'}; border-radius:2px; font-weight:500;">
                        ${isConst ? 'Read-Only' : 'State-Changing'}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else {
          abiContainer.innerHTML = '<p style="color:var(--mono-400); font-size:11px;">No ABI methods exposed.</p>';
        }
      }
    } catch (e) {
      console.error('Error fetching contract details:', e);
      const stateEl = document.getElementById('c-state');
      if (stateEl) stateEl.textContent = 'Error loading contract details.';
    }
  }

  await fetchAndUpdate();
  window.contractPollInterval = setInterval(fetchAndUpdate, 2000);
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

// ── Peer Search Filter ──────────────────────────────────────────────────────
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
    peerDiv.innerHTML = '<p style="color:var(--mono-400);padding:calc(var(--grid)*2);font-size:12px;">No peers connected</p>';
    return;
  }

  peerDiv.innerHTML = peers.map(p => `
    <div class="peer-row">
      <div><strong>Node ID:</strong> ${(p.nodeId || '—').slice(0, 20)}…</div>
      <div><strong>Height:</strong> ${p.chainHeight ?? '—'}</div>
      <div><strong>Last seen:</strong> ${fmtTimeAgo(p.lastSeen)}</div>
    </div>
  `).join('');
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
  const dec = (typeof networkConfig !== 'undefined' && networkConfig && networkConfig.decimals) || 100000000;
  const v = Number(baseUnits) / dec;
  const fixed = dec === 100000000 ? 8 : 4;
  const ticker = (typeof networkConfig !== 'undefined' && networkConfig && networkConfig.ticker) || 'SAYN';
  return Number.isFinite(v) ? v.toFixed(fixed) + (withUnit ? ' ' + ticker : '') : '—';
}

function showNotification(msg) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--mono-100);color:var(--mono-1000);padding:8px 16px;font-size:12px;letter-spacing:.05em;z-index:10000;border:var(--border);';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

// ── Legal Modals ─────────────────────────────────────────────────────────────
function showLegalModal(type) {
  const modals = {
    terms: {
      title: "Terms & Conditions",
      icon: "fa-gavel",
      content: `
        <p style="margin-bottom:12px;"><strong>1. Decentralized Nature</strong></p>
        <p style="margin-bottom:16px;">SAYMAN is a decentralized, peer-to-peer open-source blockchain network. There is no central administrator, company, or authority that controls the network. By using this explorer or interacting with the network, you acknowledge that you are using a decentralized protocol at your own risk.</p>
        <p style="margin-bottom:12px;"><strong>2. User Responsibility</strong></p>
        <p style="margin-bottom:16px;">You are solely responsible for the security of your private keys, seed phrases, and wallets. Transactions broadcast to the SAYMAN network are immutable and irreversible. The developers, contributors, and validators cannot recover lost funds, reverse transactions, or restore access to locked accounts.</p>
        <p style="margin-bottom:12px;"><strong>3. Smart Contracts & Custom Tokens</strong></p>
        <p style="margin-bottom:16px;">Anyone can deploy smart contracts, custom tokens, memecoins, or DEX pools. The network and its developers do not verify, endorse, or guarantee the safety or legality of user-deployed contracts. Exercise extreme caution when interacting with third-party contracts.</p>
        <p style="margin-bottom:12px;"><strong>4. Disclaimer of Warranty</strong></p>
        <p>The software and network are provided "AS IS", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
      `
    },
    privacy: {
      title: "Privacy Policy",
      icon: "fa-shield-alt",
      content: `
        <p style="margin-bottom:12px;"><strong>1. On-Chain Ledger Transparency</strong></p>
        <p style="margin-bottom:16px;">SAYMAN is a public ledger blockchain. All transactions, contract deployments, validator stakes, peer connections, and on-chain activities are public, globally accessible, and immutable. Do not store any personal, confidential, or personally identifiable information (PII) on the blockchain.</p>
        <p style="margin-bottom:12px;"><strong>2. No Data Collection</strong></p>
        <p style="margin-bottom:16px;">This blockchain explorer does not require registration, accounts, or email sign-ups. We do not collect, sell, or track personal information, IP addresses, or browsing history.</p>
        <p style="margin-bottom:12px;"><strong>3. Third-Party Links</strong></p>
        <p>The dashboard and docs contain links to external wallets, verification pages, or GitHub. We are not responsible for the privacy practices of third-party platforms.</p>
      `
    },
    cookies: {
      title: "Cookies Policy",
      icon: "fa-cookie-bite",
      content: `
        <p style="margin-bottom:12px;"><strong>1. Strictly Necessary Cookies</strong></p>
        <p style="margin-bottom:16px;">This explorer interface does not use third-party tracking, profiling, or advertising cookies. We only use functional local storage (such as browser localStorage) to remember configuration choices (e.g. API endpoint base URLs or page selections).</p>
        <p style="margin-bottom:12px;"><strong>2. Opt-out</strong></p>
        <p>Since we do not deploy tracking or analytical cookies, there is no tracking to opt-out of. You can clear your browser's local cache at any time to remove saved network settings.</p>
      `
    },
    copyright: {
      title: "Copyright Notice",
      icon: "fa-copyright",
      content: `
        <p style="margin-bottom:12px;"><strong>MIT License</strong></p>
        <p style="margin-bottom:16px;">Copyright (c) 2026 SAYMAN Blockchain Team</p>
        <p style="margin-bottom:16px;">Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</p>
        <p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>
      `
    }
  };

  const item = modals[type];
  if (!item) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 600px;">
      <div class="modal-header">
        <h3><i class="fas ${item.icon}"></i> ${item.title}</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i> CLOSE</button>
      </div>
      <div class="modal-body" style="line-height: 1.6; font-size: 13px; color: var(--mono-100); padding: calc(var(--grid)*3); overflow-y: auto;">
        ${item.content}
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}