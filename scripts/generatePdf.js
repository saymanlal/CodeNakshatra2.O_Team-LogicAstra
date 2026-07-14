import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');

// Helper to convert simple markdown to HTML
function mdToHtml(md) {
  // Escape HTML characters
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang.trim()}">${code}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Headers
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

  // Unordered Lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  // Wrap list items in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // Clean up duplicate nested <ul>
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // Paragraphs
  html = html.replace(/^\s*([^<\s].*$)/gim, '<p>$1</p>');
  
  // Clean up empty lines / spacing
  html = html.replace(/<p><\/p>/g, '');

  // Tables
  // Match standard markdown table lines
  const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
  html = html.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n');
    let tableHtml = '<table>';
    lines.forEach((line, idx) => {
      // Split cells
      const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
      if (idx === 0) {
        tableHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
      } else if (line.includes('---')) {
        // Skip separator line
      } else {
        tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      }
    });
    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  return html;
}

async function run() {
  console.log('📖 Generating docs.pdf...');

  const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  const install = fs.readFileSync(path.join(rootDir, 'INSTALL.md'), 'utf8');
  const comparison = fs.readFileSync(path.join(rootDir, 'comparison.md'), 'utf8');
  const networkInfo = fs.readFileSync(path.join(rootDir, 'NETWORK_INFO.md'), 'utf8');

  const content = `
    ${readme}
    
    <div style="page-break-after: always;"></div>
    
    ${networkInfo}
    
    <div style="page-break-after: always;"></div>
    
    ${install}
    
    <div style="page-break-after: always;"></div>
    
    ${comparison}
  `;

  const htmlBody = mdToHtml(content);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SAYMAN Blockchain Documentation - Phase 21</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 40px;
    }
    h1, h2, h3, h4 {
      color: #111;
      font-weight: 700;
    }
    h1 {
      font-size: 28px;
      border-bottom: 2px solid #eaecef;
      padding-bottom: 8px;
      margin-top: 40px;
    }
    h2 {
      font-size: 22px;
      border-bottom: 1px solid #eaecef;
      padding-bottom: 6px;
      margin-top: 30px;
    }
    h3 {
      font-size: 18px;
      margin-top: 24px;
    }
    p, li {
      font-size: 14px;
    }
    code {
      font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 12px;
      background-color: rgba(27,31,35,0.05);
      padding: 2px 4px;
      border-radius: 3px;
    }
    pre {
      background-color: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
      border-radius: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f6f8fa;
    }
    tr:nth-child(even) {
      background-color: #f8f9fa;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
  `;

  const tempHtmlPath = path.join(rootDir, 'temp_docs.html');
  fs.writeFileSync(tempHtmlPath, html);
  console.log('✅ Temporary HTML generated.');

  const finalPdfPath = path.join(rootDir, 'docs.pdf');

  try {
    console.log('Converting HTML to PDF via Chromium headless...');
    // Use chromium headless to print HTML to PDF
    const chromiumBins = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
    let chromiumBin = null;
    for (const bin of chromiumBins) {
      try {
        execSync(`which ${bin}`, { stdio: 'pipe' });
        chromiumBin = bin;
        break;
      } catch {}
    }
    if (!chromiumBin) throw new Error('No Chromium/Chrome browser found on PATH');

    execSync(
      `${chromiumBin} --headless --disable-gpu --no-sandbox --run-all-compositor-stages-before-draw ` +
      `--print-to-pdf="${finalPdfPath}" "file://${tempHtmlPath}"`,
      { cwd: rootDir }
    );

    if (fs.existsSync(finalPdfPath)) {
      console.log('🎉 docs.pdf updated successfully!');
    } else {
      console.error('❌ PDF was not generated by Chromium.');
    }
  } catch (err) {
    console.error('❌ Failed to convert HTML to PDF:', err.message);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

run();
