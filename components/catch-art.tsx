import type {Fish} from '@/lib/fish';
import {catchName,recordKind} from '@/lib/fish';
import type {CatchRecord} from '@/lib/storage';
import {CatchPhoto} from './screen-ui';
import FishSprite from './fish-sprite';
export default function CatchArt({record,fish,detail=false}:{record:CatchRecord;fish:Fish;detail?:boolean}) {
  const sighting=recordKind(record)==='sighting';
  return <div className={`catch-art ${detail?'catch-art-detail':''}`}>
    {record.photo&&<CatchPhoto photo={record.photo} alt={`Your ${catchName(record)} ${sighting?'sighting':'catch'}`} className="catch-art-photo"/>}
    <div className="catch-art-shade"/>
    <FishSprite fish={fish} animate/>
    <span className="record-kind-badge">{sighting?'SIGHTING':'CATCH'}</span>
    <span className="catch-art-number">{fish.id==='other'?'ID PENDING':`NO. ${fish.id}`}</span>
  </div>;
}
