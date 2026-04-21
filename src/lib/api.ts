/**
 * Direct DB layer — replaces the Fastify HTTP client used in the monorepo.
 * All functions query Drizzle/Postgres directly; no fetch calls.
 */

import { db, businesses, products, contentPosts, platformConnections, subscriptions, postMetricSnapshots } from '@/lib/db'
import { eq, and, desc, count, ilike, or, sql, inArray, sum, asc } from 'drizzle-orm'

// ── PLANS constant (mirrors @autopostlabs/billing PLANS) ─────────────────────

const PLANS: BillingPlans = {
  free: {
    name: 'Free',
    price: 0,
    businesses: 1,
    postsPerMonth: 30,
    platforms: 2,
    variantId: null,
  },
  pro: {
    name: 'Pro',
    price: 29,
    businesses: 5,
    postsPerMonth: 300,
    platforms: 4,
    variantId: process.env.WHOP_PRO_VARIANT_ID ?? null,
  },
  agency: {
    name: 'Agency',
    price: 99,
    businesses: 25,
    postsPerMonth: -1,
    platforms: 6,
    variantId: process.env.WHOP_AGENCY_VARIANT_ID ?? null,
  },
}

// ── api object ────────────────────────────────────────────────────────────────

export const api = {
  // ── businesses ──────────────────────────────────────────────────────────────
  businesses: {
    list: async (userId: string): Promise<Business[]> => {
      const rows = await db
        .select({
          id: businesses.id,
          userId: businesses.userId,
          websiteUrl: businesses.websiteUrl,
          platformType: businesses.platformType,
          businessName: businesses.businessName,
          ingestionStatus: businesses.ingestionStatus,
          lastCrawledAt: businesses.lastCrawledAt,
          createdAt: businesses.createdAt,
          updatedAt: businesses.updatedAt,
          productCount: count(products.id),
        })
        .from(businesses)
        .leftJoin(products, eq(products.businessId, businesses.id))
        .where(eq(businesses.userId, userId))
        .groupBy(businesses.id)
        .orderBy(desc(businesses.createdAt))

      // Get post counts separately
      const businessIds = rows.map((r) => r.id)
      const postCounts =
        businessIds.length > 0
          ? await db
              .select({ businessId: contentPosts.businessId, postCount: count(contentPosts.id) })
              .from(contentPosts)
              .where(inArray(contentPosts.businessId, businessIds))
              .groupBy(contentPosts.businessId)
          : []

      const postCountMap = new Map(postCounts.map((r) => [r.businessId, r.postCount]))

      return rows.map((b) => ({
        id: b.id,
        userId: b.userId,
        websiteUrl: b.websiteUrl,
        platformType: b.platformType ?? '',
        businessName: b.businessName,
        ingestionStatus: b.ingestionStatus ?? 'pending',
        lastCrawledAt: b.lastCrawledAt ? b.lastCrawledAt.toISOString() : null,
        createdAt: b.createdAt ? b.createdAt.toISOString() : new Date().toISOString(),
        _count: { products: b.productCount, contentPosts: postCountMap.get(b.id) ?? 0 },
      }))
    },

    get: async (id: string, userId: string): Promise<BusinessDetail | null> => {
      const business = await db.query.businesses.findFirst({
        where: (b, { eq, and }) => and(eq(b.id, id), eq(b.userId, userId)),
        with: {
          products: { orderBy: (p, { desc }) => desc(p.createdAt), limit: 50 },
          platformConnections: {
            columns: {
              id: true,
              platform: true,
              isActive: true,
              platformAccountId: true,
              platformAccountName: true,
              permissionsGranted: true,
              tokenExpiresAt: true,
              updatedAt: true,
            },
          },
          contentPosts: { columns: { id: true } },
        },
      })

      if (!business) return null

      return {
        id: business.id,
        userId: business.userId,
        websiteUrl: business.websiteUrl,
        platformType: business.platformType ?? '',
        businessName: business.businessName,
        ingestionStatus: business.ingestionStatus ?? 'pending',
        lastCrawledAt: business.lastCrawledAt ? business.lastCrawledAt.toISOString() : null,
        createdAt: business.createdAt ? business.createdAt.toISOString() : new Date().toISOString(),
        brandProfile: business.brandProfile as BrandProfile | null,
        products: business.products.map(mapProduct),
        platformConnections: business.platformConnections.map(mapConnection),
        _count: { products: business.products.length, contentPosts: business.contentPosts.length },
      }
    },
  },

  // ── products ─────────────────────────────────────────────────────────────────
  products: {
    list: async (
      params: { businessId: string; page?: number; limit?: number; search?: string },
      userId: string,
    ): Promise<ProductList> => {
      const take = Math.min(params.limit ?? 24, 100)
      const skip = ((params.page ?? 1) - 1) * take
      const q = params.search

      // Ownership check
      const [biz] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.id, params.businessId), eq(businesses.userId, userId)))
        .limit(1)
      if (!biz) return { products: [], total: 0, page: params.page ?? 1, limit: take }

      const baseWhere = and(
        eq(products.businessId, params.businessId),
        eq(products.isActive, true),
        q
          ? or(
              ilike(products.name, `%${q}%`),
              ilike(products.description, `%${q}%`),
              ilike(products.category, `%${q}%`),
            )
          : undefined,
      )

      const [allProducts, [{ total }]] = await Promise.all([
        db.select().from(products).where(baseWhere).orderBy(desc(products.createdAt)).limit(take).offset(skip),
        db.select({ total: count() }).from(products).where(baseWhere),
      ])

      return {
        products: allProducts.map(mapProduct),
        total,
        page: params.page ?? 1,
        limit: take,
      }
    },

    get: async (id: string, userId: string): Promise<Product | null> => {
      const product = await db.query.products.findFirst({
        where: (p, { eq, and, inArray }) =>
          and(
            eq(p.id, id),
            inArray(
              p.businessId,
              db.select({ id: businesses.id }).from(businesses).where(eq(businesses.userId, userId)),
            ),
          ),
      })
      if (!product) return null
      return mapProduct(product)
    },
  },

  // ── posts ─────────────────────────────────────────────────────────────────────
  posts: {
    list: async (
      params: { businessId?: string; status?: string; platform?: string },
      userId: string,
    ): Promise<Post[]> => {
      const userBusinessIds = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.userId, userId))
        .then((rows) => rows.map((r) => r.id))

      if (userBusinessIds.length === 0) return []

      const posts = await db.query.contentPosts.findMany({
        where: (cp, { eq, and, inArray }) => {
          const conditions: ReturnType<typeof eq>[] = [inArray(cp.businessId, userBusinessIds)]
          if (params.businessId) conditions.push(eq(cp.businessId, params.businessId))
          if (params.status) conditions.push(eq(cp.status, params.status as any))
          if (params.platform) conditions.push(eq(cp.platform, params.platform as any))
          return and(...conditions)
        },
        orderBy: (cp, { asc }) => asc(cp.scheduledAt),
        limit: 100,
        with: { product: { columns: { name: true } } },
      })

      return posts.map(mapPost)
    },

    get: async (id: string, userId: string): Promise<Post | null> => {
      const userBusinessIds = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.userId, userId))
        .then((rows) => rows.map((r) => r.id))

      if (userBusinessIds.length === 0) return null

      const post = await db.query.contentPosts.findFirst({
        where: (cp, { eq, and, inArray }) =>
          and(eq(cp.id, id), inArray(cp.businessId, userBusinessIds)),
        with: { product: { columns: { name: true } } },
      })

      if (!post) return null
      return mapPost(post)
    },
  },

  // ── connections ───────────────────────────────────────────────────────────────
  connections: {
    list: async (businessId: string, userId: string): Promise<Connection[]> => {
      const rows = await db
        .select({
          id: platformConnections.id,
          platform: platformConnections.platform,
          platformAccountId: platformConnections.platformAccountId,
          platformAccountName: platformConnections.platformAccountName,
          permissionsGranted: platformConnections.permissionsGranted,
          isActive: platformConnections.isActive,
          tokenExpiresAt: platformConnections.tokenExpiresAt,
          updatedAt: platformConnections.updatedAt,
        })
        .from(platformConnections)
        .innerJoin(businesses, eq(platformConnections.businessId, businesses.id))
        .where(and(eq(platformConnections.businessId, businessId), eq(businesses.userId, userId)))

      return rows.map(mapConnection)
    },
  },

  // ── analytics ─────────────────────────────────────────────────────────────────
  analytics: {
    summary: async (userId: string) => {
      const userBusinesses = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.userId, userId))

      if (userBusinesses.length === 0) return emptySummary()

      const businessIds = userBusinesses.map((b) => b.id)

      const [publishedCount, scheduledCount, pendingCount] = await Promise.all([
        db
          .select({ count: count() })
          .from(contentPosts)
          .where(and(inArray(contentPosts.businessId, businessIds), eq(contentPosts.status, 'published')))
          .then(([r]) => r?.count ?? 0),
        db
          .select({ count: count() })
          .from(contentPosts)
          .where(and(inArray(contentPosts.businessId, businessIds), eq(contentPosts.status, 'scheduled')))
          .then(([r]) => r?.count ?? 0),
        db
          .select({ count: count() })
          .from(contentPosts)
          .where(and(inArray(contentPosts.businessId, businessIds), eq(contentPosts.status, 'pending_approval')))
          .then(([r]) => r?.count ?? 0),
      ])

      // Top 20 published posts ordered by publishedAt desc
      const topPosts = await db.query.contentPosts.findMany({
        where: (cp, { and, inArray, eq }) =>
          and(inArray(cp.businessId, businessIds), eq(cp.status, 'published')),
        orderBy: (cp, { desc }) => desc(cp.publishedAt),
        limit: 20,
        with: {
          metrics: { orderBy: (m, { desc }) => desc(m.snapshotAt), limit: 1 },
          product: { columns: { name: true } },
        },
      })

      // Per-platform breakdown
      const platformBreakdown = await db
        .select({ platform: contentPosts.platform, postCount: count() })
        .from(contentPosts)
        .where(and(inArray(contentPosts.businessId, businessIds), eq(contentPosts.status, 'published')))
        .groupBy(contentPosts.platform)

      // Aggregate metrics
      const publishedPostIds = topPosts.map((p) => p.id)
      const metricsAgg =
        publishedPostIds.length > 0
          ? await db
              .select({
                likes: sum(postMetricSnapshots.likes),
                comments: sum(postMetricSnapshots.comments),
                shares: sum(postMetricSnapshots.shares),
                impressions: sum(postMetricSnapshots.impressions),
                reach: sum(postMetricSnapshots.reach),
              })
              .from(postMetricSnapshots)
              .innerJoin(contentPosts, eq(postMetricSnapshots.postId, contentPosts.id))
              .where(inArray(contentPosts.businessId, businessIds))
              .then(([r]) => r)
          : null

      // Sort top posts by engagement from latest snapshot
      const sorted = topPosts
        .map((p) => {
          const m = p.metrics[0] ?? null
          const engagement = m ? (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) : 0
          return { ...p, engagement, latestMetrics: m }
        })
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5)

      return {
        totals: {
          published: Number(publishedCount),
          scheduled: Number(scheduledCount),
          pendingApproval: Number(pendingCount),
          likes: Number(metricsAgg?.likes ?? 0),
          comments: Number(metricsAgg?.comments ?? 0),
          shares: Number(metricsAgg?.shares ?? 0),
          impressions: Number(metricsAgg?.impressions ?? 0),
          reach: Number(metricsAgg?.reach ?? 0),
        },
        byPlatform: platformBreakdown.map((p) => ({ platform: p.platform, posts: p.postCount })),
        topPosts: sorted.map((p) => ({
          id: p.id,
          platform: p.platform,
          productName: p.product?.name ?? null,
          caption: p.caption,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          engagement: p.engagement,
          likes: p.latestMetrics?.likes ?? 0,
          comments: p.latestMetrics?.comments ?? 0,
          shares: p.latestMetrics?.shares ?? 0,
          impressions: p.latestMetrics?.impressions ?? 0,
        })),
      }
    },
  },

  // ── billing ───────────────────────────────────────────────────────────────────
  billing: {
    status: async (userId: string): Promise<BillingStatus> => {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
        with: { subscription: true },
      })
      if (!user) return { tier: 'free', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEndsAt: null }
      const sub = (user as any).subscription
      return {
        tier: sub?.tier ?? 'free',
        status: sub?.status ?? 'active',
        currentPeriodEnd: sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
        trialEndsAt: sub?.trialEndsAt ? sub.trialEndsAt.toISOString() : null,
      }
    },

    plans: async (_userId: string): Promise<BillingPlans> => {
      return PLANS
    },
  },
}

