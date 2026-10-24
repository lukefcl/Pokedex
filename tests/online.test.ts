import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import {
  inviteToken,
  newRecovery,
  parseRecovery,
  sharedFields,
  enqueue,
  readOutbox,
  finishJob,
} from '../lib/social/client';
import { validPushEndpoint, validPushKeys } from '../lib/social/push-validation';
import type { CatchRecord } from '../lib/storage';
import { pair } from '../convex/access';
const modules = import.meta.glob('../convex/**/*.{ts,js}');
const record = {
  localId: 'local-one',
  fishId: '001',
  kind: 'catch' as const,
  date: '2026-01-01',
  length: '40',
  quantity: 1,
  released: true,
};
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) =>
    Promise.all(
      ['Alice', 'Bob', 'Eve'].map(async (name) => {
        const id = await ctx.db.insert('users', {});
        await ctx.db.insert('profiles', {
          userId: id,
          name,
          avatar: '001',
          autoShare: false,
          muteAlerts: false,
          createdAt: Date.now(),
        });
        return id;
      }),
    ),
  );
  const [alice, bob, eve] = ids.map((id) => t.withIdentity({ subject: `${id}|session` }));
  return { t, ids, alice, bob, eve };
}
async function link(f: Awaited<ReturnType<typeof fixture>>) {
  const token = 'x'.repeat(43);
  await f.t.mutation(internal.social.saveInvite, {
    owner: f.ids[0],
    hash: bytesToHex(sha256(token)),
  });
  await f.bob.mutation(api.social.request, { token });
  const h = await f.alice.query(api.social.home, {});
  await f.alice.mutation(api.social.answer, { id: h.incoming[0]._id, accept: true });
}

