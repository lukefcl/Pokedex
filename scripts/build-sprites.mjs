import sharp from 'sharp';
import gifenc from 'gifenc';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
const {GIFEncoder,quantize,applyPalette}=gifenc;
const width=128,height=96;
const catalogue=JSON.parse(await readFile('lib/species.json','utf8'));
const shellfish=new Set(catalogue.filter(e=>e.category==='Kaimoana').map(e=>e.slug));
await mkdir('public/sprites',{recursive:true});
const requested=new Set(process.argv.slice(2));
const files=(await readdir('.cache/sprite-masters')).filter(name=>name.endsWith('.png')&&(!requested.size||requested.has(name.slice(0,-4))));
for(const file of files){
  const slug=file.slice(0,-4);
  const scaled=await sharp('.cache/sprite-masters/'+file).trim().resize(112,80,{fit:'inside',kernel:'nearest'}).png().toBuffer();
  const {data}=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:scaled,gravity:'centre'}]).raw().toBuffer({resolveWithObject:true});
  // Explicit alpha threshold prevents semitransparent fringes on the LCD.
  for(let i=0;i<data.length;i+=4){if(data[i+3]<128)data.fill(0,i,i+4);else data[i+3]=255;}
  const palette=quantize(data,16,{format:'rgba4444',oneBitAlpha:true});
  let transparentIndex=palette.findIndex(c=>c[3]===0);
  if(transparentIndex<0){transparentIndex=palette.length;palette.push([0,0,0,0]);}
  const indexed=applyPalette(data,palette,'rgba4444');
  const rgba=new Uint8Array(width*height*4);
  for(let i=0;i<indexed.length;i++)rgba.set(palette[indexed[i]],i*4);
  await sharp(rgba,{raw:{width,height,channels:4}}).png({palette:true,colours:16}).toFile(`public/sprites/${slug}.png`);
  const gif=GIFEncoder();
  for(let frame=0;frame<8;frame++){
    const phase=frame/8*Math.PI*2;
    const next=new Uint8Array(width*height).fill(transparentIndex);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const tail=shellfish.has(slug)?0:Math.max(0,(x-68)/52);
      const sourceY=y-Math.round(Math.sin(phase)+(Math.sin(phase+tail*1.8)*tail*2));
      const sourceX=x-(shellfish.has(slug)?0:Math.round(Math.sin(phase)*1));
      if(sourceY>=0&&sourceY<height&&sourceX>=0&&sourceX<width)next[y*width+x]=indexed[sourceY*width+sourceX];
    }
    gif.writeFrame(next,width,height,{palette:frame===0?palette:undefined,transparent:true,transparentIndex,delay:160,dispose:2,repeat:0});
  }
  gif.finish();await writeFile(`public/sprites/${slug}.gif`,gif.bytes());
}
console.log(`Built ${files.length} AI sprite pairs: 128×96, 16 colours, 8-frame GIFs.`);
// Review sheet uses final pixels, not high-resolution masters.
const tileW=240,tileH=190,cols=6;
const overlays=[];
for(let i=0;i<files.length;i++){
  const slug=files[i].slice(0,-4),entry=catalogue.find(e=>e.slug===slug);
  overlays.push({input:await sharp(`public/sprites/${slug}.png`).resize(224,168,{kernel:'nearest'}).png().toBuffer(),left:i%cols*tileW+8,top:Math.floor(i/cols)*tileH});
  const label=(entry?.name||slug).replaceAll('&','&amp;');
  overlays.push({input:Buffer.from(`<svg width="240" height="22"><text x="120" y="16" text-anchor="middle" font-family="Arial" font-size="12" fill="#344b36">${label}</text></svg>`),left:i%cols*tileW,top:Math.floor(i/cols)*tileH+167});
}
await mkdir('test-results',{recursive:true});
await sharp({create:{width:cols*tileW,height:Math.ceil(files.length/cols)*tileH,channels:4,background:'#dce4c9'}}).composite(overlays).png().toFile('test-results/ai-sprites.png');
