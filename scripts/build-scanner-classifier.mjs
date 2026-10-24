import { AutoTokenizer, CLIPTextModelWithProjection, env } from '@huggingface/transformers';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const species = JSON.parse(await readFile('lib/species.json', 'utf8'));
const source = JSON.parse(await readFile('public/scanner-model/v1/source.json', 'utf8'));
env.cacheDir = '.cache/scanner-transformers';
console.log('Loading text encoder for offline catalogue preparation (not shipped to phones)…');
const tokenizer = await AutoTokenizer.from_pretrained(source.model, { revision: source.revision });
const model = await CLIPTextModelWithProjection.from_pretrained(source.model, {
  revision: source.revision,
  dtype: 'q8',
  device: 'cpu',
});
const normal = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => Number((x / n).toFixed(7)));
};
async function encode(texts) {
  const input = tokenizer(texts, { padding: 'max_length', truncation: true });
  const { text_embeds } = await model(input);
  return text_embeds.normalize().tolist();
}
const labels = [];
for (let i = 0; i < species.length; i += 5) {
  const batch = species.slice(i, i + 5);
  const prompts = batch.flatMap((f) => [
    `a photo of ${f.name}, ${f.scientific}`,
    `a photo of ${f.name}. ${f.description}`,
    `a photo of ${f.name}, a New Zealand ${f.category === 'Marine mammals' ? 'marine mammal' : f.category === 'Kaimoana' ? 'shellfish or cephalopod' : 'fish'}. ${f.aliases}`,
  ]);
  const encoded = await encode(prompts);
  batch.forEach((f, j) => {
    const vectors = encoded.slice(j * 3, j * 3 + 3);
    labels.push({
      id: f.id,
      vector: normal(vectors[0].map((_, k) => vectors.reduce((s, v) => s + v[k], 0) / 3)),
    });
  });
  console.log(`Encoded ${Math.min(i + 5, species.length)}/${species.length} species`);
}
const groups = [
  ['fish', 'a photo of a fish caught while fishing'],
  ['shark', 'a photo of a shark or stingray'],
  ['shellfish', 'a photo of a seashell, mussel, oyster or lobster'],
  ['cephalopod', 'a photo of a squid or an octopus'],
  ['mammal', 'a photo of a whale or dolphin in the ocean'],
];
const negatives = [
  'a photo of a person',
  'a photo of a dog or cat',
  'a photo of a bird',
  'a photo of a boat with no fish',
  'a photo of open sea with no animal',
  'a photo of sand and rocks with no animal',
  'a photo of a plant',
  'a photo of cooked food on a plate',
  'a photo of a room or building',
  'a blank dark blurry photograph',
];
const gates = await encode([...groups.map((g) => g[1]), ...negatives]);
const result = {
  version: 1,
  model: source.model,
  revision: source.revision,
  dimension: labels[0].vector.length,
  labels,
  domains: groups.map(([id], i) => ({ id, vector: normal(gates[i]) })),
  negatives: negatives.map((id, i) => ({ id, vector: normal(gates[groups.length + i]) })),
};
await writeFile('public/scanner-model/v1/classifier-v2.json', JSON.stringify(result));
await model.dispose();
console.log('Offline classifier saved.');
