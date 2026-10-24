/** Offline reference checked against Fisheries New Zealand on 24 October 2026.
 * Regional tables are summaries. Local closures, bylaws, gear and possession rules prevail.
 * Sources are linked per area. Never interpret a missing individual limit as unlimited.
 */
export const RULES_CHECKED = '2026-10-24';
const root = 'https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/';
export type RuleRegion = 'auckland'|'central'|'challenger'|'southeast'|'southland'|'fiordland';
export type FishingArea = { id:string; label:string; region:RuleRegion; combined:number; snapper:number|null; snapperSize:number|null; cod:number; boundary:string; note?:string };
export const areas: FishingArea[] = [
  { id:'auckland-east',label:'Auckland / Northland · East',region:'auckland',combined:20,snapper:7,snapperSize:30,cod:20,boundary:'North Cape to Cape Runaway (SNA1), including the Hauraki Gulf and Bay of Plenty.' },
  { id:'auckland-west',label:'Auckland / Northland · West',region:'auckland',combined:20,snapper:10,snapperSize:27,cod:20,boundary:'North Cape to Tirua Point on the west coast.' },
  { id:'central-west',label:'Central · Taranaki to Titahi Bay',region:'central',combined:20,snapper:10,snapperSize:27,cod:2,boundary:'Central (Egmont), FMA8. Confirm exact boundaries on the MPI map.' },
  { id:'central-east',label:'Central · Titahi Bay to East Cape',region:'central',combined:20,snapper:10,snapperSize:27,cod:20,boundary:'Titahi Bay to Cape Runaway, FMA2. Titahi boundary: near Terrace Road lookout.' },
  { id:'challenger-tasman',label:'Challenger · Tasman',region:'challenger',combined:20,snapper:10,snapperSize:25,cod:2,boundary:'Farewell Spit to Clarence River; choose Marlborough Sounds separately.' },
  { id:'marlborough',label:'Challenger · Marlborough Sounds',region:'challenger',combined:20,snapper:3,snapperSize:25,cod:2,boundary:'Marlborough Sounds management area. Check the MPI boundary map.',note:'Blue cod closed 1 September–10 January inclusive each year.' },
  { id:'kahurangi',label:'Challenger · Kahurangi',region:'challenger',combined:20,snapper:10,snapperSize:25,cod:10,boundary:'Heaphy River to Farewell Spit.' },
  { id:'westland',label:'Challenger · Westland',region:'challenger',combined:20,snapper:10,snapperSize:25,cod:15,boundary:'South bank of Haast River to Heaphy River, outside reduced-limit mātaitai.' },
  { id:'southwest',label:'Challenger · South West',region:'challenger',combined:20,snapper:10,snapperSize:25,cod:10,boundary:'Haast River south to Awarua Point. Use Fiordland for its separate marine area.' },
  { id:'challenger-mataitai',label:'Challenger · Haast mātaitai',region:'challenger',combined:10,snapper:5,snapperSize:25,cod:5,boundary:'Paringa, Popotai/Taumaka, Ōkahu/Jacksons Bay and Tauneke/Barn Bay only.',note:'Vessel caps: 30 finfish total, including at most 15 blue cod. Individual limits also apply.' },
  { id:'canterbury',label:'South-East · Canterbury',region:'southeast',combined:30,snapper:10,snapperSize:25,cod:2,boundary:'Hurunui River to Rakaia River, excluding local reduced-limit or closed areas.',note:'Lyttelton/Whakaraupō has closures; Akaroa has lower species and combined limits. Check before fishing there.' },
  { id:'north-otago',label:'South-East · North Otago',region:'southeast',combined:30,snapper:10,snapperSize:25,cod:10,boundary:'Rakaia River to Taiaroa Head, excluding local taiāpure restrictions.',note:'East Otago Taiāpure blue cod: 2/day. Other local restrictions apply.' },
  { id:'south-east-southern',label:'South-East · Southern',region:'southeast',combined:30,snapper:10,snapperSize:25,cod:10,boundary:'Taiaroa Head to Slope Point, excluding local taiāpure restrictions.' },
  { id:'southland',label:'Southland · general waters',region:'southland',combined:30,snapper:null,snapperSize:25,cod:10,boundary:'Southland waters outside Fiordland, Paterson Inlet and other special areas.',note:'Paterson Inlet has a reduced combined limit and separate bylaws. Choose its MPI rules before fishing there.' },
  { id:'fiordland-outer',label:'Fiordland · outside the fiords',region:'fiordland',combined:20,snapper:5,snapperSize:null,cod:10,boundary:'Fiordland Marine Area outside fiord coastal waters, excluding reserves.',note:'No accumulation beyond one daily finfish entitlement. Catches inside and outside the fiords count together.' },
  { id:'fiordland-fiords',label:'Fiordland · the fiords',region:'fiordland',combined:10,snapper:5,snapperSize:null,cod:1,boundary:'Fiord coastal waters, excluding Internal Waters closures and marine reserves.',note:'No accumulation. Hāpuku/bass is closed in Internal Waters; Milford Sound Internal Waters is closed to blue cod.' },
  { id:'fiordland-internal',label:'Fiordland · Internal Waters',region:'fiordland',combined:10,snapper:5,snapperSize:null,cod:1,boundary:'Defined Internal Waters, excluding marine reserves and Milford blue cod closure.',note:'No accumulation. No taking hāpuku/bass. Milford Sound Internal Waters is closed to blue cod.' },
  { id:'milford',label:'Fiordland · Milford Internal Waters',region:'fiordland',combined:10,snapper:5,snapperSize:null,cod:0,boundary:'Piopiotahi/Milford Sound Internal Waters, outside no-take marine reserves.',note:'No taking blue cod or hāpuku/bass. No accumulation. Marine reserves are closed to all fishing.' },
];
export const areaById = (id:string) => areas.find(area => area.id === id);
export const sourceFor = (area:FishingArea) => root + ({auckland:'auckland-kermadec-fishing-rules',central:'central-fishing-rules',challenger:'challenger-fishing-rules',southeast:'south-east-fishing-rules',southland:'southland-fishing-rules',fiordland:'fiordland-marine-area-fishing-rules'}[area.region]);
export type FishRule = { minCm:number|null; daily:number|null; combined:number; shared:'finfish'|'baitfish'|'other'; notes:string[]; closed:boolean };
const minimums:Record<string,number|null> = { '001':30,'002':null,'003':75,'004':33,'005':25,'006':25,'007':25,'008':null,'009':40,'010':null,'011':35,'012':null,'013':25,'014':25,'015':null,'016':null,'017':null,'018':35 };
export function getRule(fishId:string, areaId:string, date = new Date()): FishRule|null {
  const area = areaById(areaId); if (!area || !(fishId in minimums)) return null;
  const notes:string[] = [];
  let minCm = minimums[fishId], daily:number|null = null;
  let shared:FishRule['shared'] = 'finfish', combined = area.combined;
  const south = ['southeast','southland'].includes(area.region);
  if (south) daily = ({'002':15,'005':15,'009':15,'011':15,'012':5,'014':10,'017':15,'018':15} as Record<string,number>)[fishId] ?? null;
  if (fishId === '001') { minCm = area.snapperSize; daily = area.snapper; }
  if (fishId === '003') { daily = area.id === 'challenger-mataitai' ? 1 : 3; if (south) notes.push('Hāpuku/bass and kingfish share a limit of 5, including no more than 3 kingfish.'); }
  if (fishId === '010') {
    daily = south ? 5 : area.id === 'challenger-mataitai' ? 1 : 2;
    notes.push(south ? 'Hāpuku/bass and kingfish: 5 combined, with no more than 3 kingfish.' : 'Hāpuku and bass share this daily limit. Maximum 3 accumulated over more than one day.');
  }
  if (fishId === '004') {
    minCm = area.region === 'auckland' ? 30 : 33; daily = area.cod;
    notes.push('Whole-fish minimum shown. Land whole or gutted; headed fish are permitted only in specified zones with separate measuring rules. Check MPI.');
    if (area.id === 'marlborough') notes.push('Seasonal closure: 1 September to 10 January inclusive. Outside the closure: 2/day; possession rules apply.');
    if (area.id === 'north-otago') notes.push('East Otago Taiāpure: 2/day.');
  }
  if (area.region === 'fiordland') {
    const inner = area.id !== 'fiordland-outer';
    const outer:Record<string,number> = {'001':5,'002':5,'003':3,'004':10,'005':10,'006':5,'007':5,'008':10,'009':5,'010':3,'011':4,'012':2,'013':5,'014':5,'016':10,'017':5,'018':5};
    const fiords:Record<string,number> = {'001':5,'002':1,'003':3,'004':1,'005':1,'006':1,'007':2,'008':4,'009':1,'010':1,'011':2,'012':2,'013':2,'014':2,'016':3,'017':1,'018':1};
    daily = (inner ? fiords : outer)[fishId] ?? null;
    notes.length = 0;
    if (fishId === '008') { shared = 'other'; combined = inner ? 4 : 10; notes.push('This is a shared total for finfish without a named species limit, within the overall finfish total.'); }
    if (fishId === '004') { daily = area.cod; notes.push('Land whole or gutted. No taking blue cod in Milford Sound Internal Waters.'); }
    if (fishId === '010') { if (['fiordland-internal','milford'].includes(area.id)) daily = 0; notes.push('Hāpuku/bass share this limit. No taking in Internal Waters.'); }
    notes.push('No accumulation beyond one daily finfish entitlement.');
  }
  if (fishId === '015') { daily = null; shared = 'baitfish'; combined = 50; notes.push('Shared total across specified baitfish; additional to the finfish total.'); }
  if (area.note) notes.push(area.note);
  const month = date.getMonth()+1, day = date.getDate();
  const seasonalClosed = fishId === '004' && area.id === 'marlborough' && (month >= 9 || (month === 1 && day <= 10));
  return { minCm, daily:seasonalClosed ? 0 : daily, combined, shared, notes, closed:seasonalClosed || daily === 0 };
}
export const sizeLabel = (rule:FishRule) => rule.minCm === null ? 'No set minimum' : `${rule.minCm} cm`;
export const bagLabel = (rule:FishRule) => rule.closed ? 'Closed' : rule.daily === null || rule.shared === 'other' ? `${rule.combined} shared` : `${rule.daily} / day`;
