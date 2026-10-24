import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteCatch, getCatches, importCatches, saveCatch, validateBackup, type CatchRecord } from '../lib/storage';

const sample = { id:'catch-1', fishId:'001', date:'2026-10-23', location:'Hauraki Gulf', length:'35', notes:'Released.', released:true, createdAt:'2026-10-23T00:00:00.000Z', photo:'data:image/jpeg;base64,/9j/2Q==' };
test('backup preserves catch metadata and reconstructs local photo blobs', () => {
  const [record] = validateBackup({version:1,catches:[sample]});
  assert.equal(record.photo.type,'image/jpeg');
  assert.equal(record.photo.size,4);
  assert.equal(record.location,sample.location);
  assert.equal(record.released,true);
});
test('fishing areas survive backup and old backups without areas remain valid',()=>{
  const [withArea]=validateBackup({version:1,catches:[{...sample,areaId:'auckland-east'}]});
  assert.equal(withArea.areaId,'auckland-east');
  assert.equal(validateBackup({version:1,catches:[sample]})[0].areaId,undefined);
  assert.throws(()=>validateBackup({version:1,catches:[{...sample,areaId:'unknown-region'}]}));
});
test('reject malformed backups, unknown species, duplicate IDs, invalid dates and non-image data', () => {
  for (const input of [null,{}, {version:2,catches:[]}, {version:1,catches:[{...sample,fishId:'999'}]}, {version:1,catches:[sample,sample]}, {version:1,catches:[{...sample,date:'2026-02-31'}]}, {version:1,catches:[{...sample,photo:'data:text/html;base64,AAAA'}]}, {version:1,catches:[{...sample,length:'-4'}]}]) assert.throws(() => validateBackup(input));
});
test('catch journal persists photos, sorts records, merges backups and deletes atomically', async () => {
  const [record] = validateBackup({version:1,catches:[sample]});
  await saveCatch(record);
  let records = await getCatches();
  assert.equal(records.length,1);
  assert.equal(records[0].photo.size,4);
  const second:CatchRecord = {...record,id:'catch-2',date:'2026-10-24',fishId:'002'};
  await importCatches([{...record,notes:'Updated in backup'},second]);
  records = await getCatches();
  assert.equal(records.length,2);
  assert.equal(records[0].id,'catch-2');
  assert.equal(records[1].notes,'Updated in backup');
  await deleteCatch('catch-1');
  records = await getCatches();
  assert.equal(records.length,1);
  assert.equal(records[0].fishId,'002');
  await deleteCatch('catch-2');
});
