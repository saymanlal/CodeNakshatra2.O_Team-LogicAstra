import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const resDir = path.join(projectRoot, 'wallet-manager', 'android', 'app', 'src', 'main', 'res');

const fullLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F1016" />
      <stop offset="100%" stop-color="#060709" />
    </linearGradient>
    <linearGradient id="pGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="pGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="50%" stop-color="#8B5CF6" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#8B5CF6" flood-opacity="0.25" />
    </filter>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#bgGrad)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="4" />
  <g filter="url(#glow)">
    <path d="M 210 130 H 310 C 376 130, 430 184, 430 250 S 376 370, 310 370 H 210 Z" fill="url(#pGrad2)" />
    <rect x="150" y="130" width="60" height="252" rx="30" fill="url(#pGrad1)" />
    <path d="M 210 190 H 310 C 343 190, 370 217, 370 250 S 343 310, 310 310 H 210 Z" fill="url(#bgGrad)" />
  </g>
</svg>
`;

const foregroundLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="pGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <linearGradient id="pGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="50%" stop-color="#8B5CF6" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#8B5CF6" flood-opacity="0.25" />
    </filter>
  </defs>
  <!-- Foreground adaptive icon has transparent background, emblem is centered -->
  <g transform="translate(-34, 6)" filter="url(#glow)">
    <path d="M 210 130 H 310 C 376 130, 430 184, 430 250 S 376 370, 310 370 H 210 Z" fill="url(#pGrad2)" />
    <rect x="150" y="130" width="60" height="252" rx="30" fill="url(#pGrad1)" />
    <path d="M 210 190 H 310 C 343 190, 370 217, 370 250 S 343 310, 310 310 H 210 Z" fill="#0F1016" />
  </g>
</svg>
`;

const tempFullSvgPath = path.join(projectRoot, 'temp_full.svg');
const tempForeSvgPath = path.join(projectRoot, 'temp_foreground.svg');

fs.writeFileSync(tempFullSvgPath, fullLogoSvg);
fs.writeFileSync(tempForeSvgPath, foregroundLogoSvg);

// Update adaptive background color to match our brand's dark background #0F1016
const backgroundXmlPath = path.join(resDir, 'values', 'ic_launcher_background.xml');
fs.writeFileSync(backgroundXmlPath, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0F1016</color>
</resources>
`);
console.log('Updated ic_launcher_background.xml to #0F1016');

// List of target dimensions
const targets = [
  { folder: 'mipmap-mdpi', size: 48, foregroundSize: 108 },
  { folder: 'mipmap-hdpi', size: 72, foregroundSize: 162 },
  { folder: 'mipmap-xhdpi', size: 96, foregroundSize: 216 },
  { folder: 'mipmap-xxhdpi', size: 144, foregroundSize: 324 },
  { folder: 'mipmap-xxxhdpi', size: 192, foregroundSize: 432 }
];

targets.forEach(t => {
  const targetFolder = path.join(resDir, t.folder);
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // 1. Regular ic_launcher.png (Full icon)
  const launcherPath = path.join(targetFolder, 'ic_launcher.png');
  execSync(`convert -background none -density 300 -resize ${t.size}x${t.size} "${tempFullSvgPath}" "${launcherPath}"`);
  console.log(`Generated: ${launcherPath}`);

  // 2. Round ic_launcher_round.png (Full icon, but we can make it round or identical)
  const launcherRoundPath = path.join(targetFolder, 'ic_launcher_round.png');
  execSync(`convert -background none -density 300 -resize ${t.size}x${t.size} "${tempFullSvgPath}" "${launcherRoundPath}"`);
  console.log(`Generated: ${launcherRoundPath}`);

  // 3. Adaptive Foreground ic_launcher_foreground.png (Emblem only)
  const launcherForePath = path.join(targetFolder, 'ic_launcher_foreground.png');
  execSync(`convert -background none -density 300 -resize ${t.foregroundSize}x${t.foregroundSize} "${tempForeSvgPath}" "${launcherForePath}"`);
  console.log(`Generated: ${launcherForePath}`);
});

// Clean up temp files
fs.unlinkSync(tempFullSvgPath);
fs.unlinkSync(tempForeSvgPath);
console.log('✨ Android launcher icon generation complete.');
