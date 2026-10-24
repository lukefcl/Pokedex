import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fish } from '../lib/fish';
import {
  rankImage,
  scannerIsCached,
  SCANNER_ASSETS,
  SCANNER_CACHE,
  type Classifier,
} from '../lib/scanner/model';
const base: Classifier = {
  version: 1,
  dimension: 2,
  domains: [{ id: 'fish', vector: [1, 0] }],
  negatives: [{ id: 'background', vector: [0, 1] }],
  labels: [
    { id: '001', vector: [1, 0] },
    { id: '002', vector: [0.97, 0.2431] },
    { id: '003', vector: [0.8, 0.6] },
    { id: '004', vector: [0.6, 0.8] },
  ],
};
test('scanner rejects invalid embeddings and backgrounds instead of forcing a species', () => {
  for (const values of [[NaN, 0], [1], [0, 0], [Infinity, 0]])
    assert.throws(() => rankImage(values, base));
  const result = rankImage([0, 1], base);
  assert.equal(result.reason, 'no-animal');
  assert.deepEqual(result.matches, []);
});
test('scanner ranks three catalogue candidates and marks similar matches uncertain', () => {
  const result = rankImage([1, 0], base);
  assert.deepEqual(
    result.matches.map((r) => r.id),
    ['001', '002', '003'],
  );
  assert.equal(result.uncertain, true);
  assert.equal(result.reason, 'uncertain');
  assert.deepEqual(rankImage([5, 0], base), result);
});
test('distinctive reference features assist ranking without giving common backgrounds a blanket boost', () => {
  const fixture = {
    ...base,
    labels: base.labels.map((l) => ({ ...l, vector: [0.7, 0.7] })),
    references: [
      { id: '001', vector: [0.6, 0.8] },
      { id: '002', vector: [0.6, 0.8] },
      { id: '003', vector: [1, 0] },
      { id: '004', vector: [0.6, 0.8] },
    ],
  };
  const result = rankImage([1, 0], fixture);
  assert.equal(result.matches[0].id, '003');
  assert.ok(result.matches[0].similarity > result.matches[1].similarity);
});
test('all catalogue species have valid versioned model vectors and source references', async () => {
  const c = JSON.parse(
    await readFile('public/scanner-model/v1/classifier-v2.json', 'utf8'),
  ) as Classifier & { revision: string };
  const source = JSON.parse(await readFile('public/scanner-model/v1/source.json', 'utf8'));
  assert.equal(c.revision, source.revision);
  assert.equal(c.version, 1);
  assert.equal(c.dimension, 512);
  assert.equal(source.variant, 'vision_model.onnx');
  assert.deepEqual(c.labels.map((l) => l.id).sort(), fish.map((f) => f.id).sort());
  assert.equal(new Set(c.labels.map((l) => l.id)).size, 85);
  assert.equal(c.references?.length, 58);
  for (const label of [...c.labels, ...c.domains, ...c.negatives, ...(c.references || [])]) {
    assert.equal(label.vector.length, 512);
    assert.ok(label.vector.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...label.vector) - 1) < 0.0001);
  }
  const bytes =
    (await stat('public/scanner-model/v1/mobileclip_s0/onnx/vision_model.onnx')).size +
    (await stat('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm')).size +
    (await stat('public/scanner-model/v1/classifier-v2.json')).size;
  assert.ok(bytes < 65_000_000);
  assert.ok(bytes > 55_000_000);
  assert.equal(SCANNER_ASSETS.length, 6);
  assert.ok(SCANNER_ASSETS.every((p) => p.startsWith('/scanner-')));
});
test('offline scanner readiness requires every optional model and runtime file', async () => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  const saved = new Set<string>();
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      open: async (name: string) => {
        assert.equal(name, SCANNER_CACHE);
        return { match: async (path: string) => (saved.has(path) ? {} : undefined) };
      },
    },
  });
  try {
    assert.equal(await scannerIsCached(), false);
    SCANNER_ASSETS.slice(0, -1).forEach((p) => saved.add(p));
    assert.equal(await scannerIsCached(), false);
    saved.add(SCANNER_ASSETS.at(-1)!);
    assert.equal(await scannerIsCached(), true);
  } finally {
    if (old) Object.defineProperty(globalThis, 'caches', old);
    else Reflect.deleteProperty(globalThis, 'caches');
  }
});
