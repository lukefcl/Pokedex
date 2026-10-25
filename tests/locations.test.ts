import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentPosition, shouldCaptureCatchPosition, validPosition } from '../lib/catch-location';
import { fishingAreaAt } from '../lib/geo/fishing-area';
import { queuePosition, locationQueue, removePosition, finishPosition } from '../lib/hotspot-sync';
import { sharedFields } from '../lib/social/client';
import { validateBackup, type CatchRecord } from '../lib/storage';

const position = { latitude: -36.79, longitude: 174.91, accuracy: 10, capturedAt: 1700000000000 };
test('automatic GPS attempts apply to new catches, never sightings or historical catch edits', () => {
  assert.equal(shouldCaptureCatchPosition(false), true);
  assert.equal(shouldCaptureCatchPosition(true), false);
  assert.equal(shouldCaptureCatchPosition(false, 'sighting'), true);
  assert.equal(shouldCaptureCatchPosition(true, 'catch'), false);
  assert.equal(shouldCaptureCatchPosition(false, 'catch'), false);
});
test('coordinates survive backups but never enter mate sharing payloads', () => {
  const original = { id:'gps', fishId:'001', kind:'catch' as const, date:'2026-10-25', location:'Private name', length:'35', notes:'Private note', released:true, createdAt:'2026-10-25T00:00:00Z', photo:'data:image/jpeg;base64,/9j/2Q==', position };
  const [record] = validateBackup({version:2,catches:[original]});
  assert.deepEqual(record.position, position);
  assert.equal('position' in sharedFields(record), false);
  assert.equal('latitude' in sharedFields(record), false);
  for (const invalid of [{...position,latitude:91},{...position,longitude:-181},{...position,accuracy:-1},{...position,capturedAt:NaN},null]) {
    assert.equal(validPosition(invalid), false);
    assert.throws(() => validateBackup({version:2,catches:[{...original,position:invalid}]}));
  }
});
test('MPI polygons distinguish coasts and decline unsupported or uncertain readings', () => {
  assert.equal(fishingAreaAt(position).areaId,'auckland-east');
  assert.equal(fishingAreaAt({...position,latitude:-36.99,longitude:174.35}).areaId,'auckland-west');
  assert.equal(fishingAreaAt({...position,latitude:-39.2,longitude:173.7}).areaId,'central-west');
  assert.equal(fishingAreaAt({...position,latitude:-41.36,longitude:175.3}).areaId,'central-east');
  assert.equal(fishingAreaAt({...position,latitude:0,longitude:0}).areaId,'');
  assert.equal(fishingAreaAt({...position,accuracy:100000}).areaId,'');
  assert.equal(fishingAreaAt({...position,latitude:-41.2,longitude:173.2}).areaId,'');
});
test('GPS requests a fresh one-off reading, reports denial, and requires a secure context', async () => {
  const secure = Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');
  const nav = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{geolocation:{getCurrentPosition(ok:Function,_:Function,options:unknown){assert.deepEqual(options,{enableHighAccuracy:true,maximumAge:0,timeout:20000});ok({coords:position,timestamp:position.capturedAt});}}},configurable:true});
  try {
    assert.deepEqual(await currentPosition(),position);
    Object.defineProperty(globalThis,'navigator',{value:{geolocation:{getCurrentPosition(_:Function,fail:Function){fail({code:1});}}},configurable:true});
    await assert.rejects(currentPosition(),/Allow location/);
    Object.defineProperty(globalThis,'isSecureContext',{value:false,configurable:true});
    await assert.rejects(currentPosition(),/HTTPS/);
  } finally {
    if(secure)Object.defineProperty(globalThis,'isSecureContext',secure);else Reflect.deleteProperty(globalThis,'isSecureContext');
    if(nav)Object.defineProperty(globalThis,'navigator',nav);else Reflect.deleteProperty(globalThis,'navigator');
  }
});
test('location outbox scopes ownership, preserves newer edits, and removes changed/deleted catches', () => {
  const store = new Map<string,string>();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>store.get(k)||null,setItem:(k:string,v:string)=>store.set(k,v)},configurable:true});
  Object.defineProperty(globalThis,'window',{value:{dispatchEvent:()=>{}},configurable:true});
  const record = {id:'gps',fishId:'001',position,kind:'catch'} as CatchRecord;
  try {
    queuePosition('alice',record);
    const original = locationQueue().jobs[0];
    queuePosition('bob',record);
    assert.equal(locationQueue().jobs[0].user,'alice');
    queuePosition('alice',record);
    finishPosition(original);
    assert.equal(locationQueue().jobs.length,1);
    queuePosition('alice',{...record,kind:'sighting'});
    assert.equal(locationQueue().jobs[0].remove,true);
    queuePosition('alice',record);
    removePosition(record.id);
    assert.equal(locationQueue().jobs[0].remove,true);
  } finally {
    if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});
