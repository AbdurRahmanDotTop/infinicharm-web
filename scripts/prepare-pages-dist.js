const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const nextServerApp = path.join(baseDir, '.next', 'server', 'app');
const nextStatic = path.join(baseDir, '.next', 'static');
const publicDir = path.join(baseDir, 'public');
const distDir = path.join(baseDir, 'dist');

console.log('--- Preparing Cloudflare Pages Static Distribution ---');

// 1. Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Helper to copy recursively
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy public directory
if (fs.existsSync(publicDir)) {
  console.log('Copying public assets to dist...');
  copyDirSync(publicDir, distDir);
}

// 3. Copy .next/static to dist/_next/static
const distNextStatic = path.join(distDir, '_next', 'static');
if (fs.existsSync(nextStatic)) {
  console.log('Copying .next/static to dist/_next/static...');
  copyDirSync(nextStatic, distNextStatic);
}

// 4. Walk .next/server/app and extract HTML and metadata
let htmlCount = 0;
function walkApp(dir, relPath = '') {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const subRel = path.join(relPath, entry.name);

    if (entry.isDirectory()) {
      // Skip api and route group folders from direct path
      if (entry.name === 'api') continue;
      walkApp(fullPath, subRel);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.html')) {
        htmlCount++;
        // Strip out route group parens like (storefront) or (admin)
        const cleanRel = subRel
          .split(path.sep)
          .filter(segment => !segment.startsWith('(') || !segment.endsWith(')'))
          .join(path.sep);

        const targetFile = path.join(distDir, cleanRel);
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.copyFileSync(fullPath, targetFile);

        // Also create index.html in subfolder for clean URLs: /about -> /about/index.html
        const baseName = path.basename(cleanRel, '.html');
        if (baseName !== 'index' && baseName !== '_not-found' && baseName !== '404') {
          const dirPath = path.join(distDir, path.dirname(cleanRel), baseName);
          fs.mkdirSync(dirPath, { recursive: true });
          fs.copyFileSync(fullPath, path.join(dirPath, 'index.html'));
        }

        // Special fallback: _not-found.html -> 404.html
        if (baseName === '_not-found') {
          fs.copyFileSync(fullPath, path.join(distDir, '404.html'));
        }
      } else if (entry.name === 'robots.txt.body') {
        fs.copyFileSync(fullPath, path.join(distDir, 'robots.txt'));
      } else if (entry.name === 'sitemap.xml.body') {
        fs.copyFileSync(fullPath, path.join(distDir, 'sitemap.xml'));
      }
    }
  }
}

if (fs.existsSync(nextServerApp)) {
  console.log('Harvesting HTML routes from .next/server/app...');
  walkApp(nextServerApp);
}

// Ensure 404.html fallback exists
if (!fs.existsSync(path.join(distDir, '404.html')) && fs.existsSync(path.join(distDir, 'index.html'))) {
  fs.copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'));
}

console.log(`Success! Prepared dist directory with ${htmlCount} HTML routes and static assets.`);
