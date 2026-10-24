import { copyFile, mkdir } from 'node:fs/promises';
const dest = 'public/scanner-runtime/4.3.1';
await mkdir(dest, { recursive: true });
for (const file of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'])
  await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `${dest}/${file}`);
await copyFile('public/scanner-model/ONNX-RUNTIME-LICENSE.txt', `${dest}/LICENSE`);
