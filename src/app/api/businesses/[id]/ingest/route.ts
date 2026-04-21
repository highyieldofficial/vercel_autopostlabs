import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, products } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const business = await db.query.businesses.findFirst({
    where: (b, { eq, and }) => and(eq(b.id, id), eq(b.userId, userId)),
  })
  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db
    .update(businesses)
    .set({ ingestionStatus: 'pending', updatedAt: new Date() })
    .where(eq(businesses.id, id))

  const { websiteUrl } = business
  const businessId = id

  // Fire and forget — Vercel will keep the function alive for background work
  // The cron job will catch anything that gets stuck
  void (async () => {
    try {
      const { crawl } = await import('@/lib/crawler/shopify')
      const { analyzeBrand } = await import('@/lib/ai')
      const result = await crawl(websiteUrl)
      if (!result) {
        await db
          .update(businesses)
          .set({ ingestionStatus: 'failed', updatedAt: new Date() })
          .where(eq(businesses.id, businessId))
        return
      }
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
        })
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
            },
          })
      }
    } catch (err) {
      console.error('[ingest] failed:', err)
      await db
        .update(businesses)
        .set({ ingestionStatus: 'failed', updatedAt: new Date() })
        .where(eq(businesses.id, businessId))
    }
  })()

  return NextResponse.json({ queued: true })
}