// ── Helper mappers ────────────────────────────────────────────────────────────

function mapProduct(p: any): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency ?? 'USD',
    category: p.category,
    tags: p.tags ?? [],
    sourceImages: p.sourceImages ?? [],
    shopifyHandle: p.shopifyHandle ?? null,
  }
}

function mapPost(p: any): Post {
  return {
    id: p.id,
    businessId: p.businessId,
    platform: p.platform,
    status: p.status,
    caption: p.caption,
    hashtags: p.hashtags ?? [],
    ctaText: p.ctaText ?? null,
    mediaKeys: p.mediaKeys ?? [],
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    product: p.product ? { name: p.product.name } : null,
  }
}

function mapConnection(c: any): Connection {
  return {
    id: c.id,
    platform: c.platform,
    platformAccountId: c.platformAccountId ?? null,
    platformAccountName: c.platformAccountName ?? null,
    isActive: c.isActive ?? true,
    tokenExpiresAt: c.tokenExpiresAt ? c.tokenExpiresAt.toISOString() : null,
    permissionsGranted: c.permissionsGranted ?? [],
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
  }
}

function emptySummary() {
  return {
    totals: { published: 0, scheduled: 0, pendingApproval: 0, likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0 },
    byPlatform: [],
    topPosts: [],
  }
}

