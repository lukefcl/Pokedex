import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildOfflineWorker } from '../scripts/build-offline.mjs';

test('app updates preserve optional scanner models and serve them offline',async()=>{
 const handlers=new Map(),deleted=[];let claimed=false;
 const self={location:{origin:'https://findex.test'},addEventListener:(name,fn)=>handlers.set(name,fn),clients:{claim:async()=>{claimed=true;}}};
 const modelRequest={method:'GET',url:'https://findex.test/scanner-model/v1/mobileclip_s0/onnx/vision_model.onnx',mode:'cors'};
 const caches={keys:async()=>['findex-old-app','findex-ai-mobileclip-v2','unrelated-cache'],delete:async key=>deleted.push(key),open:async key=>({match:async request=>key==='findex-ai-mobileclip-v2'&&request.url===modelRequest.url?{body:'cached model'}:undefined})};
 const source=(await readFile(new URL('../scripts/sw-template.js',import.meta.url),'utf8')).replace('__PRECACHE__','[]').replace('__CACHE_VERSION__','qa');
 vm.runInNewContext(source,{self,caches,URL,fetch:async()=>{throw new Error('Offline');}});let work;handlers.get('activate')({waitUntil:p=>{work=p;}});await work;assert.deepEqual(deleted,['findex-old-app']);assert.equal(claimed,true);
 handlers.get('fetch')({request:modelRequest,respondWith:p=>{work=p;}});assert.equal((await work).body,'cached model');
});

test('push displays a notification and opens only the local mates feed',async()=>{
  const handlers=new Map(),shown=[],opened=[],messages=[];let focused=false,closed=false;
  const client={url:'https://findex.test/',focus:async()=>{focused=true;},postMessage:value=>messages.push(value)};
  const self={location:{origin:'https://findex.test'},addEventListener:(name,handler)=>handlers.set(name,handler),registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[client],openWindow:async url=>opened.push(url)}};
  const source=(await readFile(new URL('../scripts/sw-template.js',import.meta.url),'utf8')).replace('__PRECACHE__','[]').replace('__CACHE_VERSION__','qa');
  vm.runInNewContext(source,{self,URL});
  let work;handlers.get('push')({data:{json:()=>({title:'A mate caught snapper',body:'Open the feed',tag:'123',url:'https://attacker.example/'})},waitUntil:p=>{work=p;}});await work;
  assert.equal(shown.length,1);assert.equal(shown[0][0],'A mate caught snapper');assert.equal(shown[0][1].icon,'/icons/icon-192.png');
  handlers.get('notificationclick')({notification:{close:()=>{closed=true;},data:{url:'https://attacker.example/'}},waitUntil:p=>{work=p;}});await work;
  assert.equal(closed,true);assert.equal(focused,true);assert.equal(messages[0].type,'OPEN_FRIENDS');assert.equal(opened.length,0);
  self.clients.matchAll=async()=>[];handlers.get('notificationclick')({notification:{close:()=>{}},waitUntil:p=>{work=p;}});await work;assert.deepEqual(opened,['/#friends']);
});

async function fixture(run) {
  const projectDir = await mkdtemp(join(tmpdir(), 'findex-offline-'));
  const distDir = join(projectDir, 'custom-next-output');
  try {
    await Promise.all(['scripts', 'public/sprites', 'custom-next-output/static/chunks', 'custom-next-output/static/css', 'custom-next-output/static/media'].map(path => mkdir(join(projectDir, path), { recursive:true })));
    await copyFile(new URL('../scripts/sw-template.js', import.meta.url), join(projectDir, 'scripts/sw-template.js'));
    await Promise.all([
      writeFile(join(distDir, 'static/chunks/app.js'), '/* client app */'),
      writeFile(join(distDir, 'static/css/app.css'), 'body { color: green; }'),
      writeFile(join(distDir, 'static/media/local-font.woff2'), 'font'),
      writeFile(join(distDir, 'static/chunks/app.js.map'), '{}'),
      writeFile(join(projectDir, 'public/sprites/snapper.png'), 'png'),
      writeFile(join(projectDir, 'public/sprites/snapper.gif'), 'gif'),
    ]);
    await run({projectDir,distDir});
  } finally { await rm(projectDir, {recursive:true,force:true}); }
}

