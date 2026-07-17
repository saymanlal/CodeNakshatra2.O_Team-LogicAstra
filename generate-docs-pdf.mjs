#!/usr/bin/env node
// generate-docs-pdf.js — assembles all SAYMAN .md files into a styled HTML, then prints to PDF via Chrome headless

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { marked } from 'marked';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// ── Ordered sections ─────────────────────────────────────────────────────────
const SECTIONS = [
  { file: 'README.md',         title: null },
  { file: 'NETWORK_INFO.md',   title: null },
  { file: 'INSTALL.md',        title: null },
  { file: 'summary.md',        title: null },
  { file: 'comparison.md',     title: null },
  { file: 'pitch.md',          title: null },
  { file: 'PULL_REQUEST.md',   title: null },
  { file: 'AI.md',             title: null },
  { file: 'ABOUT.md',          title: null },
];

// ── Render markdown ───────────────────────────────────────────────────────────
let bodyHtml = '';
for (const { file, title } of SECTIONS) {
  const filePath = path.join(ROOT, file);
  if (!existsSync(filePath)) { console.warn(`⚠️  Missing: ${file}`); continue; }
  const md = readFileSync(filePath, 'utf8');
  const html = marked.parse(md);
  bodyHtml += `
  <div class="section page-break">
    <div class="section-source">${file}</div>
    ${html}
  </div>`;
}