// ── Shared types ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface Business {
  id: string
  userId: string
  businessName: string | null
  websiteUrl: string
  platformType: string
  ingestionStatus: string
  lastCrawledAt: string | null
  createdAt: string
  _count?: { products: number; contentPosts: number }
}

export interface BrandProfile {
  voice: string
  toneKeywords: string[]
  targetAudience: string
  primaryColors: string[]
  tagline?: string
}

export interface BusinessDetail extends Business {
  brandProfile: BrandProfile | null
  products: Product[]
  platformConnections: Connection[]
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: string | null
  currency: string
  category: string | null
  tags: string[]
  sourceImages: { url: string; alt?: string }[]
  shopifyHandle: string | null
}

export interface ProductList {
  products: Product[]
  total: number
  page: number
  limit: number
}

export interface Post {
  id: string
  businessId: string
  platform: string
  status: string
  caption: string | null
  hashtags: string[]
  ctaText: string | null
  mediaKeys: string[]
  scheduledAt: string | null
  publishedAt: string | null
  product?: { name: string } | null
}

export interface Connection {
  id: string
  platform: string
  platformAccountId: string | null
  platformAccountName: string | null
  isActive: boolean
  tokenExpiresAt: string | null
  permissionsGranted: string[]
  updatedAt: string
}

export interface PlanConfig {
  name: string
  price: number
  businesses: number
  postsPerMonth: number
  platforms: number
  variantId: string | null
}

export interface BillingPlans {
  free: PlanConfig
  pro: PlanConfig
  agency: PlanConfig
}

export interface BillingStatus {
  tier: 'free' | 'pro' | 'agency'
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
}
