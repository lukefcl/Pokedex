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

The build script builds Next.js and then generates a versioned service worker with every application JS, CSS and font asset plus an independent prerendered HTML shell. On the first online visit it caches the complete app; after the screen status bar says **OFFLINE READY**, the app can reopen and operate offline. Caches update with each production build. A service worker installation fails atomically if any precache resource is unavailable. Use a dedicated origin for the app and serve `/sw.js` and `/offline-shell.html` with the built public assets.

The web manifest includes 192px and 512px icons, a maskable icon and an Apple touch icon. HTTPS is required outside localhost for service workers and installation. Install from the in-app footer, the browser menu, or Safari's Share → Add to Home Screen. The install dialog explains platform differences. Installation and eviction behavior depend on the browser.

## Features

- 18 selected New Zealand marine species with local pixel illustrations, common and scientific names, habitat and field notes.
- Search, habitat filters, caught / uncaught filters and handheld directional controls.
- Regional size and daily limits for 18 supported zones, including Auckland East / West, Central FMA8 / FMA2, Challenger zones, South-East zones, Southland and Fiordland subareas. Shared bag limits are distinguished from individual limits. Seasonal Marlborough blue cod closure is calculated using the device date. The guide and catch form show limits for the selected area. Area preference stays in localStorage; catch area travels with journal backups.
- Photo-required catch logging with species selection, date, optional location / length / notes, and release status.
- Photos are decoded locally, resized to a maximum 1600px edge, and encoded as JPEG to reduce storage and strip source metadata. JPEG, PNG and WebP inputs up to 20 MB are supported. Camera capture uses the device's native picker where supported.
- IndexedDB transactions, local photo blobs, reload persistence, catch details and confirmed deletion. Storage failures are surfaced; catches are never marked saved before a transaction completes.
- JSON backup export with embedded photos and validated atomic restore. Restoring merges records by ID and replaces matching IDs. No data is sent to a server.
- Locally bundled fonts, responsive desktop and mobile layouts, accessible modal dialogs, keyboard controls, reduced-motion support and readable error states.

A photo records the angler's own confirmation; the app does not determine whether a photo contains the selected species. The first volume covers selected marine fish, not all NZ species, freshwater fish or shellfish. Illustrations are stylised, not identification keys. Species context: [MPI inshore fisheries](https://www.mpi.govt.nz/fishing-aquaculture/fisheries-management/inshore-fisheries) and [blue cod](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/information-on-popular-fish-in-nz/blue-cod-information).

## Fishing limits

`lib/rules.ts` contains an offline summary checked **24 October 2026** against the current MPI regional pages; each area links to its source. This is a dated reference, not a live rules service or permission to fish. Closures, marine reserves, mātaitai / taiāpure bylaws, gear, accumulation and possession rules may override these numbers. The UI states these limits and includes source links and checking dates. It deliberately does not guess rules for Kaikōura, Kermadecs, Paterson Inlet or unlisted special local areas; follow the full MPI area selector for those.

The catch form displays today's saved reference, not a historic legal assessment. Length is whole-fish length; separately permitted headed blue cod measurement is not represented as a smaller whole-fish minimum. The kept-today count includes only local, unreleased records with the selected area and date and is explicitly not a compliance tally. One fish is recorded per entry. Rules need editorial review and a new app build when MPI changes them.

Regional sources: [Auckland / Kermadec](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/auckland-kermadec-fishing-rules), [Central](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/central-fishing-rules), [Challenger](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/challenger-fishing-rules), [South-East](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/south-east-fishing-rules), [Southland](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/southland-fishing-rules), [Fiordland](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/fiordland-marine-area-fishing-rules).

Browser data is specific to the origin and browser profile; clearing site data, changing the URL / port, private browsing, device loss or browser eviction can remove or hide local records. FINDEX requests persistent storage after a successful catch when supported. Use **Device settings → Export backup** regularly and **Restore backup** on another device.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover photo backups, invalid backup rejection, area migration, IndexedDB persistence / merge / deletion, regional rule differences, shared totals, seasonal closure boundaries and Fiordland restrictions. Verify production offline behavior in a real browser after the service worker activates. Icon assets can be regenerated with `node scripts/create-icons.mjs` (Sharp is provided by Next.js).
