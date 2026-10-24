// Public, versioned model assets. No camera frames or embeddings are uploaded.
export const SCANNER_CACHE = 'findex-ai-mobileclip-v2';
export const MODEL_ROOT = '/scanner-model/v1/';
export const RUNTIME_ROOT = '/scanner-runtime/4.3.1/';
export const SCANNER_ASSETS = [
  `${MODEL_ROOT}classifier-v2.json`,
  `${MODEL_ROOT}mobileclip_s0/config.json`,
  `${MODEL_ROOT}mobileclip_s0/preprocessor_config.json`,
  `${MODEL_ROOT}mobileclip_s0/onnx/vision_model.onnx`,
  `${RUNTIME_ROOT}ort-wasm-simd-threaded.wasm`,
  `${RUNTIME_ROOT}ort-wasm-simd-threaded.mjs`,
];
export type VectorLabel = { id: string; vector: number[] };
export type Classifier = {
  version: number;
  dimension: number;
  labels: VectorLabel[];
  domains: VectorLabel[];
  negatives: VectorLabel[];
  references?: VectorLabel[];
};
export type ScanMatch = { id: string; similarity: number };
export type ScanResult = {
  matches: ScanMatch[];
  uncertain: boolean;
  reason: 'matches' | 'uncertain' | 'no-animal';
};
export type ScanProgress = {
  phase: 'download' | 'load' | 'ready' | 'scan';
  message: string;
  percent?: number;
};
export type WorkerReply =
  | { type: 'progress'; progress: ScanProgress }
  | { type: 'ready' }
  | { type: 'result'; result: ScanResult }
  | { type: 'error'; message: string };
function dot(a: ArrayLike<number>, b: number[]) {
  let sum = 0;
  for (let i = 0; i < b.length; i++) sum += a[i] * b[i];
  return sum;
}
export function rankImage(vector: ArrayLike<number>, classifier: Classifier): ScanResult {
  if (vector.length !== classifier.dimension || !Array.from(vector).every(Number.isFinite))
    throw new Error('The image could not be analysed. Try another photo.');
  const norm = Math.hypot(...Array.from(vector));
  if (!norm) throw new Error('The image is too dark or unclear. Try another photo.');
  const normal = Array.from(vector, (x) => x / norm);
  const animal = Math.max(...classifier.domains.map((l) => dot(normal, l.vector)));
  const background = Math.max(...classifier.negatives.map((l) => dot(normal, l.vector)));
  if (animal < 0.18 || background > animal + 0.015)
    return { matches: [], uncertain: true, reason: 'no-animal' };
  const referenceScores = (classifier.references || []).map((l) => ({
    id: l.id,
    score: dot(normal, l.vector),
  }));
  const sorted = referenceScores.map((r) => r.score).sort((a, b) => a - b);
  const baseline = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const matches = classifier.labels
    .map((l) => {
      const reference = referenceScores.find((r) => r.id === l.id);
      // Add evidence only for a distinctive visual resemblance, above the common
      // reference-photo background. This is a nearest-example aid, not fine-tuning.
      const visual = reference ? Math.max(0, reference.score - baseline - 0.025) * 1.5 : 0;
      return { id: l.id, similarity: dot(normal, l.vector) + visual };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
  if (!matches.length || matches[0].similarity < 0.18)
    return { matches: [], uncertain: true, reason: 'no-animal' };
  // Similarities are rankings, not calibrated probabilities. Never show a %.
  const uncertain =
    matches[0].similarity < 0.3 ||
    (matches.length > 1 && matches[0].similarity - matches[1].similarity < 0.06);
  return { matches, uncertain, reason: uncertain ? 'uncertain' : 'matches' };
}
export async function scannerIsCached() {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(SCANNER_CACHE);
    return (await Promise.all(SCANNER_ASSETS.map((path) => cache.match(path)))).every(Boolean);
  } catch {
    return false;
  }
}
