import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import sharp from 'sharp';
import {fish,findFish,catchName,recordKind,recordOutcome,searchText} from '../lib/fish';

test('expanded catalogue keeps original catch identities and all source entries',async()=>{
  assert.equal(fish.length,85);
  assert.equal(new Set(fish.map(e=>e.id)).size,85);
  assert.equal(new Set(fish.map(e=>e.slug)).size,85);
  assert.equal(fish.filter(e=>e.sourceUrl.startsWith('https://www.fishspecies.nz/')).length,58);
  const original=['Snapper','Kahawai','Yellowtail kingfish','Blue cod','Tarakihi','Trevally','Red gurnard','John dory','Blue moki','Hāpuku','Butterfish','Rig','Yellowbelly flounder','Red cod','Jack mackerel','Albacore tuna','Blue warehou','Trumpeter'];
  original.forEach((name,index)=>assert.equal(findFish(String(index+1).padStart(3,'0'))?.name,name));
  for(const e of fish){assert.ok(e.description&&e.funFact&&e.clue&&e.scientific);assert.ok(!e.maori.includes('('));}
  for(const category of ['Freshwater','Kaimoana','Sharks & rays'])assert.ok(fish.some(e=>e.category===category));
  assert.equal(catchName({fishId:'other',customName:'My mystery fish'}),'My mystery fish');
  assert.equal(findFish('999'),undefined);
});

test('each catalogue entry has distinct transparent pixel artwork and a valid looping GIF',async()=>{
  const slugs=[...fish.map(e=>e.slug),'unidentified'];
  const hashes=new Set<string>();let total=0;
  for(const slug of slugs){
    const png=await readFile(`public/sprites/${slug}.png`),gif=await readFile(`public/sprites/${slug}.gif`);
    total+=png.length+gif.length;hashes.add(png.toString('base64'));
    const still=await sharp(png).metadata();assert.equal(still.width,128);assert.equal(still.height,96);assert.equal(still.hasAlpha,true);
    const animation=await sharp(gif,{animated:true}).metadata();assert.equal(animation.width,128);assert.equal(animation.pageHeight,96);assert.equal(animation.pages,8);assert.equal(animation.loop,0);assert.ok(animation.delay?.every(delay=>delay===160));
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let transparent=0,opaque=0;const colours=new Set<string>();
    for(let i=0;i<data.length;i+=info.channels){if(data[i+3]===0)transparent++;else{opaque++;colours.add(`${data[i]},${data[i+1]},${data[i+2]}`);}}
    assert.ok(transparent>opaque*.1,slug+' needs a transparent margin');assert.ok(opaque>100,slug+' needs visible artwork');assert.ok(colours.size<=16,slug+' palette exceeds pixel-art budget');
    const frames=await sharp(gif,{animated:true}).ensureAlpha().raw().toBuffer();
    const frameSize=128*96*4;assert.notDeepEqual(frames.subarray(0,frameSize),frames.subarray(frameSize*2,frameSize*3),slug+' has no animation');
  }
  assert.equal(hashes.size,86,'Species must not share a generic template image');
  assert.ok(total<3*1024*1024,'Offline artwork should stay below 3MB');
  assert.equal((await readdir('public/sprites')).length,172);
});

test('marine mammals are sightings only and never have kept or released outcomes',()=>{
 const mammals=fish.filter(e=>e.category==='Marine mammals');assert.equal(mammals.length,11);
 for(const e of mammals){assert.equal(e.sightingOnly,true);for(const released of [false,true])assert.equal(recordOutcome({fishId:e.id,released}),'Spotted');}
 assert.equal(recordKind({fishId:'001'}),'catch');assert.equal(recordOutcome({fishId:'001',released:false}),'Kept');
 assert.equal(recordOutcome({fishId:'001',kind:'sighting',released:false}),'Spotted');
 assert.equal(searchText('Kōheru Māui'),'koheru maui');
 for(const name of ['Arrow squid','Common octopus','Mahi-mahi','Rainbow trout','Striped marlin'])assert.ok(fish.some(e=>e.name===name&&!e.sightingOnly));
});
