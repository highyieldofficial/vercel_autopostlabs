import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, products, contentPosts } from '@/lib/db'
import { eq, desc, count } from 'drizzle-orm'
import { z } from 'zod'

// Allow up to 60s for the crawl + Gemini analysis to complete
export const maxDuration = 60

const createBusinessSchema = z.object({
  websiteUrl: z.string().url(),
})

export async function GET(_req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  const businessIds = rows.map((b) => b.id)
  const postCounts =
    businessIds.length > 0
      ? await db
          .select({ businessId: contentPosts.businessId, postCount: count(contentPosts.id) })
          .from(contentPosts)
          .groupBy(contentPosts.businessId)
      : []

  const postCountMap = new Map(postCounts.map((r) => [r.businessId, r.postCount]))

  const result = rows.map((b) => ({
    ...b,
    _count: { products: b.productCount, contentPosts: postCountMap.get(b.id) ?? 0 },
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createBusinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // ── Plan gate: store limit ──────────────────────────────────────────────────
  const { getPlanLimits, countUserBusinesses, upgradeMsg } = await import('@/lib/plan-gate')
  const gate = await getPlanLimits(userId, session.user?.email)
  const storeCount = await countUserBusinesses(userId)
  if (storeCount >= gate.maxBusinesses) {
    return NextResponse.json(
      { error: upgradeMsg(gate.tier, `Your ${gate.tier} plan allows ${gate.maxBusinesses} store(s).`) },
      { status: 403 },
    )
  }

  const { websiteUrl } = parsed.data

  const businessId = crypto.randomUUID()

  const [business] = await db
    .insert(businesses)
    .values({
      id: businessId,
      userId,
      websiteUrl,
      ingestionStatus: 'pending',
      updatedAt: new Date(),
    } as any)
    .returning()

  // Run ingestion synchronously within the 60s window (maxDuration above).
  // This is more reliable than fire-and-forget which Vercel may kill after the response.
  // The cron job at /api/cron/ingest will rescue any businesses stuck in 'pending'.
  try {
    await db
      .update(businesses)
      .set({ ingestionStatus: 'in_progress', updatedAt: new Date() } as any)
      .where(eq(businesses.id, businessId))

    const { crawl } = await import('@/lib/crawler/shopify')
    const { analyzeBrand } = await import('@/lib/ai')
    const result = await crawl(websiteUrl)

    const brandProfile = await analyzeBrand(result.brand_text ?? '', result.business_name ?? websiteUrl)
    brandProfile.primaryColors = result.colors ?? []

    await db
      .update(businesses)
      .set({
        businessName: result.business_name,
        platformType: result.platform_type ?? 'generic',
        brandProfile: brandProfile as never,
        ingestionStatus: 'completed',
        lastCrawledAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(businesses.id, businessId))

    for (const p of result.products ?? []) {
      await db
        .insert(products)
        .values({
          id: crypto.randomUUID(),
          businessId,
          externalId: p.external_id ?? p.name,
          name: p.name,
          description: p.description,
          price: p.price?.toString(),
          currency: p.currency ?? 'USD',
          category: p.category,
          tags: p.tags ?? [],
          sourceImages: p.images ?? [],
          shopifyHandle: p.handle,
          isActive: true,
          updatedAt: new Date(),
        } as any)
        .onConflictDoUpdate({
          target: [products.businessId, products.externalId],
          set: {
            name: p.name,
            description: p.description,
            price: p.price?.toString(),
            tags: p.tags ?? [],
            sourceImages: p.images ?? [],
            isActive: true,
            updatedAt: new Date(),
          } as any,
        })
    }
  } catch (err) {
    console.error('[ingest] failed:', err)
    await db
      .update(businesses)
      .set({ ingestionStatus: 'failed', updatedAt: new Date() } as any)
      .where(eq(businesses.id, businessId))
  }

  return NextResponse.json(business, { status: 201 })
}
