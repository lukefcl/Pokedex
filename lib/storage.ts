import { findFish } from './fish';
import { areaById } from './rules';

export type CatchRecord = { id: string; fishId: string; date: string; location: string; length: string; notes: string; released: boolean; photo: Blob; createdAt: string; areaId?: string };
export type BackupCatch = Omit<CatchRecord, 'photo'> & { photo: string };
const DB_NAME = 'findex-device';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Local storage is unavailable in this browser.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('catches', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open your local catch journal.'));
    request.onblocked = () => reject(new Error('Close other FINDEX tabs and try again.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('catches', mode);
    let value: T | undefined;
    const request = operation(transaction.objectStore('catches'));
    if (request) request.onsuccess = () => { value = request.result; };
    transaction.oncomplete = () => { db.close(); resolve(value); };
    transaction.onerror = () => { db.close(); reject(new Error('Your device could not save this change. Free some storage and try again.')); };
    transaction.onabort = () => { db.close(); reject(new Error('The storage change was cancelled. Please try again.')); };
  });
}
export async function getCatches(): Promise<CatchRecord[]> {
  const all = await transact('readonly', (store) => store.getAll());
  return (all as CatchRecord[]).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
export async function saveCatch(record: CatchRecord) { await transact('readwrite', (store) => store.put(record)); }
export async function deleteCatch(id: string) { await transact('readwrite', (store) => store.delete(id)); }
export async function importCatches(records: CatchRecord[]) {
  await transact('readwrite', (store) => { records.forEach((record) => store.put(record)); });
}
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this photo.')); reader.readAsDataURL(blob); });
}
export async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Please choose a JPEG, PNG or WebP photo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Please choose a photo smaller than 20 MB.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This photo could not be opened. Try another JPEG or PNG.'); });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('This device could not process the photo.'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return new Promise((resolve,reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not prepare this photo.')), 'image/jpeg', .85));
}
export function validateBackup(input: unknown): CatchRecord[] {
  if (!input || typeof input !== 'object' || !('version' in input) || input.version !== 1 || !('catches' in input) || !Array.isArray(input.catches)) throw new Error('This is not a FINDEX v1 backup.');
  if (input.catches.length > 5000) throw new Error('A backup can contain at most 5,000 catches.');
  const seen = new Set<string>();
  return input.catches.map((record: unknown) => {
    if (!record || typeof record !== 'object') throw new Error('The backup contains an invalid catch.');
    const r = record as BackupCatch;
    if (typeof r.id !== 'string' || !r.id || r.id.length > 100 || seen.has(r.id) || !findFish(r.fishId) || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date || typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt)) || typeof r.released !== 'boolean' || typeof r.location !== 'string' || r.location.length > 120 || typeof r.notes !== 'string' || r.notes.length > 1000 || typeof r.length !== 'string' || (r.length !== '' && (!Number.isFinite(Number(r.length)) || Number(r.length) <= 0 || Number(r.length) > 1000)) || typeof r.photo !== 'string' || r.photo.length > 8_000_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(r.photo)) throw new Error('The backup contains an invalid catch or photo.');
    seen.add(r.id);
    if (r.areaId !== undefined && (typeof r.areaId !== 'string' || (r.areaId !== '' && !areaById(r.areaId)))) throw new Error('The backup contains an unknown fishing area.');
    const [header, data] = r.photo.split(',');
    let binary: string; try { binary = atob(data); } catch { throw new Error('The backup contains an unreadable photo.'); }
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { id:r.id, fishId:r.fishId, date:r.date, location:r.location, length:r.length, notes:r.notes, released:r.released, createdAt:r.createdAt, ...(r.areaId ? {areaId:r.areaId} : {}), photo:new Blob([bytes], { type: header.match(/data:(.*);/)![1] }) };
  });
}
