'use node';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { randomBytes, createHash } from 'node:crypto';
export const create = action({
  args: {},
  handler: async (ctx) => {
    const owner = await ctx.runQuery(internal.social.viewer, {});
    const token = randomBytes(32).toString('base64url');
    await ctx.runMutation(internal.social.saveInvite, {
      owner,
      hash: createHash('sha256').update(token).digest('hex'),
    });
    return { token, expiresAt: Date.now() + 600000 };
  },
});
