import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path.replaceAll('\\', '/'));
  }
  return files;
}
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
const version = createHash('sha256').update(buildId).digest('hex').slice(0,12);
await copyFile('.next/server/app/index.html', 'public/offline-shell.html');
const assets = (await walk('.next/static')).filter(path => /\.(js|css|woff2?)$/.test(path)).map(path => path.replace('.next/static', '/_next/static'));
const precache = ['/offline-shell.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png', ...assets];
const template = await readFile('scripts/sw-template.js', 'utf8');
await writeFile('public/sw.js', template.replace('__CACHE_VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache)));
console.log(`Offline shell ready: ${assets.length} application assets, cache ${version}.`);
