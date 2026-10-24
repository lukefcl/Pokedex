'use node';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import webpush from 'web-push';
import { validPushEndpoint } from '../lib/social/push-validation';
export const deliver = internalAction({
  args: { alertId: v.id('notifications') },
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.subscriptions.delivery, args);
    const pub = process.env.VAPID_PUBLIC_KEY,
      priv = process.env.VAPID_PRIVATE_KEY;
    if (!data || !pub || !priv) return;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'https://sleek-cheetah-466.convex.site',
      pub,
      priv,
    );
    await Promise.all(
      data.subscriptions.map(async (s) => {
        if (!validPushEndpoint(s.endpoint)) return;
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: data.title, body: data.body, tag: data.tag }),
            { TTL: 3600, timeout: 10000 },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410)
            await ctx.runMutation(internal.subscriptions.prune, { id: s._id });
          else console.error('Push delivery failed', status || 'network');
        }
      }),
    );
  },
});
