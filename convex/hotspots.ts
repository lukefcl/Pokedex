import { mutation, query } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { requireProfile, rateLimit } from './access';
import { validPosition } from '../lib/catch-location';
import { validateRecord } from './records';

export function adminId(id: string) {
  return (process.env.FINDEX_ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(id);
}
export const access = query({
  args: {},
  handler: async (ctx) => ({ isAdmin: adminId((await requireProfile(ctx)).userId) }),
});
export const positionFields = { latitude: v.number(), longitude: v.number(), accuracy: v.number(), capturedAt: v.number() };
export const upsert = mutation({
  args: { localId: v.string(), fishId: v.string(), date: v.string(), quantity: v.number(), position: v.object(positionFields) },
  handler: async (ctx, args) => {
    const me = await requireProfile(ctx);
    validateRecord({ ...args, kind: 'catch', length: '', customName: args.fishId === 'other' ? 'Unidentified' : undefined });
    if (!validPosition(args.position) || args.position.capturedAt > Date.now() + 300000) throw new ConvexError('Invalid catch position.');
    await rateLimit(ctx, me.userId, 'locations', 600);
    const old = await ctx.db.query('catchLocations').withIndex('by_owner_local', (q) => q.eq('owner', me.userId).eq('localId', args.localId)).unique();
    if (old) await ctx.db.patch(old._id, { ...args, updatedAt: Date.now() });
    else {
      const count = await ctx.db.query('catchLocations').withIndex('by_owner_local', (q) => q.eq('owner', me.userId)).take(5000);
      if (count.length >= 5000) throw new ConvexError('Location journal limit reached (5,000 catches).');
      await ctx.db.insert('catchLocations', { ...args, owner: me.userId, updatedAt: Date.now() });
    }
  },
});
export const remove = mutation({
  args: { localId: v.string() },
  handler: async (ctx, { localId }) => {
    const me = await requireProfile(ctx);
    const row = await ctx.db.query('catchLocations').withIndex('by_owner_local', (q) => q.eq('owner', me.userId).eq('localId', localId)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});
export const map = query({
  args: { since: v.string(), fishId: v.string() },
  handler: async (ctx, { since, fishId }) => {
    const me = await requireProfile(ctx);
    if (!adminId(me.userId)) throw new ConvexError('Admin access required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new ConvexError('Invalid date filter.');
    const rows = fishId
      ? await ctx.db.query('catchLocations').withIndex('by_species_date', (q) => q.eq('fishId', fishId).gte('date', since)).order('desc').take(10001)
      : await ctx.db.query('catchLocations').withIndex('by_date', (q) => q.gte('date', since)).order('desc').take(10001);
    return {
      truncated: rows.length > 10000,
      points: rows.slice(0, 10000).map((r) => ({ latitude: r.position.latitude, longitude: r.position.longitude, accuracy: r.position.accuracy, fishId: r.fishId, date: r.date, quantity: r.quantity })),
    };
  },
});
