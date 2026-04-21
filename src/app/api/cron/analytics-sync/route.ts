/**
 * Analytics Sync Cron
 *
 * Runs periodically via Vercel Cron. Fetches fresh metrics from each social
 * platform for all published posts across all businesses.
 */

import { NextResponse } from 'next/server'
import { db, businesses, contentPosts, postMetricSnapshots } from '@/lib/db'
import { eq, and, isNotNull, inArray } from 'drizzle-orm'
import { getAdapter } from '@/lib/social'
import { decrypt } from '@/lib/crypto'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all businesses
  const allBusinesses = await db
    .select({ id: businesses.id })
    .from(businesses)

  if (allBusinesses.length === 0) {
    return NextResponse.json({ synced: 0, errors: 0 })
  }

  const businessIds = allBusinesses.map((b) => b.id)

  const posts = await db.query.contentPosts.findMany({
    where: (cp, { and, inArray, eq, isNotNull }) =>
      and(
        inArray(cp.businessId, businessIds),
        eq(cp.status, 'published'),
        isNotNull(cp.externalPostId),
      ),
    limit: 100,
    with: {
      business: {
        with: { platformConnections: true },
      },
    },
  })

  let synced = 0
  let errors = 0

  for (const post of posts) {
    const connection = post.business.platformConnections.find(
      (c) => c.platform === post.platform && c.isActive,
    )
    if (!connection || !post.externalPostId) continue

    try {
      const adapter = getAdapter(post.platform)
      const metrics = await adapter.getMetrics(post.externalPostId, {
        accessToken: decrypt(connection.accessToken),
        platformAccountId: connection.platformAccountId ?? '',
      })

      const reach = metrics.reach ?? 0
      const engagements =
        (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0)
      const engagementRate = reach > 0 ? (engagements / reach).toString() : '0'

      await db.insert(postMetricSnapshots).values({
        id: crypto.randomUUID(),
        postId: post.id,
        likes: metrics.likes ?? 0,
        comments: metrics.comments ?? 0,
        shares: metrics.shares ?? 0,
        impressions: metrics.impressions ?? 0,
        reach,
        clicks: metrics.clicks ?? 0,
        saves: metrics.saves ?? 0,
        videoViews: metrics.video_views ?? 0,
        engagementRate,
      } as any)

      synced++
    } catch (err) {
      console.warn(`[analytics-sync] Failed for post ${post.id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ synced, errors, total: posts.length })
}
