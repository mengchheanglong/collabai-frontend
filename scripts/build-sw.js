// scripts/build-sw.js
// Runs after `ng build`: writes the full list of built files and a per-build version into
// the output sw.js, so the service worker pre-caches the whole app for offline use and
// replaces the cache on every deploy.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../dist/collabai-frontend/browser');
const swPath = path.join(outDir, 'sw.js');
const CACHEABLE = /\.(html|js|css|svg|png|jpg|jpeg|webp|ico|woff2?|webmanifest|json)$/i;

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

if (!fs.existsSync(swPath)) {
  console.error(`[build-sw] ${swPath} not found — run ng build first.`);
  process.exit(1);
}

const files = listFiles(outDir)
  .filter((file) => file !== swPath && CACHEABLE.test(file))
  .sort();

const hash = crypto.createHash('sha256');
const assets = ['/'];
for (const file of files) {
  const rel = '/' + path.relative(outDir, file).split(path.sep).join('/');
  assets.push(encodeURI(rel));
  hash.update(rel).update(fs.readFileSync(file));
}
const version = hash.digest('hex').slice(0, 12);

let sw = fs.readFileSync(swPath, 'utf8');
const versionLine = /const BUILD_VERSION = '[^']*';/;
const assetsLine = /const PRECACHE_ASSETS = \[[^\]]*\];/;
if (!versionLine.test(sw) || !assetsLine.test(sw)) {
  console.error('[build-sw] sw.js is missing the BUILD_VERSION / PRECACHE_ASSETS markers.');
  process.exit(1);
}
sw = sw
  .replace(versionLine, `const BUILD_VERSION = '${version}';`)
  .replace(assetsLine, `const PRECACHE_ASSETS = ${JSON.stringify(assets)};`);
fs.writeFileSync(swPath, sw);

console.log(`[build-sw] precaching ${assets.length} files (version ${version})`);
