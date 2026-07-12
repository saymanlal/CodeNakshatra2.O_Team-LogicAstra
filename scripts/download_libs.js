import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const targetDirs = [
  path.join(projectRoot, 'wallet-manager'),
  path.join(projectRoot, 'wallet-manager', 'www')
];

const libraries = [
  {
    name: 'elliptic.min.js',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/elliptic/6.5.4/elliptic.min.js'
  },
  {
    name: 'qrcode.min.js',
    url: 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
  },
  {
    name: 'chart.umd.min.js',
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
  },
  {
    name: 'html5-qrcode.min.js',
    url: 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
  }
];

function downloadFile(url, targetPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        downloadFile(response.headers.location, targetPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download from ${url}. Status code: ${response.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(targetPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function start() {
  for (const lib of libraries) {
    console.log(`Downloading ${lib.name}...`);
    try {
      const tempPath = path.join(projectRoot, lib.name);
      await downloadFile(lib.url, tempPath);
      
      // Copy to target directories
      for (const dir of targetDirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const dest = path.join(dir, lib.name);
        fs.copyFileSync(tempPath, dest);
        console.log(`Copied ${lib.name} to ${dest}`);
      }
      
      // Delete temp file
      fs.unlinkSync(tempPath);
    } catch (err) {
      console.error(`Error downloading ${lib.name}:`, err.message);
    }
  }
  console.log('✅ All local libraries successfully downloaded and configured.');
}

start();