test('offline generation succeeds without server/app/index.html or BUILD_ID', async () => fixture(async options => {
  await assert.rejects(access(join(options.distDir, 'server/app/index.html')));
  await assert.rejects(access(join(options.distDir, 'BUILD_ID')));
  const {assets,precache} = await buildOfflineWorker(options);
  assert.deepEqual(assets, ['/_next/static/chunks/app.js', '/_next/static/css/app.css', '/_next/static/media/local-font.woff2']);
  assert.equal(precache[0], '/');
  assert.ok(precache.includes('/sprites/snapper.png'));assert.ok(precache.includes('/sprites/snapper.gif'));
  const worker = await readFile(join(options.projectDir, 'public/sw.js'), 'utf8');
  assert.doesNotMatch(worker, /__PRECACHE__|__CACHE_VERSION__|offline-shell\.html/);
  assert.match(worker, /cache\.match\('\/'\)/);
  assert.doesNotMatch(worker, /\\\\/);
}));

test('every build gets a fresh cache and removes the obsolete generated shell', async () => fixture(async options => {
  await writeFile(join(options.projectDir, 'public/offline-shell.html'), 'obsolete build shell');
  const first = await buildOfflineWorker(options), second = await buildOfflineWorker(options);
  assert.notEqual(first.version, second.version);
  await assert.rejects(access(join(options.projectDir, 'public/offline-shell.html')));
}));

function harness(source, failInstall = false) {
  const listeners = new Map(), cached = new Map();
  let skipped = false, requests = [];
  const cache = {
    async addAll(values) {
      requests = Array.from(values);
      if (failInstall) throw new Error('Required asset unavailable');
      for (const request of values) cached.set(request.url, { body:request.url === '/' ? 'complete application HTML' : 'asset' });
    },
    async match(path) { return cached.get(path); },
  };
  vm.runInNewContext(source, {
    self: { addEventListener(name,callback) {listeners.set(name,callback);}, location:{origin:'https://findex.example'}, async skipWaiting(){skipped=true;}, clients:{async claim(){}} },
    caches:{async open(){return cache;},async keys(){return [];},async delete(){return true;}},
    Request:class {constructor(url,options){this.url=url;this.cache=options.cache;}},
    URL,
    fetch:async()=>{throw new Error('Offline');},
  });
  return {listeners,cached,get requests(){return requests;},get skipped(){return skipped;}};
}

test('worker installs homepage/assets and serves the cached homepage for offline navigation', async () => fixture(async options => {
  await buildOfflineWorker(options);
  const worker = harness(await readFile(join(options.projectDir, 'public/sw.js'), 'utf8'));
  let installation;
  worker.listeners.get('install')({waitUntil(promise){installation=promise;}});
  await installation;
  assert.equal(worker.skipped,true);
  assert.ok(worker.cached.has('/'));
  assert.ok(worker.requests.every(request=>request.cache==='reload'));
  let response;
  worker.listeners.get('fetch')({request:{method:'GET',url:'https://findex.example/?installed=1',mode:'navigate'},respondWith(promise){response=promise;}});
  assert.equal((await response).body,'complete application HTML');
  worker.listeners.get('fetch')({request:{method:'GET',url:'https://findex.example/_next/static/chunks/app.js?dpl=deployment',mode:'cors'},respondWith(promise){response=promise;}});
  assert.equal((await response).body,'asset');
  worker.listeners.get('fetch')({request:{method:'GET',url:'https://findex.example/sprites/snapper.gif',mode:'cors'},respondWith(promise){response=promise;}});
  assert.equal((await response).body,'asset');
}));

test('worker does not activate when a required precache resource fails', async () => fixture(async options => {
  await buildOfflineWorker(options);
  const worker = harness(await readFile(join(options.projectDir, 'public/sw.js'), 'utf8'), true);
  let installation;
  worker.listeners.get('install')({waitUntil(promise){installation=promise;}});
  await assert.rejects(installation, /Required asset unavailable/);
  assert.equal(worker.skipped,false);
}));
