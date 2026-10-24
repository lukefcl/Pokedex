import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from '@huggingface/transformers';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
env.allowRemoteModels = false;
env.localModelPath = resolve('public/scanner-model/v1') + '/';
const classifier = JSON.parse(await readFile('public/scanner-model/v1/classifier-v2.json', 'utf8'));
const species = JSON.parse(await readFile('lib/species.json', 'utf8'));
const processor = await AutoProcessor.from_pretrained('mobileclip_s0');
const model = await CLIPVisionModelWithProjection.from_pretrained('mobileclip_s0', {
  dtype: 'fp32',
  device: 'cpu',
});
classifier.references = [];
for (const f of species) {
  if (!f.sourceUrl.startsWith('https://www.fishspecies.nz/')) continue;
  const slug = new URL(f.sourceUrl).pathname.replaceAll('/', '');
  const path = `.cache/species-source/${slug}.webp`;
  try {
    await access(path);
  } catch {
    continue;
  }
  const prepared = await sharp(path)
    .resize(256, 256, { fit: 'contain', background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const img = new RawImage(new Uint8Array(prepared.data), 256, 256, 3);
  const { image_embeds } = await model(await processor(img));
  classifier.references.push({
    id: f.id,
    vector: image_embeds
      .normalize()
      .tolist()[0]
      .map((v) => Number(v.toFixed(7))),
    sourceUrl: f.sourceUrl,
  });
}
await writeFile('public/scanner-model/v1/classifier-v2.json', JSON.stringify(classifier));
console.log(
  `Added ${classifier.references.length} photo reference embeddings; no source photographs are bundled.`,
);
await model.dispose();
