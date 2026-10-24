import { query, mutation, internalMutation, internalQuery } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import {
  requireProfile,
  requireUser,
  profileFor,
  friendIds,
  friendship,
  pair,
  rateLimit,
  publicProfile,
} from './access';
import type { Id } from './_generated/dataModel';
const hash = (s: string) => bytesToHex(sha256(s));
export const me = query({
  args: {},
  handler: async (ctx) => {
    const id = await getAuthUserId(ctx);
    return id ? await profileFor(ctx, id) : null;
  },
});
export const account = query({
  args: {},
  handler: async (ctx) => {
    const id = await requireUser(ctx);
    return (await ctx.db.get(id))?.email || null;
  },
});
export const setup = mutation({
  args: { name: v.string(), avatar: v.string() },
  handler: async (ctx, args) => {
    const id = await requireUser(ctx);
    const name = args.name.trim();
    if (
      name.length < 2 ||
      name.length > 30 ||
      !/^\d{3}$/.test(args.avatar) ||
      Number(args.avatar) < 1 ||
      Number(args.avatar) > 85
    )
      throw new ConvexError('Choose a name (2–30 characters) and a species avatar.');
    const old = await profileFor(ctx, id);
    if (old) {
      await ctx.db.patch(old._id, { name, avatar: args.avatar });
      return;
    }
    await ctx.db.insert('profiles', {
      userId: id,
      name,
      avatar: args.avatar,
      autoShare: false,
      muteAlerts: false,
      createdAt: Date.now(),
    });
  },
});
export const preferences = mutation({
  args: { autoShare: v.boolean(), muteAlerts: v.boolean() },
  handler: async (ctx, args) => {
    const p = await requireProfile(ctx);
    await ctx.db.patch(p._id, args);
  },
});
export const home = query({
  args: {},
  handler: async (ctx) => {
    const p = await requireProfile(ctx);
    const ids = await friendIds(ctx, p.userId);
    const friends = (await Promise.all(ids.map((id) => profileFor(ctx, id))))
      .filter((p) => p !== null)
      .map(publicProfile);
    const incoming = await ctx.db
      .query('requests')
      .withIndex('by_to', (q) => q.eq('to', p.userId))
      .collect();
    const outgoing = await ctx.db
      .query('requests')
      .withIndex('by_from', (q) => q.eq('from', p.userId))
      .collect();
    return {
      friends,
      incoming: await Promise.all(
        incoming.map(async (r) => ({
          ...r,
          profile: publicProfile((await profileFor(ctx, r.from))!),
        })),
      ),
      outgoing: await Promise.all(
        outgoing.map(async (r) => ({
          ...r,
          profile: publicProfile((await profileFor(ctx, r.to))!),
        })),
      ),
    };
  },
});
export const saveInvite = internalMutation({
  args: { owner: v.id('users'), hash: v.string() },
  handler: async (ctx, args) => {
    if (!(await profileFor(ctx, args.owner))) throw new ConvexError('Create a profile first.');
    await rateLimit(ctx, args.owner, 'invite', 30);
    for (const old of await ctx.db
      .query('invites')
      .withIndex('by_owner', (q) => q.eq('owner', args.owner))
      .collect())
      await ctx.db.delete(old._id);
    await ctx.db.insert('invites', { ...args, expiresAt: Date.now() + 10 * 60 * 1000 });
  },
});
export const preview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireProfile(ctx);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const i = await ctx.db
      .query('invites')
      .withIndex('by_hash', (q) => q.eq('hash', hash(token)))
      .unique();
    if (!i || i.expiresAt < Date.now()) return null;
    const p = await profileFor(ctx, i.owner);
    return p ? publicProfile(p) : null;
  },
});
export const request = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const p = await requireProfile(ctx);
    await rateLimit(ctx, p.userId, 'requests', 30);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ConvexError('Invalid invite.');
    const i = await ctx.db
      .query('invites')
      .withIndex('by_hash', (q) => q.eq('hash', hash(token)))
      .unique();
    if (!i || i.expiresAt < Date.now())
      throw new ConvexError('This invite expired. Ask your mate to show a new QR.');
    if (i.owner === p.userId) throw new ConvexError('This is your own FINDEX.');
    if (await friendship(ctx, p.userId, i.owner)) return;
    const [friends, otherFriends] = await Promise.all([
      friendIds(ctx, p.userId),
      friendIds(ctx, i.owner),
    ]);
    if (friends.length >= 50 || otherFriends.length >= 50)
      throw new ConvexError('A FINDEX can have up to 50 mates.');
    const old = await ctx.db
      .query('requests')
      .withIndex('by_pair', (q) => q.eq('from', p.userId).eq('to', i.owner))
      .unique();
    if (!old)
      await ctx.db.insert('requests', { from: p.userId, to: i.owner, createdAt: Date.now() });
  },
});
export const answer = mutation({
  args: { id: v.id('requests'), accept: v.boolean() },
  handler: async (ctx, { id, accept }) => {
    const p = await requireProfile(ctx);
    const r = await ctx.db.get(id);
    if (!r || r.to !== p.userId) throw new ConvexError('Request unavailable.');
    if (accept) {
      if (
        (await friendIds(ctx, p.userId)).length >= 50 ||
        (await friendIds(ctx, r.from)).length >= 50
      )
        throw new ConvexError('A FINDEX can have up to 50 mates.');
      if (!(await friendship(ctx, r.from, r.to))) {
        const [a, b] = pair(r.from, r.to);
        await ctx.db.insert('friendships', { a, b, createdAt: Date.now() });
      }
    }
    await ctx.db.delete(id);
    const reverse = await ctx.db
      .query('requests')
      .withIndex('by_pair', (q) => q.eq('from', r.to).eq('to', r.from))
      .unique();
    if (reverse) await ctx.db.delete(reverse._id);
  },
});
export const cancelRequest = mutation({
  args: { id: v.id('requests') },
  handler: async (ctx, { id }) => {
    const p = await requireProfile(ctx);
    const r = await ctx.db.get(id);
    if (r?.from === p.userId) await ctx.db.delete(id);
  },
});
export const unfriend = mutation({
  args: { id: v.id('users') },
  handler: async (ctx, { id }) => {
    const p = await requireProfile(ctx);
    const f = await friendship(ctx, p.userId, id);
    if (f) await ctx.db.delete(f._id);
  },
});
export const feed = query({
  args: {},
  handler: async (ctx) => {
    const p = await requireProfile(ctx);
    const ids = await friendIds(ctx, p.userId);
    const records = (
      await Promise.all(
        ids.map(async (id) => {
          const author = await profileFor(ctx, id);
          return (
            await ctx.db
              .query('sharedCatches')
              .withIndex('by_owner_time', (q) => q.eq('owner', id))
              .order('desc')
              .take(20)
          ).map((r) => ({
            ...r,
            photoId: undefined,
            hasPhoto: !!r.photoId,
            author: publicProfile(author!),
          }));
        }),
      )
    ).flat();
    return records.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 60);
  },
});
export const collection = query({
  args: { id: v.id('users') },
  handler: async (ctx, { id }) => {
    const p = await requireProfile(ctx);
    if (id !== p.userId && !(await friendship(ctx, p.userId, id))) return null;
    const author = await profileFor(ctx, id);
    if (!author) return null;
    const all = await ctx.db
      .query('sharedCatches')
      .withIndex('by_owner_time', (q) => q.eq('owner', id))
      .order('desc')
      .take(5000);
    const species: Record<string, number> = {};
    for (const r of all) species[r.fishId] = (species[r.fishId] || 0) + 1;
    return {
      profile: publicProfile(author),
      species,
      total: all.length,
      recent: all
        .slice(0, 30)
        .map((r) => ({
          ...r,
          photoId: undefined,
          hasPhoto: !!r.photoId,
          author: publicProfile(author),
        })),
    };
  },
});
export const alerts = query({
  args: {},
  handler: async (ctx) => {
    const p = await requireProfile(ctx);
    if (p.muteAlerts) return [];
    const ids = new Set(await friendIds(ctx, p.userId));
    const rows = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_time', (q) => q.eq('recipient', p.userId))
      .order('desc')
      .take(30);
    const result = [];
    for (const n of rows) {
      if (!ids.has(n.author)) continue;
      const r = await ctx.db.get(n.recordId);
      const a = await profileFor(ctx, n.author);
      if (r && a)
        result.push({
          id: n._id,
          createdAt: n.createdAt,
          name: a.name,
          fishId: r.fishId,
          customName: r.customName,
        });
    }
    return result;
  },
});
export const viewer = internalQuery({
  args: {},
  handler: async (ctx) => {
    const p = await requireProfile(ctx);
    return p.userId;
  },
});
