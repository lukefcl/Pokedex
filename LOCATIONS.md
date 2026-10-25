# Catch positions and GPS limits

Catch GPS uses `getCurrentPosition` with high accuracy, no cached position and a
20-second timeout. It requires HTTPS or localhost plus device/browser permission.
The app captures once automatically when a new catch form opens. Browser location
permission is requested, with a brief notice beside Save. GPS is best effort: saving
never waits for it. If lookup fails or is still pending at Save, coordinates are omitted. Sightings do not start
GPS; existing catch positions are retained, and legacy edits aren't assigned today's
position. The app does not watch a user's movements. Exact latitude, longitude,
reported accuracy and reading time survive
local backups; the admin location table stores the same position separately from
mate-shared records. The catch form explains that collection. Offline uploads and
deletions use an account-scoped persistent outbox; guest catches remain local.

Older catches with no GPS retain their existing place names and can be edited.
The app never backfills a historical location with today's position automatically.

## Fishing areas

`lib/geo/fmas.json` is an offline snapshot of the official MPI fisheries management
polygons, downloaded 25 October 2026 from:

- [MPI FMAs layer 7](https://geospatial.mpi.govt.nz/portal/rest/services/MARINE/Marine_FMAs/FeatureServer/7)
- [MPI dataset](https://www.arcgis.com/home/item.html?id=4a92fcfc4e154608b631b4e44c7c380a)
- [MPI fishing rules and current local restrictions](https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/)

Source: Ministry for Primary Industries / Manatū Ahu Matua. Geometry uses MPI's
LINZ-derived data; retain its metadata and source attribution when updating it.
The snapshot retains FMA 1, 2, 3, 5, 7, 8 and 9, full geometry rounded to five decimal
places, and only ID/name properties. There are no runtime requests containing user
coordinates to MPI, geocoders or an AI service. Map tiles are requested only when an
admin opens the map, and reveal its viewport to the tile provider.

GPS in FMA 1/9 selects the saved Auckland east/west summary; FMA 2/8 selects Central
east/west. These boundaries include inland territory: marine limits don't apply to
freshwater fishing. Species-specific freshwater guidance still directs to Fish & Game
or DOC. GPS does not establish whether the user is fishing in salt water.

Challenger, South-East and Southland contain distinct local zones which this polygon
set cannot resolve. They show the detected region and require manual selection of the
local summary. Readings that straddle FMA boundaries (GPS accuracy plus a minimum
200-metre tolerance) clear the saved area and request confirmation. Unsupported areas
also clear the saved selection, avoiding stale limits. Reserves, temporary closures,
mātaitai, taiāpure, methods and possession restrictions always require current MPI
checks. GPS selection is a regional reference, never permission to fish.

## Admin access

`FINDEX_ADMIN_USER_IDS` lives in the Convex server environment. Only allowlisted
authenticated profiles can query map coordinates. Frontend gating is an additional
convenience; changing a display name or calling the endpoint directly cannot bypass
the server check. Coordinate uploads are validated and owner-scoped. The map includes
no account identifiers, place names, notes or photographs.
