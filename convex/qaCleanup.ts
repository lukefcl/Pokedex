import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
export const run = internalMutation({
  args: { accounts: v.array(v.object({ id: v.id('users'), email: v.string() })) },
  handler: async (ctx, { accounts }) => {
    for (const { id, email } of accounts) {
      const user = await ctx.db.get(id);
      const profile = await ctx.db.query('profiles').withIndex('by_user', q => q.eq('userId', id)).unique();
      if (!user) continue;
      if (user.email !== email || !/^findex-[a-f0-9]{32}@device.invalid$/.test(email) || !profile?.name.startsWith('QA ')) throw new Error('Not an exact QA account');
      const sessions = await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', id)).collect();
      for (const session of sessions) {
        for (const token of await ctx.db.query('authRefreshTokens').withIndex('sessionId', q => q.eq('sessionId', session._id)).collect()) await ctx.db.delete(token._id);
        await ctx.db.delete(session._id);
      }
      for (const account of await ctx.db.query('authAccounts').withIndex('userIdAndProvider', q => q.eq('userId', id)).collect()) {
        for (const code of await ctx.db.query('authVerificationCodes').withIndex('accountId', q => q.eq('accountId', account._id)).collect()) await ctx.db.delete(code._id);
        await ctx.db.delete(account._id);
      }
      for (const row of await ctx.db.query('authRateLimits').withIndex('identifier', q => q.eq('identifier', email)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query('invites').withIndex('by_owner', q => q.eq('owner', id)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query('requests').withIndex('by_from', q => q.eq('from', id)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query('requests').withIndex('by_to', q => q.eq('to', id)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query('friendships').withIndex('by_a', q => q.eq('a', id)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query('friendships').withIndex('by_b', q => q.eq('b', id)).collect()) await ctx.db.delete(row._id);
      for (const row of await ctx.db.query('rateLimits').withIndex('by_user_scope', q => q.eq('userId', id)).collect()) await ctx.db.delete(row._id);
      await ctx.db.delete(profile._id);
      await ctx.db.delete(id);
    }
    return 'Removed only the three temporary suggested-mates QA profiles and their sessions, requests and links.';
  },
});
