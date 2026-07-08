import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find project root directory (parent of core/)
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

function parseEnv(text) {
  const env = {};
  const lines = text.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.substring(0, idx).trim();
    let val = line.substring(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
  return env;
}

try {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const env = parseEnv(content);
    for (const [key, val] of Object.entries(env)) {
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
} catch (err) {
  console.warn(`⚠️ Warning: Failed to load .env file at ${envPath}: ${err.message}`);
}
