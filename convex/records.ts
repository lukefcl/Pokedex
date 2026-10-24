import { mutation, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v, ConvexError } from 'convex/values';
import { requireProfile, friendship, friendIds, profileFor, rateLimit } from './access';
import { findFish } from '../lib/fish';
export const recordFields = {
  localId: v.string(),
  fishId: v.string(),
  customName: v.optional(v.string()),
  kind: v.union(v.literal('catch'), v.literal('sighting')),
  date: v.string(),
  length: v.string(),
  quantity: v.number(),
  released: v.boolean(),
};
export function validateRecord(r: {
  localId: string;
  fishId: string;
  customName?: string;
  kind: string;
  date: string;
  length: string;
  quantity: number;
}) {
  const fish = findFish(r.fishId);
  if (
    !r.localId ||
    r.localId.length > 100 ||
    !fish ||
    (r.customName && r.customName.length > 120) ||
    (r.fishId === 'other' && !r.customName?.trim()) ||
    (fish.sightingOnly && r.kind !== 'sighting') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    !Number.isFinite(Date.parse(r.date)) ||
    new Date(r.date).toISOString().slice(0, 10) !== r.date ||
    r.date > new Date(Date.now() + 86400000).toISOString().slice(0, 10) ||
    !Number.isInteger(r.quantity) ||
    r.quantity < 1 ||
    r.quantity > 9999 ||
    (r.length !== '' &&
      (!Number.isFinite(Number(r.length)) || Number(r.length) <= 0 || Number(r.length) > 3000))
  )
    throw new ConvexError('Invalid catch details.');
}
export const publish = internalMutation({
  args: {
    owner: v.id('users'),
    record: v.object(recordFields),
    photoId: v.optional(v.id('_storage')),
    historic: v.boolean(),
  },
  handler: async (ctx, { owner, record, photoId, historic }) => {
    validateRecord(record);
    const p = await profileFor(ctx, owner);
    if (!p) throw new ConvexError('Profile unavailable.');
    await rateLimit(ctx, owner, 'publish', 600);
    const old = await ctx.db
      .query('sharedCatches')
      .withIndex('by_owner_local', (q) => q.eq('owner', owner).eq('localId', record.localId))
      .unique();
    if (old) {
      await ctx.db.patch(old._id, { ...record, photoId, updatedAt: Date.now() });
      if (old.photoId) await ctx.storage.delete(old.photoId);
      return old._id;
    }
    const count = await ctx.db
      .query('sharedCatches')
      .withIndex('by_owner_local', (q) => q.eq('owner', owner))
      .take(5000);
    if (count.length >= 5000)
      throw new ConvexError('Online journal limit reached (5,000 records).');
    const id = await ctx.db.insert('sharedCatches', {
      ...record,
      owner,
      photoId,
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
    if (!historic && record.kind === 'catch') {
      for (const recipient of await friendIds(ctx, owner)) {
        const mate = await profileFor(ctx, recipient);
        if (mate?.muteAlerts) continue;
        const alertId = await ctx.db.insert('notifications', {
          recipient,
          author: owner,
          recordId: id,
          createdAt: Date.now(),
          read: false,
        });
        await ctx.scheduler.runAfter(0, internal.push.deliver, { alertId });
      }
    }
    return id;
  },
});
export const remove = mutation({
  args: { localId: v.string() },
  handler: async (ctx, { localId }) => {
    const p = await requireProfile(ctx);
    const old = await ctx.db
      .query('sharedCatches')
      .withIndex('by_owner_local', (q) => q.eq('owner', p.userId).eq('localId', localId))
      .unique();
    if (!old) return;
    if (old.photoId) await ctx.storage.delete(old.photoId);
    for (const n of await ctx.db
      .query('notifications')
      .withIndex('by_record', (q) => q.eq('recordId', old._id))
      .collect())
      await ctx.db.delete(n._id);
    await ctx.db.delete(old._id);
  },
});
export const photo = internalQuery({
  args: { id: v.id('sharedCatches') },
  handler: async (ctx, { id }) => {
    const p = await requireProfile(ctx);
    const r = await ctx.db.get(id);
    if (!r || (r.owner !== p.userId && !(await friendship(ctx, p.userId, r.owner))))
      throw new ConvexError('This photo is private.');
    return r.photoId || null;
  },
});
