import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx);
  if (!id || !(await ctx.db.get(id))) throw new ConvexError('Sign in to your online FINDEX.');
  return id;
}
export async function profileFor(ctx: QueryCtx | MutationCtx, id: Id<'users'>) {
  return ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', id))
    .unique();
}
export async function requireProfile(ctx: QueryCtx | MutationCtx) {
  const id = await requireUser(ctx);
  const profile = await profileFor(ctx, id);
  if (!profile) throw new ConvexError('Create your online profile first.');
  return profile;
}
export function pair(a: Id<'users'>, b: Id<'users'>) {
  return a < b ? ([a, b] as const) : ([b, a] as const);
}
export async function friendship(ctx: QueryCtx | MutationCtx, a: Id<'users'>, b: Id<'users'>) {
  const [first, second] = pair(a, b);
  return ctx.db
    .query('friendships')
    .withIndex('by_pair', (q) => q.eq('a', first).eq('b', second))
    .unique();
}
export async function friendIds(ctx: QueryCtx | MutationCtx, id: Id<'users'>) {
  const [left, right] = await Promise.all([
    ctx.db
      .query('friendships')
      .withIndex('by_a', (q) => q.eq('a', id))
      .collect(),
    ctx.db
      .query('friendships')
      .withIndex('by_b', (q) => q.eq('b', id))
      .collect(),
  ]);
  return [...left.map((e) => e.b), ...right.map((e) => e.a)];
}
export async function rateLimit(
  ctx: MutationCtx,
  id: Id<'users'>,
  scope: string,
  max: number,
  period = 3600000,
) {
  const row = await ctx.db
    .query('rateLimits')
    .withIndex('by_user_scope', (q) => q.eq('userId', id).eq('scope', scope))
    .unique();
  const now = Date.now();
  if (row && now - row.start < period) {
    if (row.count >= max) throw new ConvexError('Please wait before trying again.');
    await ctx.db.patch(row._id, { count: row.count + 1 });
  } else if (row) await ctx.db.patch(row._id, { start: now, count: 1 });
  else await ctx.db.insert('rateLimits', { userId: id, scope, start: now, count: 1 });
}
export const publicProfile = (profile: { userId: Id<'users'>; name: string; avatar: string }) => ({
  userId: profile.userId,
  name: profile.name,
  avatar: profile.avatar,
});
