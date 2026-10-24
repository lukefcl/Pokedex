'use client';
import { useRef, useState, type FormEvent } from 'react';
import { Camera, ImagePlus, Upload, Waves, Info, Check, ShieldCheck, Ruler } from 'lucide-react';
import { fish, findFish, unidentified, type Fish } from '@/lib/fish';
import { preparePhoto, type CatchRecord } from '@/lib/storage';
import { createCatchId } from '@/lib/catch-id';
import { areas, getRule, sizeLabel, bagLabel } from '@/lib/rules';
import { Dialog, CatchPhoto, today } from './screen-ui';
import SpeciesGuidance from './species-guidance';

export default function CatchForm({selected,areaId,close,onSave,initial}:{selected:Fish;initial?:CatchRecord;areaId:string;close:()=>void;onSave:(record:CatchRecord)=>Promise<void>}){
  const [fishId,setFishId]=useState(initial?.fishId||selected.id);
  const [customName,setCustomName]=useState(initial?.customName||'');
  const [quantity,setQuantity]=useState(String(initial?.quantity||1));
  const entry=findFish(fishId)||unidentified;
  const [catchArea,setCatchArea]=useState(initial?.areaId||areaId);
  const [date,setDate]=useState(initial?.date||today());
  const [location,setLocation]=useState(initial?.location||'');
  const [length,setLength]=useState(initial?.length||'');
  const [notes,setNotes]=useState(initial?.notes||'');
  const [released,setReleased]=useState(initial?.released??true);
  const [photo,setPhoto]=useState<Blob|null>(initial?.photo||null);
  const [processing,setProcessing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const uploadRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const rule=getRule(fishId,catchArea);
  async function choosePhoto(file?:File){
    if(!file)return;setProcessing(true);setError('');setPhoto(null);
    try{setPhoto(await preparePhoto(file));}catch(error){setError(error instanceof Error?error.message:'Could not read this photo.');}finally{setProcessing(false);if(uploadRef.current)uploadRef.current.value='';if(cameraRef.current)cameraRef.current.value='';}
  }
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    if(fishId==='other'&&!customName.trim()){setError('Give this catch a name, even if it is just Unknown fish.');return;}
    if(!photo){setError('Add a photo of your fish to confirm this catch.');return;}
    if(!date||date>today()){setError('Choose today or an earlier catch date.');return;}
    setSaving(true);
    try{await onSave({id:initial?.id||createCatchId(),fishId,date,location:location.trim(),length,notes:notes.trim(),released:entry.protected||released,photo,quantity:Number(quantity),...(fishId==='other'?{customName:customName.trim()}:{}),createdAt:initial?.createdAt||new Date().toISOString(),areaId:catchArea});if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});}catch(error){setError(error instanceof Error?error.message:'Could not save your catch.');setSaving(false);}
  }
  return <Dialog title={initial?'EDIT CATCH':'LOG A CATCH'} close={()=>{if(!saving&&!processing)close();}}><form className="dialog-content catch-form" onSubmit={submit}>
    <span className="eyebrow">ONE MORE STORY FOR THE COLLECTION</span><h2>{initial?'Update your memory.':'A catch to remember.'}</h2><p className="form-intro">Save any catch, including shellfish or something you will identify later. A photo confirms your record.</p>
    <fieldset disabled={saving||processing}>
      <label className="form-label">Species<select aria-label="Species" value={fishId} onChange={event=>{setFishId(event.target.value);if(findFish(event.target.value)?.protected)setReleased(true);}}><option value="other">Other / identify later</option>{fish.map(entry=><option key={entry.id} value={entry.id}>#{entry.id} · {entry.name}{entry.maori?` / ${entry.maori}`:''}</option>)}</select></label>
      {fishId==='other'&&<label className="form-label">Your name for this catch<input required maxLength={120} value={customName} placeholder="e.g. Unknown wrasse" onChange={event=>setCustomName(event.target.value)}/></label>}
      <label className="form-label">Quantity<input type="number" required min="1" max="9999" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)}/></label>
      <label className="form-label">Fishing area <span>(optional)</span><select value={catchArea} onChange={event=>setCatchArea(event.target.value)}><option value="">Not recorded</option>{areas.map(area=><option key={area.id} value={area.id}>{area.label}</option>)}</select></label>
      {!rule&&(Number(entry.id)<=18&&!catchArea?<p className="rule-detail-note">Choose a fishing area to see saved regional limits.</p>:<SpeciesGuidance fish={entry}/>)}
      {rule&&<div className="form-rule-reference"><Ruler size={16}/><p>Saved reference: <strong>{sizeLabel(rule)}</strong> minimum · <strong>{bagLabel(rule)}</strong>. Check the Limits tab for local restrictions. Not a historical rules check.</p></div>}
      <div className={`photo-upload ${photo?'has-photo':''}`}>{photo?<><CatchPhoto photo={photo} alt="Preview of your catch"/><button type="button" className="change-photo" onClick={()=>uploadRef.current?.click()}><Camera size={15}/>Change photo</button></>:<><ImagePlus size={29}/><strong>{processing?'Preparing your photo…':'The fish. The proof. The memory.'}</strong><span>JPEG, PNG or WebP · up to 20 MB</span><div className="upload-actions"><button type="button" className="secondary-button" onClick={()=>uploadRef.current?.click()}><Upload size={15}/>Choose photo</button><button type="button" className="secondary-button" onClick={()=>cameraRef.current?.click()}><Camera size={15}/>Take photo</button></div></>}</div>
      <input ref={uploadRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event=>choosePhoto(event.target.files?.[0])}/><input ref={cameraRef} type="file" hidden capture="environment" accept="image/jpeg,image/png,image/webp" onChange={event=>choosePhoto(event.target.files?.[0])}/>
      <div className="form-row"><label className="form-label">Date caught<input required type="date" max={today()} value={date} onChange={event=>setDate(event.target.value)}/></label><label className="form-label">Length <span>(optional)</span><div className="input-suffix"><input type="number" min="0.1" max="3000" step="0.1" placeholder="e.g. 35" value={length} onChange={event=>setLength(event.target.value)}/><span>cm</span></div></label></div>
      {rule&&length&&rule.minCm!==null&&Number(length)<rule.minCm&&<p className="rules-alert">This is below the saved whole-fish minimum. Undersize fish must be returned immediately; you can still record the released catch.</p>}
      <label className="form-label">Where was the adventure? <span>(optional)</span><input maxLength={120} placeholder="e.g. Hauraki Gulf" value={location} onChange={event=>setLocation(event.target.value)}/></label>
      <label className="form-label">Field notes <span>(optional)</span><textarea maxLength={1000} rows={2} placeholder="The lure, the weather, the story…" value={notes} onChange={event=>setNotes(event.target.value)}/></label>
      <label className="release-checkbox"><input type="checkbox" checked={entry.protected||released} disabled={entry.protected} onChange={event=>setReleased(event.target.checked)}/><Waves size={18}/><span>{entry.protected?'Incidental catch / released (protected species)':'Released back to the water'}</span></label>
    </fieldset>
    {error&&<p className="form-error" role="alert"><Info size={16}/>{error}</p>}
    <button className="primary-button full-width" type="submit" disabled={saving||processing}><Check size={18}/>{saving?'Saving your memory…':processing?'Preparing photo…':initial?'Save changes':'Confirm & save catch'}</button><p className="form-privacy"><ShieldCheck size={13}/>Your photo stays on this device. Always.</p>
  </form></Dialog>;
}
