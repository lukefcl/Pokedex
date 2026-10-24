import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public/icons', { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="94" fill="#c64c3e"/><rect x="42" y="48" width="428" height="416" rx="55" fill="#b04135"/><circle cx="117" cy="107" r="31" fill="#d9dfd0"/><circle cx="117" cy="107" r="23" fill="#4c9cb8"/><circle cx="109" cy="99" r="7" fill="#bde9e5"/><circle cx="178" cy="88" r="9" fill="#e0c369"/><circle cx="211" cy="88" r="9" fill="#8fa770"/><rect x="87" y="159" width="338" height="244" rx="19" fill="#dce0ce"/><rect x="110" y="181" width="292" height="190" rx="6" fill="#c6d3a6"/><path d="M177 263 133 227 139 277 132 315 180 293 199 312 265 324 325 300 352 280 332 252 302 236 258 223 207 234Z" fill="#567052"/><path d="M219 239 234 205 259 225 280 214 293 241M224 309 245 342 269 316" fill="#567052"/><rect x="314" y="260" width="12" height="12" fill="#d5dfb3"/><path d="M199 283H304V295H199Z" fill="#9cba86"/><circle cx="112" cy="386" r="6" fill="#b44337"/><path d="M362 386h35m-35 8h35" stroke="#859074" stroke-width="4"/></svg>`;
for (const [name,size] of [['icon-192',192],['icon-512',512],['apple-touch-icon',180]]) await sharp(Buffer.from(svg)).resize(size,size).png().toFile(`public/icons/${name}.png`);
const safe = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#c64c3e"/><image href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" x="66" y="66" width="380" height="380"/></svg>`;
await sharp(Buffer.from(safe)).png().toFile('public/icons/maskable-512.png');
await writeFile('public/icons/findex.svg', svg);
console.log('Created FINDEX app icons.');
