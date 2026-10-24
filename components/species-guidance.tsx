import type {Fish} from '@/lib/fish';
export const PROTECTED_SOURCE='https://www.doc.govt.nz/nature/habitats/marine/protected-marine-fishes-and-invertebrates/';
export default function SpeciesGuidance({fish}:{fish:Fish}) {
  const whitebait=fish.slug==='whitebait-inanga';
  const freshwater=fish.category==='Freshwater';
  const href=fish.protected?PROTECTED_SOURCE:whitebait?'https://www.doc.govt.nz/parks-and-recreation/things-to-do/whitebaiting/':freshwater?'https://www.fishandgame.org.nz/freshwater-fishing-in-new-zealand/fishing-licences-and-regulations/fishing-regulations/':'https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/';
  return <div className={`species-guidance ${fish.protected?'protected-guidance':''}`}>
    <strong>{fish.protected?'Protected species':whitebait?'Whitebait rules':freshwater?'Freshwater regulations':'Limits not saved for this species'}</strong>
    <p>{fish.protected?'Do not target or keep. An accidental catch must be released immediately and reported to DOC as soon as possible. You can keep a local photo record here.':whitebait?'Seasons, gear and waterway restrictions apply. Use DOC’s current whitebait rules.':freshwater?'Trout and salmon require a sports fishing licence and local regulations. Fish & Game covers most areas; Taupō has separate DOC rules.':'Check current MPI rules for the species and exact location. Shellfish have separate bags, measuring methods and closures. A missing saved limit is not an allowance.'}</p>
    <a className="source-link" href={href} target="_blank" rel="noreferrer">{fish.protected||whitebait?'Open DOC guidance':freshwater?'Open Fish & Game regulations':'Open current MPI rules'} ↗</a>
  </div>;
}
