import type { CatchRecord } from '../storage';
export type Recovery = { app: 'FINDEX Online'; version: 1; account: string; secret: string };
export function newRecovery(): Recovery {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error('Open FINDEX over HTTPS to join online.');
  const id = crypto.getRandomValues(new Uint8Array(16));
  const key = crypto.getRandomValues(new Uint8Array(32));
  return {
    app: 'FINDEX Online',
    version: 1,
    account: `findex-${Array.from(id, (b) => b.toString(16).padStart(2, '0')).join('')}@device.invalid`,
    secret: btoa(String.fromCharCode(...key))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, ''),
  };
}
export function parseRecovery(input: unknown): Recovery {
  const r = input as Recovery;
  if (
    !r ||
    r.app !== 'FINDEX Online' ||
    r.version !== 1 ||
    !/^findex-[a-f0-9]{32}@device\.invalid$/.test(r.account) ||
    !/^[A-Za-z0-9_-]{43}$/.test(r.secret)
  )
    throw new Error('Choose your FINDEX Online recovery file. A catch backup is a different file.');
  return { app: r.app, version: r.version, account: r.account, secret: r.secret };
}
export function inviteToken(value: string, origin: string) {
  try {
    const u = new URL(value.trim());
    if (u.origin !== origin || u.pathname !== '/') return null;
    const token = new URLSearchParams(u.hash.slice(1)).get('friend');
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}
export function sharedFields(r: CatchRecord) {
  return {
    localId: r.id,
    fishId: r.fishId,
    ...(r.customName ? { customName: r.customName } : {}),
    kind: r.kind || ('catch' as const),
    date: r.date,
    length: r.length,
    quantity: r.quantity || 1,
    released: r.released,
  };
}
export async function thumbnail(photo: Blob | null) {
  if (!photo) return undefined;
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Could not prepare the shared photo.');
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.7);
}
export type Job = { user: string; id: string; remove: boolean; historic: boolean; version: string; deleted?: boolean };
type Outbox = { owners: Record<string, string>; shares: Record<string, boolean>; jobs: Job[] };
const KEY = 'findex-online-outbox-v1';
export function readOutbox(): Outbox {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { owners: {}, shares: {}, jobs: [] };
  const value = JSON.parse(raw) as Outbox;
  if (!value.owners || !Array.isArray(value.jobs))
    throw new Error('Online queue needs attention. Your local journal is safe.');
  return { ...value, shares: value.shares || {} };
}
export function enqueue(user: string, id: string, share: boolean, historic = false) {
  const box = readOutbox();
  if (box.owners[id] && box.owners[id] !== user)
    throw new Error('This local record belongs to a different online profile.');
  box.owners[id] = user;
  box.shares[id] = share;
  box.jobs = box.jobs.filter((j) => j.user !== user || j.id !== id);
  box.jobs.push({ user, id, remove: !share, historic, version: `${Date.now()}-${Math.random()}` });
  localStorage.setItem(KEY, JSON.stringify(box));
  window.dispatchEvent(new Event('findex-outbox'));
}
export function finishJob(job: Job) {
  const box = readOutbox();
  box.jobs = box.jobs.filter((j) => j.version !== job.version);
  localStorage.setItem(KEY, JSON.stringify(box));
}
export function ownedBy(user: string, id: string) {
  return readOutbox().owners[id] === user;
}
export function canShare(user: string, id: string) {
  const owner = readOutbox().owners[id];
  return !owner || owner === user;
}
export function enqueueRemoval(id: string) {
  const box = readOutbox();
  const owner = box.owners[id];
  if (!owner) return;
  box.shares[id] = false;
  box.jobs = box.jobs.filter((j) => j.id !== id);
  box.jobs.push({ user: owner, id, remove: true, deleted: true, historic: true, version: `${Date.now()}-${Math.random()}` });
  localStorage.setItem(KEY, JSON.stringify(box));
  window.dispatchEvent(new Event('findex-outbox'));
}

// Upgrade previously private records and pick up guest logs when an account
// connects. Keep existing live-catch jobs intact so migration never creates alerts.
export function enqueueJournal(user: string, records: CatchRecord[]) {
  const box = readOutbox();
  let changed = false;
  const jobs = new Map(box.jobs.filter((j) => j.user === user).map((j) => [j.id, j]));
  for (const record of records) {
    if (box.owners[record.id] && box.owners[record.id] !== user) continue;
    const job = jobs.get(record.id);
    if (job?.deleted || (box.shares[record.id] && !job?.remove)) continue;
    box.owners[record.id] = user;
    box.shares[record.id] = true;
    jobs.set(record.id, { user, id: record.id, remove: false, historic: true, version: `${Date.now()}-${Math.random()}` });
    changed = true;
  }
  if (changed) {
    box.jobs = [...box.jobs.filter((j) => j.user !== user), ...jobs.values()];
    localStorage.setItem(KEY, JSON.stringify(box));
  }
}
