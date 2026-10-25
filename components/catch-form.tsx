'use client';
import {useRef,useState,type FormEvent} from 'react';
import {Camera,ImagePlus,Upload,Waves,Info,Check,ShieldCheck,Ruler,Eye} from 'lucide-react';
import {fish,findFish,unidentified,recordKind,type Fish,type RecordKind} from '@/lib/fish';
import {preparePhoto,type CatchRecord} from '@/lib/storage';
import {createCatchId} from '@/lib/catch-id';
import {areas,getRule,sizeLabel,bagLabel} from '@/lib/rules';
import {Dialog,CatchPhoto,today} from './screen-ui';
import SpeciesGuidance from './species-guidance';
import {useSocial} from './social/provider';
import SpeciesScanner from './scanner/species-scanner';
import {ScanLine} from 'lucide-react';
import { useCatchPosition } from './use-catch-position';

type Props={selected:Fish;initial?:CatchRecord;scannedPhoto?:Blob|null;mode?:RecordKind;areaId:string;close:()=>void;onSave:(record:CatchRecord)=>Promise<void>};
export default function CatchForm({selected,areaId,close,onSave,initial,mode,scannedPhoto}:Props){
  const social=useSocial();
  const [fishId,setFishId]=useState(initial?.fishId||selected.id);
  const [kind,setKind]=useState<RecordKind>(initial?recordKind(initial):mode||(selected.sightingOnly?'sighting':'catch'));
  const [customName,setCustomName]=useState(initial?.customName||'');
  const [quantity,setQuantity]=useState(String(initial?.quantity||1));
  const entry=findFish(fishId)||unidentified;
  const sighting=entry.sightingOnly||kind==='sighting';
  const [catchArea,setCatchArea]=useState(initial?.areaId||areaId);
  const [date,setDate]=useState(initial?.date||today());
  const [location,setLocation]=useState(initial?.location||'');
  const {position,areaNote}=useCatchPosition(initial,sighting,setCatchArea);
  const [length,setLength]=useState(initial?.length||'');
  const [notes,setNotes]=useState(initial?.notes||'');
  const [released,setReleased]=useState(initial?.released??true);
  const [photo,setPhoto]=useState<Blob|null>(initial?initial.photo:scannedPhoto||null);
  const [scannerOpen,setScannerOpen]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const uploadRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null);
  const rule=sighting?null:getRule(fishId,catchArea);
  async function choosePhoto(file?:File){
    if(!file)return;setProcessing(true);setError('');
    try{setPhoto(await preparePhoto(file));}catch(error){setError(error instanceof Error?error.message:'Could not read this photo.');}finally{setProcessing(false);if(uploadRef.current)uploadRef.current.value='';if(cameraRef.current)cameraRef.current.value='';}
  }
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    if(fishId==='other'&&!customName.trim()){setError('Give this record a name, even if it is just Unknown fish.');return;}
    if(!photo&&!sighting){setError('Add a photo of your catch to confirm it.');return;}
    if(!date||date>today()){setError('Choose today or an earlier record date.');return;}
    setSaving(true);
    try{
      await onSave({id:initial?.id||createCatchId(),fishId,kind:sighting?'sighting':'catch',date,location:location.trim(),...(position?{position}:{}),length:sighting?'':length,notes:notes.trim(),released:sighting?false:entry.protected||released,photo,quantity:sighting?Number(quantity):initial&&recordKind(initial)==='catch'?initial.quantity||1:1,...(fishId==='other'?{customName:customName.trim()}:{}),createdAt:initial?.createdAt||new Date().toISOString(),areaId:sighting?'':catchArea});
      if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
    }catch(error){setError(error instanceof Error?error.message:'Could not save your record.');setSaving(false);}
  }
  if(scannerOpen)return <Dialog title="SPECIES SCANNER" close={()=>setScannerOpen(false)}><SpeciesScanner photo={photo} onBack={()=>setScannerOpen(false)} onSelect={(identified,image)=>{setFishId(identified.id);setPhoto(image);if(identified.id==='other'&&!customName.trim())setCustomName('Unknown fish');if(identified.sightingOnly)setKind('sighting');if(identified.protected)setReleased(true);setScannerOpen(false);}}/></Dialog>;
  return <Dialog title={initial?'EDIT RECORD':sighting?'LOG A SIGHTING':'LOG A CATCH'} close={()=>{if(!saving&&!processing)close();}}><form className="dialog-content catch-form" onSubmit={submit}>
    <span className="eyebrow">ONE MORE STORY FOR THE COLLECTION</span>
    <h2>{initial?'Update your memory.':sighting?'A moment in the wild.':'A catch to remember.'}</h2>
    <p className="form-intro">{sighting?'Record what you spotted, where and how many. A photo is optional.':'Save any catch, including shellfish or something you will identify later. A photo confirms your record.'}</p>
    <button type="button" className="secondary-button full-width catch-scan-button" disabled={saving||processing} onClick={()=>setScannerOpen(true)}><ScanLine size={17}/>{photo?'Identify my photo':'Scan to suggest a species'}</button>
    <fieldset disabled={saving||processing}>
      <label className="form-label">Record type<select aria-label="Record type" value={sighting?'sighting':'catch'} onChange={event=>setKind(event.target.value as RecordKind)}><option value="catch" disabled={entry.sightingOnly}>Catch</option><option value="sighting">Sighting</option></select></label>
      <label className="form-label">Species<select aria-label="Species" value={fishId} onChange={event=>{setFishId(event.target.value);const next=findFish(event.target.value);if(next?.sightingOnly)setKind('sighting');if(next?.protected)setReleased(true);}}><option value="other">Other / identify later</option>{fish.map(entry=><option key={entry.id} value={entry.id}>#{entry.id} · {entry.name}{entry.maori?` / ${entry.maori}`:''}{entry.sightingOnly?' · sightings only':''}</option>)}</select></label>
      {fishId==='other'&&<label className="form-label">Your name for this record<input required maxLength={120} value={customName} placeholder="e.g. Unknown reef fish" onChange={event=>setCustomName(event.target.value)}/></label>}
      {sighting&&<label className="form-label">Number seen<input aria-label="Number seen" type="number" required min="1" max="9999" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>}
      {!sighting&&<label className="form-label">Fishing area <span>(optional)</span><select aria-label="Catch fishing area" value={catchArea} onChange={event=>setCatchArea(event.target.value)}><option value="">Not recorded</option>{areas.map(area=><option key={area.id} value={area.id}>{area.label}</option>)}</select></label>}
      {!sighting&&areaNote&&<p className="rule-detail-note" role="status">{areaNote}</p>}
      {entry.sightingOnly?<SpeciesGuidance fish={entry}/>:!sighting&&!rule&&(Number(entry.id)<=18&&!catchArea?<p className="rule-detail-note">Choose a fishing area to see saved regional limits.</p>:<SpeciesGuidance fish={entry}/>)}
      {rule&&<div className="form-rule-reference"><Ruler size={16}/><p>Saved reference: <strong>{sizeLabel(rule)}</strong> minimum · <strong>{bagLabel(rule)}</strong>. Check the Limits tab for local restrictions. Not a historical rules check.</p></div>}
      <div className={`photo-upload ${photo?'has-photo':''}`}>{photo?<><CatchPhoto photo={photo} alt={sighting?'Preview of your sighting':'Preview of your catch'}/><div className="change-photo"><button type="button" onClick={()=>uploadRef.current?.click()}><Camera size={15}/>Change photo</button>{sighting&&<button type="button" onClick={()=>setPhoto(null)}>Remove</button>}</div></>:<><ImagePlus size={29}/><strong>{processing?'Preparing your photo…':sighting?'Add a photo if you have one (optional).':'The fish. The proof. The memory.'}</strong><span>JPEG, PNG or WebP · up to 20 MB</span><div className="upload-actions"><button type="button" className="secondary-button" onClick={()=>uploadRef.current?.click()}><Upload size={15}/>Choose photo</button><button type="button" className="secondary-button" onClick={()=>cameraRef.current?.click()}><Camera size={15}/>Take photo</button></div></>}</div>
      <input ref={uploadRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event=>choosePhoto(event.target.files?.[0])}/><input ref={cameraRef} type="file" hidden capture="environment" accept="image/jpeg,image/png,image/webp" onChange={event=>choosePhoto(event.target.files?.[0])}/>
      <div className={sighting?'':'form-row'}><label className="form-label">{sighting?'Date spotted':'Date caught'}<input aria-label={sighting?'Date spotted':'Date caught'} required type="date" max={today()} value={date} onChange={event=>setDate(event.target.value)}/></label>{!sighting&&<label className="form-label">Length <span>(optional)</span><div className="input-suffix"><input type="number" min="0.1" max="3000" step="0.1" placeholder="e.g. 35" value={length} onChange={event=>setLength(event.target.value)}/><span>cm</span></div></label>}</div>
      {rule&&length&&rule.minCm!==null&&Number(length)<rule.minCm&&<p className="rules-alert">This is below the saved whole-fish minimum. Undersize fish must be returned immediately; you can still record the released catch.</p>}
      <label className="form-label">{sighting?'Where did you spot it?':'Where was the adventure?'} <span>(optional)</span><input aria-label="Location" maxLength={120} placeholder="e.g. Hauraki Gulf" value={location} onChange={event=>setLocation(event.target.value)}/></label>
      <label className="form-label">Field notes <span>(optional)</span><textarea aria-label="Field notes" maxLength={1000} rows={2} placeholder={sighting?'Behaviour, direction, conditions…':'The lure, the weather, the story…'} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
      {!sighting&&<label className="release-checkbox"><input type="checkbox" checked={entry.protected||released} disabled={entry.protected} onChange={event=>setReleased(event.target.checked)}/><Waves size={18}/><span>{entry.protected?'Incidental catch / released (protected species)':'Released back to the water'}</span></label>}
      {social.me&&<p className="social-privacy">{initial&&!social.canShare(initial.id)?'This record belongs to another online profile. Sign into that profile to sync changes.':'Automatically shared with your accepted mates. Place names, coordinates and notes stay out of mate feeds.'}</p>}
    </fieldset>
    {error&&<p className="form-error" role="alert"><Info size={16}/>{error}</p>}
    <button className="primary-button full-width" type="submit" disabled={saving||processing}>{sighting?<Eye size={18}/>:<Check size={18}/>}{saving?'Saving your memory…':processing?'Preparing photo…':initial?'Save changes':sighting?'Save sighting':'Confirm & save catch'}</button><p className="form-privacy"><ShieldCheck size={13}/>{sighting?'Your journal saves locally. Online changes sync when connected.':social.me?'Available GPS coordinates sync to the admin-only map. Your catch saves even without a location.':'Your catch saves on this device, with GPS when available.'}</p>
  </form></Dialog>;
}
