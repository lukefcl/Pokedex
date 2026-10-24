import type {Fish} from '@/lib/fish';

/** Small local AI assets; lists use stills to limit motion and battery use. */
export default function FishSprite({fish,silhouette=false,className='',animate=false}:{fish:Fish;silhouette?:boolean;className?:string;animate?:boolean}) {
  const base = `/sprites/${fish.slug}`;
  return <picture className={`fish-sprite ${silhouette?'is-silhouette':''} ${className}`}>
    {animate && <source media="(prefers-reduced-motion: reduce)" srcSet={`${base}.png`}/>}
    {/* Native img preserves the pixel grid and avoids routing local assets through an image service. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${base}.${animate?'gif':'png'}`} width={128} height={96} alt={`${fish.name} AI pixel sprite`} loading="lazy" decoding="async"/>
  </picture>;
}
