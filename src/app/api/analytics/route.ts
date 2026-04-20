import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, contentPosts, postMetricSnapshots } from '@/lib/db'
import { eq, and, count, sum, inArray } from 'drizzle-orm'

function emptySummary() {
  return {
    totals: {
      published: 0,
      scheduled: 0,
      pendingApproval: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      reach: 0,
    },
    byPlatform: [],
    topPosts: [],
  }
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userBusinesses = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.userId, userId))

  if (userBusinesses.length === 0) return NextResponse.json(emptySummary())

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
      .where(
        and(
          inArray(contentPosts.businessId, businessIds),
          eq(contentPosts.status, 'pending_approval'),
        ),
      )
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
    .where(
      and(inArray(contentPosts.businessId, businessIds), eq(contentPosts.status, 'published')),
    )
    .groupBy(contentPosts.platform)

  // Aggregate metrics
  const metricsAgg =
    topPosts.length > 0
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
      const engagement = m ? m.likes + m.comments + m.shares : 0
      return { ...p, engagement, latestMetrics: m }
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5)

  return NextResponse.json({
    totals: {
      published: publishedCount,
      scheduled: scheduledCount,
      pendingApproval: pendingCount,
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
      publishedAt: p.publishedAt,
      engagement: p.engagement,
      likes: p.latestMetrics?.likes ?? 0,
      comments: p.latestMetrics?.comments ?? 0,
      shares: p.latestMetrics?.shares ?? 0,
      impressions: p.latestMetrics?.impressions ?? 0,
    })),
  })
}
