import type { Fish } from '@/lib/fish';

export default function FishSprite({ fish, silhouette = false, className = '' }: { fish: Fish; silhouette?: boolean; className?: string }) {
  const c = silhouette ? '#658067' : fish.color;
  const a = silhouette ? '#658067' : fish.accent;
  const pale = silhouette ? '#658067' : '#ded8b8';
  const long = fish.shape === 'long' || fish.shape === 'shark';
  const flat = fish.shape === 'flat';
  const body = long ? '26,29 38,22 73,20 96,25 111,32 120,32 120,39 110,40 97,47 43,46 27,40' : flat ? '34,29 48,14 71,12 94,23 104,34 100,43 88,54 57,56 36,47 26,38' : '29,28 44,18 67,14 86,20 103,29 112,31 117,38 110,43 98,45 91,51 57,53 39,48 27,40';
  return <svg viewBox="0 0 144 76" className={`fish-sprite ${className}`} role="img" aria-label={`${fish.name} pixel illustration`} shapeRendering="crispEdges">
    <ellipse cx="72" cy="66" rx="39" ry="3" fill="#344b3d" opacity=".08" />
    <g stroke={silhouette ? '#658067' : '#46554b'} strokeWidth="1.4" strokeLinejoin="miter">
      <path d={long ? 'M33 32 13 18 17 34 12 52 33 40Z' : 'M35 31 17 21 19 35 14 50 36 42Z'} fill={a} />
      <path d={fish.shape === 'shark' ? 'M60 25 73 5 78 25Z' : long ? 'M48 24 63 12 73 23 84 18 87 28Z' : 'M40 25 43 13 48 18 52 9 57 16 63 6 68 14 74 11 80 21 90 18 94 29Z'} fill={a} />
      <path d={`M${body}Z`} fill={c} />
      <path d={long ? 'M44 39 95 40 105 36 95 45 44 44Z' : 'M40 37 96 35 108 38 94 46 57 48 42 44Z'} fill={pale} stroke="none" />
      {fish.id === '005' && <path d="M87 22 94 25 91 44 83 48Z" fill={a} stroke="none" />}
      {fish.id === '008' && <rect x="65" y="29" width="14" height="14" fill={a} stroke="none" />}
      {fish.id === '003' && <path d="M37 33H108V36H37Z" fill={a} stroke="none" />}
      {fish.id === '018' && <path d="M39 26H85V29H39ZM37 33H94V36H37ZM42 40H95V43H42Z" fill={a} stroke="none" />}
      <path d={fish.shape === 'gurnard' ? 'M73 38 60 59 89 54 95 41Z' : 'M76 37 66 51 83 46 88 37Z'} fill={a} />
      <path d={long ? 'M58 46 68 55 75 46Z' : 'M53 49 62 59 75 52Z'} fill={a} />
    </g>
    {!silhouette && <>
      <path d={long ? 'M96 27V40L101 43' : 'M93 25 90 34 93 44'} fill="none" stroke={a} strokeWidth="2" />
      <rect x={long ? 107 : 103} y="29" width="5" height="5" fill="#f6f0d2" />
      <rect x={long ? 109 : 105} y="30" width="3" height="3" fill="#293c34" />
      <path d="M112 38H118" stroke="#46554b" strokeWidth="1.5" />
      {['001','002','012','013'].includes(fish.id) && <g fill={a} opacity=".7">{[40,49,58,67,76].map((x,i)=><g key={x}><rect x={x} y={25+i%2*3} width="2" height="2" /><rect x={x+3} y={32+i%2*3} width="2" height="2" /></g>)}</g>}
    </>}
  </svg>;
}
