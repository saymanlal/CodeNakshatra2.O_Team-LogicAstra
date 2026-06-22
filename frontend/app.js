// ── SAYMAN Blockchain — app.js ────────────────────────────────────────────────
// Pages: Dashboard · Explorer (search + jump-to-page) · Validators (with block history) · Contracts · Network

const API   = '/api';
const POLL  = 5000;
const PG_SZ = 20;

// ── State ─────────────────────────────────────────────────────────────────────
let explorerPage   = 1;
let explorerTotal  = 0;
let networkConfig  = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // tag nav buttons with their page name so polling can read active page
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    // already tagged via data-page attribute in HTML
  });

  await loadNetworkConfig();
  updateHeaderInfo();
  showPage('dashboard');

  setInterval(poll, POLL);
  setInterval(updateHeaderInfo, POLL);
});

function poll() {
  const active = document.querySelector('.nav-btn.active');
  if (!active) return;
  switch (active.dataset.page) {
    case 'dashboard':  loadDashboard();                    break;
    case 'explorer':   loadExplorer(explorerPage);         break;
    case 'validators': /* validators don't auto-poll */    break;
    case 'contracts':  loadContracts();                    break;
    case 'network':    loadNetwork();                      break;
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
        <div class="block-item">
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

  // clear search UI when paginating normally
  const searchInput = document.getElementById('explorer-search');

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
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:calc(var(--grid)*3);color:var(--mono-400);font-size:12px;">Searching…</td></tr>`;

  try {
    // Try numeric block index first
    if (/^\d+$/.test(q)) {
      const block = await apiFetch(`/block/${q}`);
      renderExplorerRows(block ? [block] : []);
      setEl('explorer-page-info', block ? '1 result' : 'Block not found');
      return;
    }
    // Otherwise search by hash
    const block = await apiFetch(`/block/hash/${q}`);
    renderExplorerRows(block ? [block] : []);
    setEl('explorer-page-info', block ? '1 result' : 'No block found for that hash');
  } catch {
    // Fallback: filter client-side from current page
    try {
      const data = await apiFetch(`/blocks?page=1&limit=100`);
      const matches = (data.blocks || []).filter(b =>
        String(b.index) === q ||
        (b.hash || '').startsWith(q) ||
        (b.validator || '').startsWith(q)
      ).sort((a, b) => b.index - a.index);
      renderExplorerRows(matches);
      setEl('explorer-page-info', `${matches.length} result${matches.length !== 1 ? 's' : ''}`);
    } catch (e2) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:calc(var(--grid)*2);color:#c00;font-size:12px;">Search error</td></tr>`;
    }
  }
}

function clearSearch() {
  const el = document.getElementById('explorer-search');
  if (el) el.value = '';
  loadExplorer(1);
}