describe('suggested mates', () => {
  async function graph() {
    const f = await fixture();
    const extras = await f.t.run(async (ctx) => {
      const ids = [];
      for (const name of ['Dory', 'Finn', 'Gills']) {
        const userId = await ctx.db.insert('users', {});
        await ctx.db.insert('profiles', { userId, name, avatar: '002', autoShare: false, muteAlerts: false, createdAt: Date.now() });
        ids.push(userId);
      }
      // Alice's mates are Bob and Eve; Dory knows both, Finn knows Bob.
      for (const [x, y] of [[f.ids[0], f.ids[1]], [f.ids[0], f.ids[2]], [f.ids[1], ids[0]], [f.ids[2], ids[0]], [f.ids[1], ids[1]]]) {
        const [a, b] = pair(x, y);
        await ctx.db.insert('friendships', { a, b, createdAt: Date.now() });
      }
      return ids;
    });
    return { ...f, extras };
  }

  it('ranks unique second-degree mates by mutual count and returns only public fields', async () => {
    const f = await graph();
    const result = await f.alice.query(api.discovery.suggestions, {});
    expect(result.hasMates).toBe(true);
    expect(result.mates).toEqual([
      { userId: f.extras[0], name: 'Dory', avatar: '002', mutualCount: 2 },
      { userId: f.extras[1], name: 'Finn', avatar: '002', mutualCount: 1 },
    ]);
    await expect(f.t.query(api.discovery.suggestions, {})).rejects.toThrow('Sign in');
    const stranger = f.t.withIdentity({ subject: `${f.extras[2]}|session` });
    expect(await stranger.query(api.discovery.suggestions, {})).toEqual({ mates: [], hasMates: false });
  });

  it('hides incoming and outgoing requests and restores declined suggestions', async () => {
    const f = await graph();
    await f.alice.mutation(api.discovery.request, { id: f.extras[0] });
    const finn = f.t.withIdentity({ subject: `${f.extras[1]}|session` });
    await finn.mutation(api.discovery.request, { id: f.ids[0] });
    expect((await f.alice.query(api.discovery.suggestions, {})).mates).toEqual([]);
    await expect(f.alice.mutation(api.discovery.request, { id: f.extras[1] })).rejects.toThrow('already sent');
    const h = await f.alice.query(api.social.home, {});
    await f.alice.mutation(api.social.answer, { id: h.incoming[0]._id, accept: false });
    expect((await f.alice.query(api.discovery.suggestions, {})).mates.map((m) => m.name)).toEqual(['Finn']);
  });

  it('requires approval, avoids duplicate requests, and then grants normal mate access', async () => {
    const f = await graph();
    const dory = f.t.withIdentity({ subject: `${f.extras[0]}|session` });
    await f.t.mutation(internal.records.publish, { owner: f.extras[0], record, historic: true });
    await f.alice.mutation(api.discovery.request, { id: f.extras[0] });
    await f.alice.mutation(api.discovery.request, { id: f.extras[0] });
    expect(await f.alice.query(api.social.collection, { id: f.extras[0] })).toBeNull();
    expect(await f.alice.query(api.social.feed, {})).toEqual([]);
    const home = await dory.query(api.social.home, {});
    expect(home.incoming).toHaveLength(1);
    await dory.mutation(api.social.answer, { id: home.incoming[0]._id, accept: true });
    expect((await f.alice.query(api.social.collection, { id: f.extras[0] }))?.total).toBe(1);
    expect((await f.alice.query(api.discovery.suggestions, {})).mates.map((m) => m.name)).toEqual(['Finn']);
  });

  it('rechecks mutual connections and rejects self or unrelated accounts', async () => {
    const f = await graph();
    await expect(f.alice.mutation(api.discovery.request, { id: f.ids[0] })).rejects.toThrow('own FINDEX');
    await expect(f.alice.mutation(api.discovery.request, { id: f.extras[2] })).rejects.toThrow('mutual mate');
    await f.bob.mutation(api.social.unfriend, { id: f.extras[1] });
    expect((await f.alice.query(api.discovery.suggestions, {})).mates.map((m) => m.name)).toEqual(['Dory']);
    await expect(f.alice.mutation(api.discovery.request, { id: f.extras[1] })).rejects.toThrow('mutual mate');
    await expect(f.t.mutation(api.discovery.request, { id: f.extras[0] })).rejects.toThrow('Sign in');
  });

  it('shares the QR request rate limit and enforces the mate cap', async () => {
    const f = await graph();
    await f.t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', { userId: f.ids[0], scope: 'requests', start: Date.now(), count: 30 });
    });
    await expect(f.alice.mutation(api.discovery.request, { id: f.extras[0] })).rejects.toThrow('Please wait');
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 48; i++) {
        const other = await ctx.db.insert('users', {});
        const [a, b] = pair(f.ids[0], other);
        await ctx.db.insert('friendships', { a, b, createdAt: Date.now() });
      }
    });
    await expect(f.alice.mutation(api.discovery.request, { id: f.extras[0] })).rejects.toThrow('50 mates');
  });

  it('bounds the list to twelve and fills the next spot after sending a request', async () => {
    const f = await graph();
    await f.t.run(async (ctx) => {
      for (let i = 0; i < 14; i++) {
        const userId = await ctx.db.insert('users', {});
        await ctx.db.insert('profiles', { userId, name: `Mate ${i}`, avatar: '001', autoShare: false, muteAlerts: false, createdAt: Date.now() });
        const [a, b] = pair(f.ids[1], userId);
        await ctx.db.insert('friendships', { a, b, createdAt: Date.now() });
      }
    });
    const initial = await f.alice.query(api.discovery.suggestions, {});
    expect(initial.mates).toHaveLength(12);
    expect(initial.mates[0].name).toBe('Dory');
    await f.alice.mutation(api.discovery.request, { id: initial.mates[0].userId });
    const next = await f.alice.query(api.discovery.suggestions, {});
    expect(next.mates).toHaveLength(12);
    expect(next.mates.some((m) => m.userId === initial.mates[0].userId)).toBe(false);
  });
});
describe('private online FINDEX', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('requires authentication and mutual approval before journal access', async () => {
    const f = await fixture();
    await expect(f.t.query(api.social.home, {})).rejects.toThrow('Sign in');
    await f.t.mutation(internal.records.publish, { owner: f.ids[0], record, historic: true });
    expect(await f.bob.query(api.social.collection, { id: f.ids[0] })).toBeNull();
    await link(f);
    expect((await f.bob.query(api.social.collection, { id: f.ids[0] }))?.species).toEqual({
      '001': 1,
    });
    expect(await f.eve.query(api.social.collection, { id: f.ids[0] })).toBeNull();
    expect(await f.eve.query(api.social.feed, {})).toEqual([]);
  });
  it('expires and rotates QR invites; rejects self-invites and forged approvals', async () => {
    const f = await fixture();
    const token = 'x'.repeat(43),
      next = 'y'.repeat(43);
    await f.t.mutation(internal.social.saveInvite, {
      owner: f.ids[0],
      hash: bytesToHex(sha256(token)),
    });
    await expect(f.alice.mutation(api.social.request, { token })).rejects.toThrow('own FINDEX');
    await f.bob.mutation(api.social.request, { token });
    const h = await f.alice.query(api.social.home, {});
    await expect(
      f.eve.mutation(api.social.answer, { id: h.incoming[0]._id, accept: true }),
    ).rejects.toThrow('unavailable');
    expect(await f.bob.query(api.social.collection, { id: f.ids[0] })).toBeNull();
    await f.t.mutation(internal.social.saveInvite, {
      owner: f.ids[0],
      hash: bytesToHex(sha256(next)),
    });
    expect(await f.bob.query(api.social.preview, { token })).toBeNull();
    await f.t.run(async (ctx) => {
      const invite = (await ctx.db.query('invites').collect())[0];
      await ctx.db.patch(invite._id, { expiresAt: 0 });
    });
    expect(await f.bob.query(api.social.preview, { token: next })).toBeNull();
    await expect(f.bob.mutation(api.social.request, { token: next })).rejects.toThrow('expired');
  });
  it('repeated requests and accepts create only one friendship', async () => {
    const f = await fixture();
    await link(f);
    await f.bob.mutation(api.social.request, { token: 'x'.repeat(43) });
    expect((await f.alice.query(api.social.home, {})).friends).toHaveLength(1);
    expect((await f.alice.query(api.social.home, {})).incoming).toHaveLength(0);
  });
  it('unfriending revokes feeds, collections, photos and alerts immediately', async () => {
    const f = await fixture();
    await link(f);
    const id = await f.t.mutation(internal.records.publish, {
      owner: f.ids[0],
      record,
      historic: false,
    });
    expect(await f.bob.query(api.social.feed, {})).toHaveLength(1);
    expect(await f.bob.query(api.social.alerts, {})).toHaveLength(1);
    await f.bob.mutation(api.social.unfriend, { id: f.ids[0] });
    expect(await f.bob.query(api.social.collection, { id: f.ids[0] })).toBeNull();
    expect(await f.bob.query(api.social.feed, {})).toEqual([]);
    expect(await f.bob.query(api.social.alerts, {})).toEqual([]);
    await expect(f.bob.query(internal.records.photo, { id })).rejects.toThrow('private');
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it('new catches alert once; retries, edits, sightings and history do not', async () => {
    const f = await fixture();
    await link(f);
    const id = await f.t.mutation(internal.records.publish, {
      owner: f.ids[0],
      record,
      historic: false,
    });
    await f.t.mutation(internal.records.publish, {
      owner: f.ids[0],
      record: { ...record, length: '42' },
      historic: false,
    });
    await f.t.mutation(internal.records.publish, {
      owner: f.ids[0],
      record: { ...record, localId: 'history' },
      historic: true,
    });
    await f.t.mutation(internal.records.publish, {
      owner: f.ids[0],
      record: { ...record, localId: 'sighting', kind: 'sighting' },
      historic: false,
    });
    expect(await f.bob.query(api.social.alerts, {})).toHaveLength(1);
    expect(await f.bob.query(api.social.feed, {})).toHaveLength(3);
    await f.bob.mutation(api.records.remove, { localId: record.localId });
    expect((await f.alice.query(api.social.collection, { id: f.ids[0] }))?.total).toBe(3);
    await f.alice.mutation(api.records.remove, { localId: record.localId });
    expect(await f.bob.query(api.social.alerts, {})).toHaveLength(0);
    expect(await f.t.run((ctx) => ctx.db.get(id))).toBeNull();
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it('mute disables live alerts and scheduled push delivery', async () => {
    const f = await fixture();
    await link(f);
    await f.t.mutation(internal.records.publish, { owner: f.ids[0], record, historic: false });
    const n = (await f.bob.query(api.social.alerts, {}))[0];
    await f.bob.mutation(api.social.preferences, { autoShare: false, muteAlerts: true });
    expect(await f.bob.query(api.social.alerts, {})).toEqual([]);
    expect(await f.t.query(internal.subscriptions.delivery, { alertId: n.id })).toBeNull();
    await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it('rejects invalid species, invalid dates, mammal catches and malformed photo uploads', async () => {
    const f = await fixture();
    for (const bad of [
      { fishId: '999' },
      { fishId: '075' },
      { date: '2026-02-31' },
      { quantity: 0 },
      { length: 'NaN' },
    ])
      await expect(
        f.t.mutation(internal.records.publish, {
          owner: f.ids[0],
          record: { ...record, ...bad },
          historic: true,
        }),
      ).rejects.toThrow('Invalid catch');
    await expect(
      f.alice.action(api.sharing.publish, {
        record,
        photo: 'data:image/jpeg;base64,YWJj',
        historic: true,
      }),
    ).rejects.toThrow('Invalid photo');
  });
  it('private photos have no public URL and storage disappears when unshared', async () => {
    const f = await fixture();
    await link(f);
    const photo = 'data:image/jpeg;base64,/9j/2Q==';
    const id = await f.alice.action(api.sharing.publish, { record, photo, historic: true });
    expect(await f.bob.action(api.sharing.photo, { id })).toBe(photo);
    await expect(f.eve.action(api.sharing.photo, { id })).rejects.toThrow('private');
    const cloud = await f.t.run((ctx) => ctx.db.get(id));
    expect((await f.bob.query(api.social.feed, {}))[0].photoId).toBeUndefined();
    await f.alice.mutation(api.records.remove, { localId: record.localId });
    expect(await f.t.run((ctx) => ctx.storage.get(cloud!.photoId!))).toBeNull();
  });
  it('rejects arbitrary push URLs and limits invite generation', async () => {
    const f = await fixture();
    await expect(
      f.alice.mutation(api.subscriptions.subscribe, {
        endpoint: 'https://attacker.example/ssrf',
        p256dh: 'x'.repeat(87),
        auth: 'x'.repeat(22),
      }),
    ).rejects.toThrow('Unsupported');
    for (let i = 0; i < 30; i++)
      await f.t.mutation(internal.social.saveInvite, { owner: f.ids[0], hash: `hash${i}` });
    await expect(
      f.t.mutation(internal.social.saveInvite, { owner: f.ids[0], hash: '31' }),
    ).rejects.toThrow('wait');
  });
});
describe('device isolation and client payloads', () => {
  it('uses separate recovery keys and strictly parses same-origin invites', () => {
    const r = newRecovery();
    expect(parseRecovery(r)).toEqual(r);
    expect(newRecovery().secret).not.toBe(r.secret);
    expect(() => parseRecovery({ app: 'FINDEX', version: 2 })).toThrow();
    const token = 'a'.repeat(43);
    expect(inviteToken(`https://findex.test/#friend=${token}`, 'https://findex.test')).toBe(token);
    expect(inviteToken(`https://evil.test/#friend=${token}`, 'https://findex.test')).toBeNull();
    expect(inviteToken('javascript:alert(1)', 'https://findex.test')).toBeNull();
  });
  it('never includes locations, notes or full photos in the metadata payload', () => {
    const r = {
      id: '1',
      fishId: '001',
      date: '2026-01-01',
      location: 'Secret spot',
      notes: 'Private notes',
      length: '40',
      released: true,
      photo: null,
      createdAt: 'today',
    } satisfies CatchRecord;
    const shared = sharedFields(r);
    expect(shared).not.toHaveProperty('location');
    expect(shared).not.toHaveProperty('notes');
    expect(shared).not.toHaveProperty('photo');
    expect(shared.kind).toBe('catch');
  });
  it('keeps queued catches bound to their account and preserves newer edits', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
    });
    vi.stubGlobal('window', { dispatchEvent: () => {} });
    enqueue('alice', 'one', true);
    const old = readOutbox().jobs[0];
    enqueue('alice', 'one', false);
    finishJob(old);
    expect(readOutbox().jobs[0].remove).toBe(true);
    expect(() => enqueue('bob', 'one', true)).toThrow('different online profile');
    expect(readOutbox().owners.one).toBe('alice');
    expect(readOutbox().jobs.filter((j) => j.user === 'bob')).toEqual([]);
    vi.unstubAllGlobals();
  });
  it('accepts supported HTTPS push endpoints and rejects credential and domain tricks', () => {
    expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/123')).toBe(true);
    expect(validPushEndpoint('https://web.push.apple.com/a')).toBe(true);
    for (const endpoint of [
      'http://fcm.googleapis.com/a',
      'https://fcm.googleapis.com.evil.com/a',
      'https://user@fcm.googleapis.com/a',
      'https://127.0.0.1/a',
      'https://evil.push.apple.com.evil/a',
    ])
      expect(validPushEndpoint(endpoint)).toBe(false);
    expect(validPushKeys('x'.repeat(87), 'y'.repeat(22))).toBe(true);
    expect(validPushKeys('invalid', 'bad')).toBe(false);
  });
});
