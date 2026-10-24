import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { generateKeyPair, exportPKCS8, exportJWK } from 'jose';
import webpush from 'web-push';
mkdirSync('.cache', { recursive: true });
const cli = 'node_modules/convex/bin/main.js';
const call = (...args) =>
  execFileSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
let jwt = '';
try {
  jwt = call('env', 'get', 'JWT_PRIVATE_KEY');
} catch {}
if (!jwt) {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const values = {
    JWT_PRIVATE_KEY: (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, ' '),
    JWKS: JSON.stringify({ keys: [{ use: 'sig', ...(await exportJWK(publicKey)) }] }),
  };
  for (const [name, value] of Object.entries(values)) {
    writeFileSync('.cache/convex-env-value', value);
    call('env', 'set', name, '--from-file', '.cache/convex-env-value');
  }
  console.log('Authentication signing keys configured.');
} else console.log('Existing authentication signing keys preserved.');
let vapid = '';
try {
  vapid = call('env', 'get', 'VAPID_PUBLIC_KEY');
} catch {}
if (!vapid) {
  const keys = webpush.generateVAPIDKeys();
  for (const [name, value] of Object.entries({
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  })) {
    writeFileSync('.cache/convex-env-value', value);
    call('env', 'set', name, '--from-file', '.cache/convex-env-value');
  }
  console.log('Web Push keys configured.');
} else console.log('Existing Web Push keys preserved.');
try {
  unlinkSync('.cache/convex-env-value');
} catch {}
