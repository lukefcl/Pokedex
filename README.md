# FINDEX

A mobile PWA built as a retro Pokédex handheld, using Next.js App Router, React and TypeScript. The device body fills the phone and frames a single LCD screen. Guide, journal, regional limits, settings and photo forms all run inside that screen, with safe-area support and physical-style D-pad / A / B controls. All catch records and photos stay in IndexedDB on the user's device.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Development mode intentionally does not register an offline service worker, so it cannot cache stale development files.

## Production / PWA

```sh
npm run build
npm start
```

The Next.js `runAfterProductionCompile` hook generates a versioned service worker before hosting adapters collect or relocate the build output. It lists the compiled JS, CSS and font assets without reading internal server HTML or `BUILD_ID`. On the first online visit, the worker caches the served homepage, all sprite PNG/GIF files, and those assets. After the screen status bar says **OFFLINE READY**, the app can reopen and operate offline. Every production build gets a new cache version. Installation fails if any required resource cannot be cached. Use a dedicated origin and serve the generated `/sw.js` with the built public assets.

On Vercel, use the standard **Next.js** preset and **npm run build**. No output-directory override, server HTML copying or extra post-build command is needed. The worker is generated before Vercel's `onBuildComplete` adapter stage, so it is ready for deployment packaging.

The web manifest includes 192px and 512px icons, a maskable icon and an Apple touch icon. HTTPS is required outside localhost for service workers and installation. Install from the in-app footer, the browser menu, or Safari's Share → Add to Home Screen. The install dialog explains platform differences. Installation and eviction behavior depend on the browser.

## Features

- 85 aquatic catalogue entries: the original 60, plus 14 catchable entries and 11 marine-mammal entries for sightings. New additions include squid, octopus, mahi-mahi, rainbow trout, parore, skipjack, marlin, swordfish, mackerel, spotty, kōheru, sea perch and native eels. Whales, orcas and dolphins have their own Marine mammals filter. Stable IDs preserve existing catches. Common/scientific names, habitats, original short summaries and paraphrased fun facts link to Fish Species NZ, DOC, Te Ara, MPI, NIWA, Fish & Game, NOAA and IWC sources.
- Original AI-generated pixel artwork for every entry plus an unidentified-catch placeholder. Each has a 128×96 transparent PNG and an eight-frame looping GIF. Lists use stills; detail views and catch cards animate. Reduced-motion preferences select the still image. All artwork is bundled locally.
- Search (including aliases), species-type and habitat filters, caught / uncaught filters and handheld directional controls.
- Regional size and daily limits for 18 supported zones, including Auckland East / West, Central FMA8 / FMA2, Challenger zones, South-East zones, Southland and Fiordland subareas. Shared bag limits are distinguished from individual limits. Seasonal Marlborough blue cod closure is calculated using the device date. The guide and catch form show limits for the selected area. Area preference stays in localStorage; catch area travels with journal backups.
- Catch and sighting logging and editing with species selection, quantity, date, optional location / length / notes, and release status. Other / identify later accepts a custom name, and an existing record can later be assigned to a catalogue species.
- Catches still require a photo. Sightings allow an optional photo, date, number seen, location and behaviour notes. Any species can be observed, and marine mammals always use sighting mode. Sightings display Spotted and never contribute to kept-catch totals. Journal filters separate catches and sightings.
- Photos are decoded locally, resized to a maximum 1600px edge, and encoded as JPEG to reduce storage and strip source metadata. JPEG, PNG and WebP inputs up to 20 MB are supported. Camera capture uses the device's native picker where supported.
- IndexedDB transactions, local photo blobs, reload persistence, catch details and confirmed deletion. Catch cards show the species sprite over the uploaded photo using object-fit: cover; the original photo can also be expanded in catch details. Storage failures are surfaced; catches are never marked saved before a transaction completes.
- JSON v2 backup export with embedded photos (null for photo-free sightings) and validated atomic restore. Existing v1 catch backups remain supported. Restoring merges records by ID and replaces matching IDs. No data is sent to a server.
- Locally bundled fonts, responsive desktop and mobile layouts, accessible modal dialogs, keyboard controls, reduced-motion support and readable error states.

A photo records the angler's own confirmation; the app does not determine whether a photo contains the selected species. The catalogue includes marine fish, freshwater fish, sharks, rays, kaimoana and marine mammals, but is not a complete taxonomic list of everything in New Zealand. The custom catch option covers unlisted species. AI illustrations are stylised, not identification keys. Species context: [MPI inshore fisheries](https://www.mpi.govt.nz/fishing-aquaculture/fisheries-management/inshore-fisheries) and [blue cod](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/information-on-popular-fish-in-nz/blue-cod-information).

