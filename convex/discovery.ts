import { query, mutation } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { friendIds, profileFor, publicProfile, rateLimit, requireProfile } from './access';
import type { Id } from './_generated/dataModel';

export const suggestions = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireProfile(ctx);
    const friends = await friendIds(ctx, me.userId);
    const [incoming, outgoing] = await Promise.all([
      ctx.db.query('requests').withIndex('by_to', (q) => q.eq('to', me.userId)).collect(),
      ctx.db.query('requests').withIndex('by_from', (q) => q.eq('from', me.userId)).collect(),
    ]);
    const excluded = new Set([me.userId, ...friends, ...incoming.map((r) => r.from), ...outgoing.map((r) => r.to)]);
    const mutuals = new Map<Id<'users'>, number>();
    const crews = await Promise.all(friends.map((id) => friendIds(ctx, id)));
    for (const crew of crews) {
      for (const id of new Set(crew)) {
        if (!excluded.has(id)) mutuals.set(id, (mutuals.get(id) ?? 0) + 1);
      }
    }
    // Rank before reading profiles so a large crew graph doesn't load thousands of profiles.
    const ranked = [...mutuals].sort(([a, n], [b, m]) => m - n || a.localeCompare(b));
    const mates: Array<ReturnType<typeof publicProfile> & { mutualCount: number }> = [];
    for (const [id, mutualCount] of ranked) {
      const profile = await profileFor(ctx, id);
      if (profile) mates.push({ ...publicProfile(profile), mutualCount });
      if (mates.length === 12) break;
    }
    return { mates, hasMates: friends.length > 0 };
  },
});

export const request = mutation({
  args: { id: v.id('users') },
  handler: async (ctx, { id }) => {
    const me = await requireProfile(ctx);
    if (id === me.userId) throw new ConvexError('This is your own FINDEX.');
    const [mine, theirs, profile] = await Promise.all([
      friendIds(ctx, me.userId), friendIds(ctx, id), profileFor(ctx, id),
    ]);
    if (mine.includes(id)) return;
    const myCrew = new Set(mine);
    if (!profile || !theirs.some((mate) => myCrew.has(mate))) {
      throw new ConvexError('This suggestion is no longer available. You need a mutual mate.');
    }
    if (mine.length >= 50 || theirs.length >= 50) {
      throw new ConvexError('A FINDEX can have up to 50 mates.');
    }
    const incoming = await ctx.db.query('requests')
      .withIndex('by_pair', (q) => q.eq('from', id).eq('to', me.userId)).unique();
    if (incoming) throw new ConvexError('This mate already sent you a request. Accept it in Mates.');
    const existing = await ctx.db.query('requests')
      .withIndex('by_pair', (q) => q.eq('from', me.userId).eq('to', id)).unique();
    if (existing) return;
    await rateLimit(ctx, me.userId, 'requests', 30);
    await ctx.db.insert('requests', { from: me.userId, to: id, createdAt: Date.now() });
  },
});
