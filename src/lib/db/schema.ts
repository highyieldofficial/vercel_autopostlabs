import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  json,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const platformTypeEnum = pgEnum('PlatformType', ['shopify', 'woocommerce', 'generic'])
export const ingestionStatusEnum = pgEnum('IngestionStatus', ['pending', 'in_progress', 'completed', 'failed'])
export const socialPlatformEnum = pgEnum('SocialPlatform', ['facebook', 'instagram', 'twitter', 'tiktok', 'pinterest', 'linkedin'])
export const postStatusEnum = pgEnum('PostStatus', ['draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed'])
export const subscriptionTierEnum = pgEnum('SubscriptionTier', ['free', 'pro', 'agency'])
export const subscriptionStatusEnum = pgEnum('SubscriptionStatus', ['active', 'past_due', 'canceled', 'trialing'])

// ─── User ────────────────────────────────────────────────────────────────────

export const users = pgTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  name: text('name'),
  image: text('image'),
  password: text('password'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

// ─── Auth.js tables ──────────────────────────────────────────────────────────

export const accounts = pgTable(
  'Account',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    providerAccountUnique: uniqueIndex('Account_provider_providerAccountId_key').on(
      t.provider,
      t.providerAccountId,
    ),
  }),
)

export const sessions = pgTable('Session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'VerificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => ({
    compoundPk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
)

// ─── Subscription ─────────────────────────────────────────────────────────────

export const subscriptions = pgTable('Subscription', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  whopUserId: text('whopUserId').unique(),
  whopMembershipId: text('whopMembershipId').unique(),
  whopPlanId: text('whopPlanId'),
  tier: subscriptionTierEnum('tier').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  currentPeriodStart: timestamp('currentPeriodStart', { mode: 'date' }),
  currentPeriodEnd: timestamp('currentPeriodEnd', { mode: 'date' }),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').notNull().default(false),
  trialEndsAt: timestamp('trialEndsAt', { mode: 'date' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

// ─── Business ────────────────────────────────────────────────────────────────

export const businesses = pgTable('Business', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  websiteUrl: text('websiteUrl').notNull(),
  platformType: platformTypeEnum('platformType').notNull().default('generic'),
  businessName: text('businessName'),
  brandProfile: json('brandProfile'),
  ingestionStatus: ingestionStatusEnum('ingestionStatus').notNull().default('pending'),
  lastCrawledAt: timestamp('lastCrawledAt', { mode: 'date' }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

// ─── Product ─────────────────────────────────────────────────────────────────

export const products = pgTable(
  'Product',
  {
    id: text('id').primaryKey(),
    businessId: text('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    externalId: text('externalId'),
    name: text('name').notNull(),
    description: text('description'),
    price: numeric('price'),
    currency: text('currency').notNull().default('USD'),
    category: text('category'),
    tags: text('tags').array().notNull().default([]),
    sourceImages: json('sourceImages').array().notNull().default([]),
    storedImageKeys: text('storedImageKeys').array().notNull().default([]),
    variants: json('variants'),
    isActive: boolean('isActive').notNull().default(true),
    shopifyHandle: text('shopifyHandle'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
  },
  (t) => ({
    businessExternalIdUnique: uniqueIndex('Product_businessId_externalId_key').on(
      t.businessId,
      t.externalId,
    ),
  }),
)

// ─── Platform Connection ──────────────────────────────────────────────────────

export const platformConnections = pgTable(
  'PlatformConnection',
  {
    id: text('id').primaryKey(),
    businessId: text('businessId')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    platform: socialPlatformEnum('platform').notNull(),
    accessToken: text('accessToken').notNull(),
    refreshToken: text('refreshToken'),
    tokenExpiresAt: timestamp('tokenExpiresAt', { mode: 'date' }),
    platformAccountId: text('platformAccountId'),
    platformAccountName: text('platformAccountName'),
    permissionsGranted: text('permissionsGranted').array().notNull().default([]),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
  },
  (t) => ({
    businessPlatformUnique: uniqueIndex('PlatformConnection_businessId_platform_key').on(
      t.businessId,
      t.platform,
    ),
  }),
)

// ─── Content Post ─────────────────────────────────────────────────────────────

export const contentPosts = pgTable('ContentPost', {
  id: text('id').primaryKey(),
  businessId: text('businessId')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  productId: text('productId').references(() => products.id),
  platform: socialPlatformEnum('platform').notNull(),
  status: postStatusEnum('status').notNull().default('draft'),
  caption: text('caption'),
  hashtags: text('hashtags').array().notNull().default([]),
  ctaText: text('ctaText'),
  mediaKeys: text('mediaKeys').array().notNull().default([]),
  scheduledAt: timestamp('scheduledAt', { mode: 'date' }),
  publishedAt: timestamp('publishedAt', { mode: 'date' }),
  externalPostId: text('externalPostId'),
  bullmqJobId: text('bullmqJobId'),
  generationMetadata: json('generationMetadata'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
})

// ─── Post Metric Snapshot ─────────────────────────────────────────────────────

export const postMetricSnapshots = pgTable('PostMetricSnapshot', {
  id: text('id').primaryKey(),
  postId: text('postId')
    .notNull()
    .references(() => contentPosts.id, { onDelete: 'cascade' }),
  snapshotAt: timestamp('snapshotAt').defaultNow().notNull(),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  impressions: integer('impressions').notNull().default(0),
  reach: integer('reach').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  saves: integer('saves').notNull().default(0),
  videoViews: integer('videoViews').notNull().default(0),
  engagementRate: numeric('engagementRate'),
})

// ─── Publish Attempt ──────────────────────────────────────────────────────────

export const publishAttempts = pgTable('PublishAttempt', {
  id: text('id').primaryKey(),
  postId: text('postId')
    .notNull()
    .references(() => contentPosts.id, { onDelete: 'cascade' }),
  attemptedAt: timestamp('attemptedAt').defaultNow().notNull(),
  success: boolean('success').notNull(),
  errorCode: text('errorCode'),
  errorMsg: text('errorMsg'),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  subscription: one(subscriptions, { fields: [users.id], references: [subscriptions.userId] }),
  businesses: many(businesses),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

// Note: sessions uses sessionToken as PK (Auth.js drizzle-adapter requirement)

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}))

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  user: one(users, { fields: [businesses.userId], references: [users.id] }),
  products: many(products),
  platformConnections: many(platformConnections),
  contentPosts: many(contentPosts),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  business: one(businesses, { fields: [products.businessId], references: [businesses.id] }),
  contentPosts: many(contentPosts),
}))

export const platformConnectionsRelations = relations(platformConnections, ({ one }) => ({
  business: one(businesses, { fields: [platformConnections.businessId], references: [businesses.id] }),
}))

export const contentPostsRelations = relations(contentPosts, ({ one, many }) => ({
  business: one(businesses, { fields: [contentPosts.businessId], references: [businesses.id] }),
  product: one(products, { fields: [contentPosts.productId], references: [products.id] }),
  metrics: many(postMetricSnapshots),
  publishAttempts: many(publishAttempts),
}))

export const postMetricSnapshotsRelations = relations(postMetricSnapshots, ({ one }) => ({
  post: one(contentPosts, { fields: [postMetricSnapshots.postId], references: [contentPosts.id] }),
}))

export const publishAttemptsRelations = relations(publishAttempts, ({ one }) => ({
  post: one(contentPosts, { fields: [publishAttempts.postId], references: [contentPosts.id] }),
}))
