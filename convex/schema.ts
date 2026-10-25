import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';
export default defineSchema({
  ...authTables,
  catchLocations: defineTable({
    owner: v.id('users'), localId: v.string(), fishId: v.string(), date: v.string(), quantity: v.number(),
    position: v.object({ latitude: v.number(), longitude: v.number(), accuracy: v.number(), capturedAt: v.number() }),
    updatedAt: v.number(),
  }).index('by_owner_local', ['owner', 'localId']).index('by_date', ['date']).index('by_species_date', ['fishId', 'date']),
  profiles: defineTable({
    userId: v.id('users'),
    name: v.string(),
    avatar: v.string(),
    autoShare: v.boolean(),
    muteAlerts: v.boolean(),
    createdAt: v.number(),
  }).index('by_user', ['userId']),
  invites: defineTable({ owner: v.id('users'), hash: v.string(), expiresAt: v.number() })
    .index('by_hash', ['hash'])
    .index('by_owner', ['owner']),
  requests: defineTable({ from: v.id('users'), to: v.id('users'), createdAt: v.number() })
    .index('by_from', ['from'])
    .index('by_to', ['to'])
    .index('by_pair', ['from', 'to']),
  friendships: defineTable({ a: v.id('users'), b: v.id('users'), createdAt: v.number() })
    .index('by_a', ['a'])
    .index('by_b', ['b'])
    .index('by_pair', ['a', 'b']),
  sharedCatches: defineTable({
    owner: v.id('users'),
    localId: v.string(),
    fishId: v.string(),
    customName: v.optional(v.string()),
    kind: v.union(v.literal('catch'), v.literal('sighting')),
    date: v.string(),
    length: v.string(),
    quantity: v.number(),
    released: v.boolean(),
    photoId: v.optional(v.id('_storage')),
    publishedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner_local', ['owner', 'localId'])
    .index('by_owner_time', ['owner', 'publishedAt']),
  feed: defineTable({
    recipient: v.id('users'),
    author: v.id('users'),
    recordId: v.id('sharedCatches'),
    publishedAt: v.number(),
  })
    .index('by_recipient_time', ['recipient', 'publishedAt'])
    .index('by_record', ['recordId'])
    .index('by_recipient_record', ['recipient', 'recordId']),
  notifications: defineTable({
    recipient: v.id('users'),
    author: v.id('users'),
    recordId: v.id('sharedCatches'),
    createdAt: v.number(),
    read: v.boolean(),
  })
    .index('by_recipient_time', ['recipient', 'createdAt'])
    .index('by_record', ['recordId']),
  pushSubscriptions: defineTable({
    userId: v.id('users'),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_endpoint', ['endpoint']),
  rateLimits: defineTable({
    userId: v.id('users'),
    scope: v.string(),
    start: v.number(),
    count: v.number(),
  }).index('by_user_scope', ['userId', 'scope']),
});
