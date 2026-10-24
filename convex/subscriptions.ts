import { query, mutation, internalQuery, internalMutation } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { requireProfile, friendship, profileFor, rateLimit } from './access';
import { validPushEndpoint, validPushKeys } from '../lib/social/push-validation';
import { findFish } from '../lib/fish';
export const key = query({
  args: {},
  handler: async (ctx) => {
    await requireProfile(ctx);
    return process.env.VAPID_PUBLIC_KEY || null;
  },
});
export const subscribe = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, args) => {
    const p = await requireProfile(ctx);
    await rateLimit(ctx, p.userId, 'push', 30);
    if (!validPushEndpoint(args.endpoint) || !validPushKeys(args.p256dh, args.auth))
      throw new ConvexError('Unsupported push subscription.');
    const old = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .unique();
    if (old) {
      await ctx.db.patch(old._id, { ...args, userId: p.userId, updatedAt: Date.now() });
      return;
    }
    const devices = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', p.userId))
      .collect();
    if (devices.length >= 5)
      await ctx.db.delete(devices.sort((a, b) => a.updatedAt - b.updatedAt)[0]._id);
    await ctx.db.insert('pushSubscriptions', { ...args, userId: p.userId, updatedAt: Date.now() });
  },
});
export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const p = await requireProfile(ctx);
    const old = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', endpoint))
      .unique();
    if (old?.userId === p.userId) await ctx.db.delete(old._id);
  },
});
export const delivery = internalQuery({
  args: { alertId: v.id('notifications') },
  handler: async (ctx, { alertId }) => {
    const n = await ctx.db.get(alertId);
    if (!n) return null;
    const p = await profileFor(ctx, n.recipient);
    const author = await profileFor(ctx, n.author);
    const record = await ctx.db.get(n.recordId);
    if (!p || p.muteAlerts || !record || !author || !(await friendship(ctx, n.author, n.recipient)))
      return null;
    const subscriptions = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', n.recipient))
      .collect();
    return {
      subscriptions,
      title: `${author.name} caught a fish!`,
      body: `${record.quantity > 1 ? `${record.quantity} × ` : ''}${record.customName || findFish(record.fishId)?.name || 'New catch'} · Open your mates’ feed.`,
      tag: String(n._id),
    };
  },
});
export const prune = internalMutation({
  args: { id: v.id('pushSubscriptions') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
