import { load } from 'cheerio';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin='https://www.fishspecies.nz';
const cacheDir='.cache/species-source';
await mkdir(cacheDir,{recursive:true});
async function getPage(path){
  const file=join(cacheDir,path.replaceAll('/','')||'home')+'.html';
  try{return await readFile(file,'utf8');}catch{
    const response=await fetch(origin+path);
    if(!response.ok)throw new Error(`Source returned ${response.status}: ${path}`);
    const html=await response.text();await writeFile(file,html);return html;
  }
}
const $home=load(await getPage('/'));
const cards=$home('[data-species-grid] a.fs-card').toArray();
const entries=cards.map(card=>{
  const $c=$home(card);
  return {slug:$c.attr('href').replaceAll('/',''),sourceUrl:origin+$c.attr('href'),name:$c.find('.fs-card__name').text().trim(),scientific:$c.find('.fs-card__sci').text().trim(),imageUrl:new URL($c.find('img').attr('src'),origin).href};
});
if(entries.length<40)throw new Error('Species index unexpectedly incomplete.');
let next=0;
async function worker(){while(next<entries.length){
  const entry=entries[next++];
  const $=load(await getPage('/'+entry.slug+'/'));
  const main=$('main');
  const scientific=main.find('.fs-sci').first().clone();scientific.find('.former').remove();
  entry.scientific=scientific.text().trim()||entry.scientific;
  entry.maori=main.find('.reo').first().text().trim();
  entry.aliases=main.find('.aka').first().text().replace(/^Also known as /,'').trim();
  entry.tags=main.find('.species-tags li').map((_,el)=>$(el).text().trim()).get();
  entry.summary=main.find('.species-summary').first().text().trim();
  entry.identification=main.find('.id-features li').slice(0,3).map((_,el)=>$(el).text().trim()).get();
  entry.facts=main.find('#h-notes').parent().find('p,li').map((_,el)=>$(el).text().trim()).get();
  entry.headings=main.find('h2,h3').map((_,el)=>$(el).text().trim()).get();
  entry.where=main.find('#where>p').first().text().trim();
  entry.credit=main.find('.photo-credit,.species-plate figcaption,.photo-credits,.image-credit,[class*=credit]').map((_,el)=>$(el).text().trim()).get().join(' · ');
  entry.creditLinks=main.find('[class*=credit] a').map((_,el)=>({text:$(el).text().trim(),url:$(el).attr('href')})).get();
  entry.glance={};main.find('.glance__facts>div').each((_,el)=>{entry.glance[$(el).find('dt').text().trim()]=$(el).find('dd').text().trim();});
  entry.sourceImageUrl=new URL(main.find('.species-hero__plate img').first().attr('src')||entry.imageUrl,origin).href;
  const imagePath=join(cacheDir,entry.slug+'.webp');
  try{await readFile(imagePath);}catch{const response=await fetch(entry.sourceImageUrl);if(!response.ok)throw new Error(`Image unavailable: ${entry.slug}`);await writeFile(imagePath,Buffer.from(await response.arrayBuffer()));}
  console.log(`Imported ${entry.slug}`);
}}
await Promise.all([worker(),worker(),worker()]);
await writeFile(join(cacheDir,'catalogue-source.json'),JSON.stringify({source:origin,checked:'2026-10-25',entries},null,2));
console.log(`Read ${entries.length} species and their reference images.`);