// ── Full HTML document ────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SAYMAN Blockchain — Complete Documentation (Phase 22)</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --primary: #6366f1;
    --primary-dark: #4f46e5;
    --accent: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
    --bg: #ffffff;
    --surface: #f8fafc;
    --border: #e2e8f0;
    --text: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --code-bg: #1e293b;
    --code-text: #e2e8f0;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 11pt;
    line-height: 1.7;
    color: var(--text);
    background: var(--bg);
    padding: 0;
  }

  /* Cover page */
  .cover {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%);
    color: white;
    text-align: center;
    padding: 60px 40px;
    page-break-after: always;
  }

  .cover-logo {
    font-size: 72px;
    margin-bottom: 24px;
  }

  .cover h1 {
    font-size: 42pt;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #818cf8, #34d399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .cover .subtitle {
    font-size: 14pt;
    color: #94a3b8;
    margin-bottom: 40px;
    max-width: 600px;
  }

  .cover .badge-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 48px;
  }

  .cover .badge {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 100px;
    padding: 6px 16px;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .cover .badge.green { background: rgba(16,185,129,0.2); border-color: #10b981; color: #34d399; }
  .cover .badge.purple { background: rgba(99,102,241,0.2); border-color: #6366f1; color: #818cf8; }
  .cover .badge.blue { background: rgba(59,130,246,0.2); border-color: #3b82f6; color: #93c5fd; }

  .cover-meta {
    margin-top: 40px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    width: 100%;
    max-width: 640px;
  }

  .cover-meta-item {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 16px 20px;
    text-align: left;
  }

  .cover-meta-label {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    margin-bottom: 4px;
  }

  .cover-meta-value {
    font-size: 11pt;
    font-weight: 600;
    color: #e2e8f0;
    font-family: 'JetBrains Mono', monospace;
  }

  .cover-footer {
    margin-top: 60px;
    font-size: 9pt;
    color: #475569;
  }

  /* TOC */
  .toc {
    padding: 60px 72px;
    page-break-after: always;
  }

  .toc h2 {
    font-size: 24pt;
    font-weight: 700;
    margin-bottom: 32px;
    color: var(--text);
    border-bottom: 2px solid var(--primary);
    padding-bottom: 12px;
  }

  .toc-entry {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 0;
    border-bottom: 1px dotted var(--border);
    font-size: 11pt;
  }

  .toc-entry .num {
    font-weight: 700;
    color: var(--primary);
    min-width: 28px;
    font-size: 10pt;
  }

  .toc-entry .title { flex: 1; color: var(--text); }
  .toc-entry .file { font-family: 'JetBrains Mono', monospace; font-size: 8pt; color: var(--text-muted); }

  /* Sections */
  .section {
    padding: 48px 72px;
    position: relative;
  }

  .section-source {
    position: absolute;
    top: 20px;
    right: 72px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    color: var(--text-muted);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 8px;
  }

  .page-break { page-break-before: always; }
  .section:first-child { page-break-before: avoid; }

  /* Typography */
  h1 {
    font-size: 28pt;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--text);
    margin-bottom: 8px;
    margin-top: 0;
    line-height: 1.2;
    border-bottom: 3px solid var(--primary);
    padding-bottom: 12px;
  }

  h2 {
    font-size: 18pt;
    font-weight: 700;
    color: var(--text);
    margin-top: 36px;
    margin-bottom: 14px;
    letter-spacing: -0.02em;
    border-left: 4px solid var(--primary);
    padding-left: 14px;
  }

  h3 {
    font-size: 13pt;
    font-weight: 600;
    color: var(--text);
    margin-top: 24px;
    margin-bottom: 10px;
    letter-spacing: -0.01em;
  }

  h4 {
    font-size: 11pt;
    font-weight: 600;
    color: var(--primary);
    margin-top: 16px;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  p {
    margin-bottom: 14px;
    color: var(--text);
  }

  ul, ol {
    margin: 10px 0 16px 24px;
  }

  li {
    margin-bottom: 6px;
    line-height: 1.6;
  }

  li > ul { margin-top: 4px; margin-bottom: 4px; }

  /* Code */
  code {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 9.5pt;
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 1px 6px;
  }

  pre {
    background: var(--code-bg);
    color: var(--code-text);
    border-radius: 10px;
    padding: 20px 24px;
    margin: 16px 0;
    overflow-x: auto;
    border-left: 4px solid var(--primary);
    font-size: 9pt;
    line-height: 1.65;
  }

  pre code {
    background: none;
    border: none;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 10pt;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  thead {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color: white;
  }

  thead th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    font-size: 9.5pt;
    letter-spacing: 0.02em;
  }

  tbody tr:nth-child(even) { background: var(--surface); }
  tbody tr:nth-child(odd) { background: var(--bg); }

  tbody tr:hover { background: #eff6ff; }

  td {
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  /* Blockquote / callouts */
  blockquote {
    border-left: 4px solid var(--primary);
    background: #f0f9ff;
    margin: 16px 0;
    padding: 14px 20px;
    border-radius: 0 8px 8px 0;
    color: #0369a1;
    font-size: 10.5pt;
  }

  blockquote strong { color: #0c4a6e; }

  /* Links */
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Horizontal rule */
  hr {
    border: none;
    border-top: 2px solid var(--border);
    margin: 32px 0;
  }

  strong { font-weight: 600; color: var(--text); }
  em { font-style: italic; }

  /* Print */
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    pre { white-space: pre-wrap; word-break: break-word; }
    a { color: var(--primary) !important; }
  }

  /* Page numbers via CSS counter */
  @page { margin: 0; size: A4; }
</style>
</head>
<body>

<!-- ── Cover Page ── -->
<div class="cover">
  <div class="cover-logo">⛓️</div>
  <h1>SAYMAN Blockchain</h1>
  <p class="subtitle">Complete Technical Documentation — Phase 22<br>
  JavaScript-native Smart Contracts · Proof-of-Stake · Multi-Layer Chains · EVM Compatible</p>

  <div class="badge-row">
    <span class="badge green">Phase 22</span>
    <span class="badge purple">Public Testnet</span>
    <span class="badge blue">Chain ID 82922</span>
    <span class="badge green">MetaMask Ready</span>
    <span class="badge purple">tSAYN</span>
    <span class="badge blue">MIT License</span>
  </div>

  <div class="cover-meta">
    <div class="cover-meta-item">
      <div class="cover-meta-label">RPC Endpoint</div>
      <div class="cover-meta-value">sayman.onrender.com</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Explorer</div>
      <div class="cover-meta-value">sayman.up.railway.app</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Ticker (Testnet)</div>
      <div class="cover-meta-value">tSAYN</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Block Time</div>
      <div class="cover-meta-value">5 seconds</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Decimals</div>
      <div class="cover-meta-value">8 (sprinkles)</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Faucet</div>
      <div class="cover-meta-value">t.me/SaymanLal</div>
    </div>
  </div>

  <div class="cover-footer">
    © 2026 SAYMAN Blockchain · Vizkus Groups (Cybokrafts Universal Innovations Pvt. Ltd.)<br>
    github.com/saymanlal/SAYMAN · MIT License · Generated ${new Date().toISOString().slice(0,10)}
  </div>
</div>

<!-- ── Table of Contents ── -->
<div class="toc">
  <h2>📋 Table of Contents</h2>
  <div class="toc-entry"><span class="num">01</span><span class="title">Overview & What's New in Phase 22</span><span class="file">README.md</span></div>
  <div class="toc-entry"><span class="num">02</span><span class="title">Network Info & Wallet Connection (MetaMask, Trust Wallet, all EVM wallets)</span><span class="file">NETWORK_INFO.md</span></div>
  <div class="toc-entry"><span class="num">03</span><span class="title">Installation & Quick Start Guide</span><span class="file">INSTALL.md</span></div>
  <div class="toc-entry"><span class="num">04</span><span class="title">Operating a Multi-Peer Testnet</span><span class="file">summary.md</span></div>
  <div class="toc-entry"><span class="num">05</span><span class="title">Blockchain Comparison & Phase-by-Phase Roadmap (Phase 1–22)</span><span class="file">comparison.md</span></div>
  <div class="toc-entry"><span class="num">06</span><span class="title">Pitch Deck — Executive Summary & Go-To-Market Strategy</span><span class="file">pitch.md</span></div>
  <div class="toc-entry"><span class="num">07</span><span class="title">Pull Request — Phase 22 Changes & Testing Checklist</span><span class="file">PULL_REQUEST.md</span></div>
  <div class="toc-entry"><span class="num">08</span><span class="title">Developer Reference & Project Memory (AI.md)</span><span class="file">AI.md</span></div>
  <div class="toc-entry"><span class="num">09</span><span class="title">About SAYMAN — The Complete Story</span><span class="file">ABOUT.md</span></div>
</div>

<!-- ── Markdown sections ── -->
${bodyHtml}

</body>
</html>`;

const htmlPath = path.join(ROOT, 'docs.html');
writeFileSync(htmlPath, html, 'utf8');
console.log(`✅ HTML written: ${htmlPath}`);

// ── Print to PDF via Chrome headless ─────────────────────────────────────────
const pdfPath = path.join(ROOT, 'docs.pdf');
const chromeBin = '/usr/bin/google-chrome';

try {
  execSync(
    `xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" \
    "${chromeBin}" \
      --headless \
      --no-sandbox \
      --disable-gpu \
      --disable-software-rasterizer \
      --disable-dev-shm-usage \
      --run-all-compositor-stages-before-draw \
      --print-to-pdf="${pdfPath}" \
      --print-to-pdf-no-header \
      --no-pdf-header-footer \
      "file://${htmlPath}"`,
    { stdio: 'inherit', timeout: 120000 }
  );
  console.log(`✅ PDF generated: ${pdfPath}`);
} catch (err) {
  console.error('Chrome headless failed:', err.message);
  process.exit(1);
}
