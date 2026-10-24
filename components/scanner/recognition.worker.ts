import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from '@huggingface/transformers';
import {
  SCANNER_CACHE,
  SCANNER_ASSETS,
  MODEL_ROOT,
  RUNTIME_ROOT,
  rankImage,
  type Classifier,
  type WorkerReply,
} from '@/lib/scanner/model';
const send = (reply: WorkerReply) => self.postMessage(reply);
let model: CLIPVisionModelWithProjection | undefined;
let processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
let classifier: Classifier;
let loading: Promise<void> | undefined;
async function prepare() {
  const cache = await caches.open(SCANNER_CACHE);
  let completed = 0;
  for (const path of SCANNER_ASSETS) {
    if (!(await cache.match(path))) {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok)
        throw new Error('Model download did not finish. Connect to the internet and retry.');
      const total = Number(response.headers.get('Content-Length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('This browser could not download the scanner.');
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        send({
          type: 'progress',
          progress: {
            phase: 'download',
            message: `Downloading scanner · ${(received / 1000000).toFixed(1)}${total ? ` / ${(total / 1000000).toFixed(1)}` : ''} MB`,
            percent: total
              ? Math.round(((completed + received / total) / SCANNER_ASSETS.length) * 100)
              : undefined,
          },
        });
      }
      await cache.put(path, new Response(new Blob(chunks), { headers: response.headers }));
    }
    completed++;
  }
  send({ type: 'progress', progress: { phase: 'load', message: 'Starting the on-device model…' } });
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = new URL(MODEL_ROOT, self.location.origin).href;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;
  const cacheURL = (request: RequestInfo | URL) =>
    new URL(request instanceof Request ? request.url : String(request), self.location.origin).href;
  env.customCache = {
    match: async (request) => cache.match(cacheURL(request)),
    put: async (request, response) => cache.put(cacheURL(request), response),
  };
  env.cacheKey = SCANNER_CACHE;
  const wasm = env.backends.onnx.wasm!;
  wasm.numThreads = 1;
  wasm.proxy = false;
  wasm.wasmPaths = {
    wasm: new URL(`${RUNTIME_ROOT}ort-wasm-simd-threaded.wasm`, self.location.origin).href,
    mjs: new URL(`${RUNTIME_ROOT}ort-wasm-simd-threaded.mjs`, self.location.origin).href,
  };
  // Use a single WASM thread so Safari and non-isolated PWAs can run it too.
  processor = await AutoProcessor.from_pretrained('mobileclip_s0');
  model = await CLIPVisionModelWithProjection.from_pretrained('mobileclip_s0', {
    dtype: 'fp32',
    device: 'wasm',
  });
  const stored = await cache.match(`${MODEL_ROOT}classifier-v2.json`);
  classifier = await stored!.json();
  for (const key of await caches.keys())
    if (key.startsWith('findex-ai-mobileclip-') && key !== SCANNER_CACHE) await caches.delete(key);
  send({ type: 'ready' });
}
self.onmessage = async (event: MessageEvent<{ type: 'load' } | { type: 'scan'; photo: Blob }>) => {
  try {
    if (!loading)
      loading = prepare().catch((error) => {
        loading = undefined;
        throw error;
      });
    await loading;
    if (event.data.type === 'scan') {
      send({
        type: 'progress',
        progress: { phase: 'scan', message: 'Comparing your photo with NZ species…' },
      });
      // Letterbox the full frame; centre-cropping can remove the head and tail of
      // a long fish, which are useful identification features.
      const bitmap = await createImageBitmap(event.data.photo);
      const canvas = new OffscreenCanvas(256, 256);
      const context = canvas.getContext('2d');
      if (!context) {
        bitmap.close();
        throw new Error('No image processing context.');
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 256, 256);
      const scale = Math.min(256 / bitmap.width, 256 / bitmap.height);
      const width = bitmap.width * scale,
        height = bitmap.height * scale;
      context.drawImage(bitmap, (256 - width) / 2, (256 - height) / 2, width, height);
      bitmap.close();
      const image = new RawImage(context.getImageData(0, 0, 256, 256).data, 256, 256, 4);
      const inputs = await processor(image);
      const { image_embeds } = await model!(inputs);
      const result = rankImage(image_embeds.data as Float32Array, classifier);
      send({ type: 'result', result });
    }
  } catch (error) {
    console.error('Local recognition failed', error);
    send({
      type: 'error',
      message: !self.navigator.onLine
        ? 'Scanner setup needs an internet connection. Your photo stays on this device.'
        : 'The scanner could not finish. Try again, use a clearer photo, or choose the species yourself.',
    });
  }
};