// Jump to page
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
      <tr style="cursor:pointer" onclick="showBlockDetail(${JSON.stringify(JSON.stringify(b))})"
          title="Click for full details">
        <td>#${b.index}</td>
        <td class="mono">${(b.hash || '').slice(0, 20)}…</td>
        <td class="mono link" onclick="event.stopPropagation();showValidatorDetail('${b.validator || ''}')"
            title="View validator blocks">${(b.validator || '—').slice(0, 16)}…</td>
        <td>${b.transactions?.length ?? 0}</td>
        <td>${gas.toLocaleString()}</td>
        <td>${fmtTime(b.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

function renderPagination(page, totalPages, total) {
  const ctrl = document.getElementById('pagination-controls');
  if (!ctrl) return;

  if (totalPages <= 1) {
    ctrl.innerHTML = `<span style="font-size:12px;color:var(--mono-400)">${total} block${total !== 1 ? 's' : ''}</span>`;
    return;
  }

  ctrl.innerHTML = `
    <button onclick="loadExplorer(1)" ${page <= 1 ? 'disabled' : ''}>«</button>
    <button onclick="loadExplorer(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
    <span id="explorer-page-info">Page ${page} of ${totalPages} · ${total} blocks</span>
    <button onclick="loadExplorer(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
    <button onclick="loadExplorer(${totalPages})" ${page >= totalPages ? 'disabled' : ''}>»</button>
    <span style="display:flex;align-items:center;gap:4px;margin-left:calc(var(--grid)*2)">
      <input id="explorer-jump" type="number" min="1" max="${totalPages}"
             placeholder="Page #"
             style="width:72px;padding:5px 8px;border:var(--border);font-size:12px;"
             onkeydown="if(event.key==='Enter')jumpToPage()">
      <button onclick="jumpToPage()">Go</button>
    </span>
  `;
}

function clearPagination() {
  const ctrl = document.getElementById('pagination-controls');
  if (ctrl) ctrl.innerHTML = '';
}

// Block detail modal
function showBlockDetail(jsonStr) {
  const b   = JSON.parse(jsonStr);
  const gas = b.gasUsed ?? (b.transactions || []).reduce((s, tx) => s + (tx.gasUsed || 0), 0);

  const modal = makeModal(`Block #${b.index}`, `
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      ${detailRow('Hash',          `<span class="mono" style="word-break:break-all">${b.hash || '—'}</span>`)}
      ${detailRow('Previous Hash', `<span class="mono" style="word-break:break-all">${b.previousHash || '—'}</span>`)}
      ${detailRow('Validator',     `<span class="mono">${b.validator || '—'}</span>`)}
      ${detailRow('Timestamp',     fmtTime(b.timestamp))}
      ${detailRow('Chain ID',      b.chainId || '—')}
      ${detailRow('Gas Used',      gas.toLocaleString())}
      ${detailRow('State Root',    `<span class="mono" style="word-break:break-all">${b.stateRoot || '—'}</span>`)}
    </table>
    <div style="margin-top:calc(var(--grid)*3);border-top:var(--border);padding-top:calc(var(--grid)*2)">
      <div style="font-size:12px;font-weight:500;margin-bottom:calc(var(--grid)*1)">
        Transactions (${b.transactions?.length ?? 0})
      </div>
      ${(b.transactions?.length
        ? b.transactions.map(tx => `
            <div style="border:var(--border);padding:calc(var(--grid)*2);margin-bottom:4px;font-size:11px">
              <div><strong>Type:</strong> ${tx.type}</div>
              <div><strong>ID:</strong> <span class="mono">${tx.id}</span></div>
              ${tx.data?.from   ? `<div><strong>From:</strong> <span class="mono">${tx.data.from}</span></div>`   : ''}
              ${tx.data?.to     ? `<div><strong>To:</strong> <span class="mono">${tx.data.to}</span></div>`     : ''}
              ${tx.data?.amount ? `<div><strong>Amount:</strong> ${sayn(tx.data.amount)}</div>`                 : ''}
              ${tx.gasUsed      ? `<div><strong>Gas:</strong> ${tx.gasUsed}</div>`                              : ''}
            </div>
          `).join('')
        : '<p style="color:var(--mono-400);font-size:12px">No transactions in this block</p>'
      )}
    </div>
  `);
  document.body.appendChild(modal);
}

// ── Validators ────────────────────────────────────────────────────────────────
async function loadValidators() {
  const tbody = document.getElementById('validator-list');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*2);color:var(--mono-400);font-size:12px;">Loading…</td></tr>`;

  try {
    const data = await apiFetch('/validators');
    const validators = data.validators || [];

    if (!tbody) return;

    if (!validators.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*3);text-align:center;color:var(--mono-400)">No validators found</td></tr>`;
      return;
    }

    tbody.innerHTML = validators.map(v => `
      <tr style="cursor:pointer" onclick="showValidatorDetail('${v.address || ''}')"
          title="Click to see blocks validated by this address">
        <td class="mono">${(v.address || '').slice(0, 20)}…</td>
        <td>${sayn(v.stake ?? 0)}</td>
        <td>${v.percentage ?? 0}%</td>
        <td>${v.missedBlocks ?? 0}</td>
        <td>
          <span style="font-size:11px;padding:2px 8px;border:1px solid ${v.isActive ? '#2a7a2a' : 'var(--mono-800)'};color:${v.isActive ? '#2a7a2a' : 'var(--mono-400)'}">
            ${v.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
      </tr>
    `).join('');

    // summary row
    setEl('val-total-stake', sayn(data.totalStake ?? 0));
    setEl('val-apr',         (data.estimatedAPR ?? 0) + '%');
    setEl('val-count',       validators.length);

  } catch (e) {
    console.error('Validators:', e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="padding:calc(var(--grid)*2);color:#c00;font-size:12px;">Failed to load validators</td></tr>`;
  }
}

// Show blocks validated by a specific address
async function showValidatorDetail(address) {
  if (!address) return;

  const modal = makeModal(
    `Validator: ${address.slice(0, 20)}…`,
    `<div id="vd-loading" style="color:var(--mono-400);font-size:12px;padding:calc(var(--grid)*2)">Loading blocks…</div>`
  );
  document.body.appendChild(modal);

  try {
    // Fetch all blocks and filter — replace with a dedicated endpoint if you add one later
    const data   = await apiFetch(`/blocks?page=1&limit=200`);
    const blocks = (data.blocks || [])
      .filter(b => (b.validator || '').toLowerCase() === address.toLowerCase())
      .sort((a, b) => b.index - a.index);

    const container = modal.querySelector('#vd-loading');
    if (!container) return;

    if (!blocks.length) {
      container.textContent = 'No blocks validated by this address (in last 200 blocks).';
      return;
    }

    container.innerHTML = `
      <div style="font-size:12px;color:var(--mono-400);margin-bottom:calc(var(--grid)*2)">
        ${blocks.length} block${blocks.length !== 1 ? 's' : ''} validated (last 200 checked)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="border-bottom:var(--border)">
          <tr>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:11px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em">Block</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:11px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em">Hash</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:11px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em">Txs</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:11px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em">Gas</th>
            <th style="text-align:left;padding:calc(var(--grid)*1);font-size:11px;color:var(--mono-400);text-transform:uppercase;letter-spacing:.06em">Time</th>
          </tr>
        </thead>
        <tbody>
          ${blocks.map(b => `
            <tr style="border-bottom:1px solid var(--mono-900)">
              <td style="padding:calc(var(--grid)*1)">#${b.index}</td>
              <td style="padding:calc(var(--grid)*1);font-family:'SF Mono',monospace;font-size:11px">${(b.hash||'').slice(0,20)}…</td>
              <td style="padding:calc(var(--grid)*1)">${b.transactions?.length ?? 0}</td>
              <td style="padding:calc(var(--grid)*1)">${(b.gasUsed ?? 0).toLocaleString()}</td>
              <td style="padding:calc(var(--grid)*1)">${fmtTime(b.timestamp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    const c = modal.querySelector('#vd-loading');
    if (c) c.textContent = 'Error loading validator blocks.';
  }
}

// ── Contracts ─────────────────────────────────────────────────────────────────
async function loadContracts() {
  try {
    const data      = await apiFetch('/contracts');
    const contracts = data.contracts || [];
    const tbody     = document.getElementById('contract-list');
    if (!tbody) return;

    if (!contracts.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="padding:calc(var(--grid)*3);text-align:center;color:var(--mono-400)">No contracts deployed yet</td></tr>`;
      return;
    }

    tbody.innerHTML = contracts.map(c => `
      <tr>
        <td class="mono">${(c.address || '').slice(0, 20)}…</td>
        <td class="mono">${(c.creator || '').slice(0, 20)}…</td>
        <td>${(c.code?.length ?? 0).toLocaleString()} bytes</td>
      </tr>
    `).join('');
  } catch (e) { console.error('Contracts:', e); }
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

    const peers = d.peerList || [];
    peerDiv.innerHTML = peers.length
      ? peers.map(p => `
          <div class="peer-row">
            <div><strong>Node ID:</strong> ${(p.nodeId || '—').slice(0, 20)}…</div>
            <div><strong>Height:</strong> ${p.chainHeight ?? '—'}</div>
            <div><strong>Last seen:</strong> ${fmtTimeAgo(p.lastSeen)}</div>
          </div>
        `).join('')
      : '<p style="color:var(--mono-400);padding:calc(var(--grid)*2);font-size:12px;">No peers connected</p>';

  } catch (e) { console.error('Network:', e); }
}

// ── Modal helper ──────────────────────────────────────────────────────────────
function makeModal(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:calc(var(--grid)*4)`;
  overlay.innerHTML = `
    <div style="background:var(--mono-1000);border:var(--border);max-width:820px;width:100%;max-height:82vh;display:flex;flex-direction:column">
      <div style="border-bottom:var(--border);padding:calc(var(--grid)*2) calc(var(--grid)*3);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <span style="font-size:14px;font-weight:500">${title}</span>
        <button onclick="this.closest('[style*=inset]').remove()"
                style="background:none;border:var(--border);padding:4px 10px;cursor:pointer;font-size:11px;letter-spacing:.06em">CLOSE</button>
      </div>
      <div style="padding:calc(var(--grid)*3);overflow-y:auto;flex:1">${bodyHtml}</div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

function detailRow(label, value) {
  return `<tr style="border-bottom:1px solid var(--mono-900)">
    <td style="padding:calc(var(--grid)*1.5);color:var(--mono-400);white-space:nowrap;width:120px">${label}</td>
    <td style="padding:calc(var(--grid)*1.5)">${value}</td>
  </tr>`;
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

// sayn(baseUnits, withUnit=true) → "1.2345 SAYN" or "1.2345"
function sayn(baseUnits, withUnit = true) {
  if (baseUnits === null || baseUnits === undefined) return '—';
  const v = Number(baseUnits) / 10000;
  return Number.isFinite(v) ? v.toFixed(4) + (withUnit ? ' SAYN' : '') : '—';
}

function showNotification(msg) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--mono-100);color:var(--mono-1000);padding:8px 16px;font-size:12px;letter-spacing:.05em;z-index:10000;';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2500);
}