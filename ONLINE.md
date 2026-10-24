# FINDEX with mates

The local journal and offline PWA still work without an account. The optional
Friends tab uses Convex Auth and live queries. A device creates a random account
with a 256-bit sign-in secret; Convex Auth hashes it and manages signed sessions.
There is no email provider to configure. Download the **private recovery file**
after creating a profile. Restore that file to sign in on another device. A QR
invite is a different, temporary credential and cannot sign in to the account.

## Deployment

1. Put `CONVEX_DEPLOY_KEY` in Vercel's server environment. Rotate any key pasted
   into chat or otherwise exposed. Never commit it or prefix it with `NEXT_PUBLIC_`.
2. For a fresh Convex deployment, run `node scripts/setup-convex.mjs` with that
   deployment configured in an ignored `.env.local`. It creates missing JWT and
   Web Push signing keys, preserving existing ones. Run once per deployment.
3. Vercel uses `scripts/vercel-build.mjs`: `convex deploy` builds the backend and
   injects `NEXT_PUBLIC_CONVEX_URL` into the Next.js build. Without a deploy key,
   a normal Next.js build works (the Friends screen explains missing setup).
4. For local development, copy `.env.example` to `.env.local`, set the URL, and
   run `npm run dev`. Backend changes: `npx convex dev` with a separate development
   deployment. `npx convex deploy` targets the configured production deploy key.

## Privacy and behavior

- Display names and species avatars are visible through valid, ten-minute
  invites. Invite secrets are generated on the server and stored as hashes.
  Generating a new invite invalidates the old one. Requests need acceptance.
- Only accepted mates can query each other's shared collection, recent records,
  and photo thumbnails. Unfriending revokes those queries and future alerts.
- Suggested mates shows up to 12 friends of accepted friends, ranked by mutual
  mate count. Only display names, species avatars and mutual counts are exposed.
  Existing mates and pending requests are excluded. Suggestions update live;
  sending a request rechecks the mutual connection and still needs acceptance.
- Sharing is off initially. Each catch/sighting has a sharing switch; the online
  setup tab can opt into sharing new records or explicitly share existing ones.
  Locations and field notes are never part of the shared payload. Shared JPEGs
  are resized and re-encoded, stripping original metadata. They are returned by
  authenticated actions, not public storage URLs.
- An owner-scoped persistent outbox syncs sharing changes after reconnection.
  An account cannot automatically upload records owned by another account on
  the same device. Local saves do not wait for Convex. Journal backups contain
  local records only, never sign-in credentials.
- The feed shows up to 60 recent records (up to 20 per mate); friend profiles
  show their full shared species collection and 30 recent records. Limits are
  50 mates, 5,000 shared records per account and five push-enabled devices.
- First-time shared catches create live toasts and scheduled Web Push. Edits,
  retries and explicitly shared history do not create duplicate catch alerts.
  Sightings appear in the feed without a catch alert. Old alerts are not toasted
  when signing in. Muting covers toasts and push across all devices.
- Browser notifications require permission and HTTPS. iPhone/iPad users must
  install the PWA and open it from the home screen. OS/browser delivery is best
  effort; the live feed remains the source of truth. Expired push subscriptions
  are removed. Push destinations are restricted to browser push services.
- Signing out leaves the local journal in place, disables that device's push
  subscription and removes its locally saved recovery key. Save the recovery
  file first. It grants account access; keep it private.

Convex environment: `JWT_PRIVATE_KEY`, `JWKS`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`; optional `VAPID_SUBJECT` (a valid `mailto:` or HTTPS URL).
Keys belong in Convex's environment, not Vercel's public build environment.

## Checks

`npm test`, `npm run test:online`, `npm run typecheck`, `npm run build`.
Online authorization tests use isolated `convex-test` databases, not live user
data. Actual background push must also be checked on an installed, opted-in
phone with a second account sharing a catch.
