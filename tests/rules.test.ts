import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areas, getRule, bagLabel, sourceFor} from '../lib/rules';
import {fish} from '../lib/fish';

test('Auckland east and west snapper limits remain distinct',()=>{
  const east=getRule('001','auckland-east')!,west=getRule('001','auckland-west')!;
  assert.equal(east.minCm,30);assert.equal(east.daily,7);
  assert.equal(west.minCm,27);assert.equal(west.daily,10);
  assert.equal(east.combined,20);
});
test('Central blue cod is 2 in FMA8 and 20 in FMA2, with a 33cm minimum',()=>{
  assert.equal(getRule('004','central-west')!.daily,2);
  assert.equal(getRule('004','central-east')!.daily,20);
  assert.equal(getRule('004','central-west')!.minCm,33);
});
test('Marlborough blue cod closure handles both year boundaries inclusively',()=>{
  for(const date of ['2026-09-01','2026-10-24','2026-12-31','2027-01-01','2027-01-10']){
    const rule=getRule('004','marlborough',new Date(`${date}T12:00:00`))!;
    assert.equal(rule.closed,true,date);assert.equal(rule.daily,0,date);
  }
  for(const date of ['2026-01-11','2026-08-31'])assert.equal(getRule('004','marlborough',new Date(`${date}T12:00:00`))!.daily,2,date);
});
test('shared totals are explicit and baitfish are separate from finfish',()=>{
  const kahawai=getRule('002','auckland-east')!,baitfish=getRule('015','auckland-east')!;
  assert.equal(kahawai.daily,null);assert.equal(bagLabel(kahawai),'20 shared');
  assert.equal(baitfish.shared,'baitfish');assert.equal(baitfish.combined,50);
  assert.equal(getRule('008','fiordland-fiords')!.shared,'other');
  assert.equal(getRule('008','fiordland-fiords')!.combined,4);
});
test('special areas have reduced caps, species closures and shared group notes',()=>{
  assert.equal(getRule('004','challenger-mataitai')!.daily,5);
  assert.equal(getRule('003','challenger-mataitai')!.daily,1);
  assert.equal(getRule('004','fiordland-outer')!.daily,10);
  assert.equal(getRule('004','fiordland-fiords')!.daily,1);
  assert.equal(getRule('004','milford')!.closed,true);
  assert.equal(getRule('010','fiordland-internal')!.closed,true);
  assert.equal(getRule('005','southland')!.daily,15);
  assert.match(getRule('010','southland')!.notes.join(' '),/kingfish/);
});
test('every supported fish and area has a bounded, sourced rule; unknown areas are not guessed',()=>{
  for(const area of areas){assert.match(sourceFor(area),/^https:\/\/www\.mpi\.govt\.nz\//);for(const entry of fish.filter(entry=>Number(entry.id)<=18)){const rule=getRule(entry.id,area.id)!;assert.ok(rule);assert.ok(rule.daily===null||rule.daily>=0);assert.ok(rule.minCm===null||rule.minCm>0);assert.ok(rule.combined>0);}}
  assert.equal(getRule('001',''),null);assert.equal(getRule('001','kaikoura'),null);assert.equal(getRule('unknown','auckland-east'),null);
});

test('new catalogue entries do not inherit unverified finfish allowances',()=>{
 for(const entry of fish.filter(entry=>Number(entry.id)>18))for(const area of areas)assert.equal(getRule(entry.id,area.id),null,entry.name);
});
