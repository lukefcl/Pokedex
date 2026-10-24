import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createCatchId } from '../lib/catch-id';
import { saveCatch, getCatches, deleteCatch, type CatchRecord } from '../lib/storage';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('uses native UUID support with its crypto receiver intact', () => {
  const source = { randomUUID() { assert.equal(this, source); return '00112233-4455-4677-8899-aabbccddeeff' as const; } };
  assert.equal(createCatchId(source), '00112233-4455-4677-8899-aabbccddeeff');
});
test('generates distinct v4 UUIDs when randomUUID is missing, as on HTTP mobile previews', () => {
  const source = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  const ids = Array.from({length:1000}, () => createCatchId(source));
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach(id => assert.match(id, uuidV4));
});
test('local fallback stays unique when the crypto object is missing', () => {
  const ids = Array.from({length:1000}, () => createCatchId(null));
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach(id => { assert.ok(id.length > 0 && id.length < 100); });
});
test('photo catches persist and coexist when randomUUID is unavailable', async () => {
  const source = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
  const first: CatchRecord = { id:createCatchId(source), fishId:'001', date:'2026-10-24', location:'Compatibility test', length:'35', notes:'', released:true, photo:new Blob(['test photo'], {type:'image/jpeg'}), createdAt:'2026-10-24T00:00:00Z' };
  const second = {...first, id:createCatchId(source)};
  try {
    await saveCatch(first); await saveCatch(second);
    const records = await getCatches();
    const saved = records.filter(record => [first.id,second.id].includes(record.id));
    assert.equal(saved.length,2);
    assert.equal(saved[0].photo.size,first.photo.size);
  } finally { await deleteCatch(first.id); await deleteCatch(second.id); }
});