## Fishing limits

`lib/rules.ts` contains an offline summary checked **24 October 2026** against the current MPI regional pages; each area links to its source. This is a dated reference, not a live rules service or permission to fish. Closures, marine reserves, mātaitai / taiāpure bylaws, gear, accumulation and possession rules may override these numbers. The UI states these limits and includes source links and checking dates. It deliberately does not guess rules for Kaikōura, Kermadecs, Paterson Inlet or unlisted special local areas; follow the full MPI area selector for those.

The catch form displays today's saved reference, not a historic legal assessment. Length is whole-fish length; separately permitted headed blue cod measurement is not represented as a smaller whole-fish minimum. The kept-today count includes only local, unreleased records with the selected area and date and is explicitly not a compliance tally. Each entry has a quantity, defaulting to one for older records. The kept-today count sums catch quantities, excludes sightings, and is not a legal bag calculator. Saved numeric rules cover the original 18 finfish only: additional species show explicit current-rules links rather than inherited or guessed limits. Trout/salmon link to Fish & Game, whitebait to DOC, and protected sharks/rays to DOC guidance. Incidental protected-species entries are recorded as released. Rules need editorial review and a new app build when MPI changes them.

Regional sources: [Auckland / Kermadec](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/auckland-kermadec-fishing-rules), [Central](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/central-fishing-rules), [Challenger](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/challenger-fishing-rules), [South-East](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/south-east-fishing-rules), [Southland](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/southland-fishing-rules), [Fiordland](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/fiordland-marine-area-fishing-rules).

Browser data is specific to the origin and browser profile; clearing site data, changing the URL / port, private browsing, device loss or browser eviction can remove or hide local records. FINDEX requests persistent storage after a successful catch when supported. Use **Device settings → Export backup** regularly and **Restore backup** on another device.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover photo backups, invalid backup rejection, area migration, IndexedDB persistence / merge / deletion, regional rule differences, shared totals, seasonal closure boundaries and Fiordland restrictions. Verify production offline behavior in a real browser after the service worker activates. Icon assets can be regenerated with `node scripts/create-icons.mjs` (Sharp is provided by Next.js).

## Artwork and species sources

The reference catalogue and species facts were imported on **25 October 2026** from [Fish Species NZ](https://www.fishspecies.nz/). Source text is paraphrased in the shipped catalogue. Reference photo credit strings and links are retained per entry and in [ASSET_CREDITS.md](ASSET_CREDITS.md). The two retained legacy entries use the existing FINDEX descriptions.

Sprites were generated individually with the built-in ImageGen tool, using each source photo as an anatomy/colour reference. Red cod, blue warehou, the unidentified placeholder and the 25 later additions were generated from anatomical descriptions. New additions use the original FINDEX snapper artwork as a pixel-style reference; no new third-party photographs are bundled. [Pokémon Database](https://pokemondb.net/sprites) supplied the requested game-era style reference; no Pokémon artwork is included. Exact prompts are in [scripts/sprite-prompts.json](scripts/sprite-prompts.json).

Final distributable assets live in **public/sprites/**. They do not require image generation during deployment. The local-only workflow is:

1. Run `node scripts/import-species.mjs` to cache source pages and reference images in ignored `.cache/species-source/`.
2. Generate one transparent AI master per entry using the saved prompts; put selected masters in ignored `.cache/sprite-masters/<slug>.png`.
3. Run `node scripts/build-sprites.mjs` to create 16-colour transparent PNGs and GIFs with eight 160ms frames. The deterministic pass reduces AI artwork to a pixel grid and adds a subtle body/tail idle movement (shellfish bob gently). It does not fabricate a different species from a shared template.

`scripts/prepare-catalogue.mjs` documents the initial import's curated summaries and stable ID mapping; it expects the initial legacy snapshot in the local research cache. Edit `lib/species.json` directly for editorial updates. Original research pages, photos and full-resolution generated masters are not required by the app or committed.

The v2 record schema stores an optional `kind` (`catch` or `sighting`) while preserving the IndexedDB database and all existing IDs. Missing kinds in old records mean catch. Marine mammal entries always resolve to sighting; their form omits fishing areas, length and release fields. Editing, filtering, export/import and photo-free records use the same local journal. Nothing is automatically reported to DOC.
