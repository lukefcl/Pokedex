# On-device species scanner

Open **Guide → Scan a species**, or **Identify my photo** in a catch form. Prepare the scanner once, open the camera and capture a frame (or choose a photo), then tap **Identify this photo**. Up to three possible catalogue matches appear with their distinguishing notes. Selecting one carries the species and photo into the catch form. The user still confirms the record before anything is saved or shared. **None of these / identify later** keeps the photo for manual naming.

## Privacy and offline use

- Inference runs in a dedicated browser worker using one WebAssembly thread. Camera frames, image features and recognition requests are not sent to a server. No API key or online account is needed.
- Model and runtime files come from this app’s own origin. The initial optional download is approximately **61 MB** and starts only when the user chooses to prepare the scanner. Completed files survive interrupted setup. Later use can work offline once both the PWA and model are cached.
- Camera access starts only from Open camera. Streams stop after capture, choosing a photo, closing the scanner or leaving the form. Live camera requires HTTPS or localhost. Native Take photo and normal photo pickers provide alternatives.
- App updates preserve the separate scanner cache. **Remove scanner model download** frees that space without deleting catches or photos. Successful replacement setup removes obsolete scanner caches. Browser storage eviction can require another download.
- Normal catch sharing remains a separate choice in the catch form. Sharing a confirmed catch can upload its thumbnail through the existing social system; recognition itself never uploads the photograph.

## Model and limitations

The image encoder is [MobileCLIP-S0, converted by Xenova for Transformers.js](https://huggingface.co/Xenova/mobileclip_s0). Its pinned revision and variant are in `public/scanner-model/v1/source.json`. Full-precision vision weights are used because the smaller quantized vision variant performed poorly in development checks. Text features are precomputed once; phones do not download the text encoder.

Text features cover all **85** catalogue entries. **58** entries also have mathematical image features derived from their credited Fish Species NZ reference photos. Those photographs are not shipped with the scanner. The complete frame is letterboxed, preserving the head, fins and tail.

This is an **experimental suggestion tool**, not a trained, validated NZ fish classifier. It combines text similarity with distinctive visual reference resemblance. Many species have just one reference, and 27 entries rely on text features alone. Close relatives, unfamiliar species, lighting, framing and background can produce wrong suggestions. There is no calibrated confidence percentage, and a clear ranking is not proof of correctness.

Reference-photo smoke checks test the inference pipeline, not independent accuracy: those same references also support ranking. Reliable species-level accuracy needs a separate labelled set of real catches and a specialist model. Do not use suggestions to decide legal size, harvest eligibility or edibility. Manual selection remains available.

## Build and development

`npm run dev` and `npm run build` copy the matching runtime from the pinned npm package into ignored `public/scanner-runtime/4.3.1/`. Model weights, configuration, classifier vectors and licences are committed public assets. Deployment needs no model-host account, API key, hosted inference service or model-generation step. The existing Vercel build command works.

Optional catalogue regeneration:

```sh
node scripts/build-scanner-classifier.mjs
node scripts/build-scanner-references.mjs
```

The first script downloads the pinned public text encoder into ignored `.cache/` and rebuilds text features. The second adds visual references from the local research cache at `.cache/species-source/`. These scripts do not run in production builds. If changing the model, classifier or runtime, version asset URLs and the scanner cache together to prevent stale-file mixtures.

The MobileCLIP licence is bundled beside its weights. The runtime licence is in `public/scanner-model/ONNX-RUNTIME-LICENSE.txt`. Transformers.js is Apache-2.0.

Checks: `npm test`, `npm run typecheck`, `npm run build`. Also check live capture, recognition speed and storage behavior on the actual installed iOS/Android devices being supported.
