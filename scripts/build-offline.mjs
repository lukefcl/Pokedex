import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}
/** Runs after compilation, before prerendering and the Vercel adapter.
 * No dependency on BUILD_ID or internal server HTML, neither of which is portable
 * across Next.js build phases or hosting adapters. Cache the served homepage instead.
 */
export async function buildOfflineWorker({ projectDir = process.cwd(), distDir = join(projectDir, '.next') } = {}) {
  const staticDir = join(distDir, 'static');
  const assets = (await walk(staticDir))
    .filter(path => /\.(js|css|woff2?)$/.test(path))
    .map(path => '/_next/static/' + relative(staticDir, path).split(sep).join('/'))
    .sort();
  if (!assets.some(path => path.endsWith('.js')) || !assets.some(path => path.endsWith('.css'))) {
    throw new Error('Offline worker generation needs compiled Next.js JS and CSS assets.');
  }
  let sprites=[];
  try { sprites=(await walk(join(projectDir,'public/sprites'))).filter(path=>/\.(png|gif)$/.test(path)).map(path=>'/'+relative(join(projectDir,'public'),path).split(sep).join('/')).sort(); } catch(error) { if(error.code!=='ENOENT')throw error; }
  const version = randomBytes(8).toString('hex');
  const precache = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png', ...assets, ...sprites];
  const template = await readFile(join(projectDir, 'scripts/sw-template.js'), 'utf8');
  const worker = template.replace('__CACHE_VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache));
  await writeFile(join(projectDir, 'public/sw.js'), worker);
  await rm(join(projectDir, 'public/offline-shell.html'), { force: true });
  console.log(`Offline cache ready: homepage + ${assets.length} application assets, cache ${version}.`);
  return { assets, sprites, precache, version };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const projectDir = resolve(process.argv[2] || process.cwd());
  const distDir = resolve(process.argv[3] || join(projectDir, '.next'));
  await buildOfflineWorker({ projectDir, distDir });
}
