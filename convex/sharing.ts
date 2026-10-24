'use node';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v, ConvexError } from 'convex/values';
import { recordFields, validateRecord } from './records';
import type { Id } from './_generated/dataModel';
export const publish = action({
  args: { record: v.object(recordFields), photo: v.optional(v.string()), historic: v.boolean() },
  handler: async (ctx, args): Promise<Id<'sharedCatches'>> => {
    const owner = await ctx.runQuery(internal.social.viewer, {});
    validateRecord(args.record);
    if (args.record.kind === 'catch' && !args.photo)
      throw new ConvexError('Add a photo to confirm a shared catch.');
    let photoId: Id<'_storage'> | undefined;
    try {
      if (args.photo) {
        if (
          args.photo.length > 450000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(args.photo)
        )
          throw new ConvexError('Shared photos must be JPEG thumbnails under 330 KB.');
        const data = Buffer.from(args.photo.split(',')[1], 'base64');
        if (data[0] !== 255 || data[1] !== 216 || data[2] !== 255)
          throw new ConvexError('Invalid photo.');
        photoId = await ctx.storage.store(new Blob([data], { type: 'image/jpeg' }));
      }
      return await ctx.runMutation(internal.records.publish, {
        owner,
        record: args.record,
        photoId,
        historic: args.historic,
      });
    } catch (error) {
      if (photoId) await ctx.storage.delete(photoId);
      throw error;
    }
  },
});
export const photo = action({
  args: { id: v.id('sharedCatches') },
  handler: async (ctx, { id }): Promise<string | null> => {
    const idPhoto = await ctx.runQuery(internal.records.photo, { id });
    if (!idPhoto) return null;
    const blob = await ctx.storage.get(idPhoto);
    return blob
      ? `data:image/jpeg;base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
      : null;
  },
});
