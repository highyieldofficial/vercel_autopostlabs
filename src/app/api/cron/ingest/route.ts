import { NextResponse } from 'next/server'
import { db, businesses, products } from '@/lib/db'
import { eq, lt, or, and } from 'drizzle-orm'
import { crawl } from '@/lib/crawler/shopify'
import { analyzeBrand } from '@/lib/ai'

// Vercel Cron — runs every minute
// Processes businesses stuck in 'pending' or stale 'in_progress' (>15min)
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000)

  const pending = await db.query.businesses.findMany({
    where: (b, { eq, or, lt, and }) =>
      or(
        eq(b.ingestionStatus, 'pending'),
        and(eq(b.ingestionStatus, 'in_progress'), lt(b.updatedAt, cutoff)),
      ),
    columns: { id: true, websiteUrl: true, userId: true },
    limit: 5,
  })

  if (pending.length === 0) return NextResponse.json({ processed: 0 })

  const results = await Promise.allSettled(
    pending.map(async (biz) => {
      await db
        .update(businesses)
        .set({ ingestionStatus: 'in_progress', updatedAt: new Date() })
        .where(eq(businesses.id, biz.id))

      const result = await crawl(biz.websiteUrl)
      if (!result) throw new Error('Crawl returned null')

      const brandProfile = await analyzeBrand(
        result.brand_text ?? '',
        result.business_name ?? biz.websiteUrl,
      )
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
        .where(eq(businesses.id, biz.id))

      for (const p of result.products ?? []) {
        await db
          .insert(products)
          .values({
            id: crypto.randomUUID(),
            businessId: biz.id,
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
          })
          .onConflictDoUpdate({
            target: [products.businessId, products.externalId],
            set: { name: p.name, updatedAt: new Date() },
          })
      }
    }),
  )

  let failed = 0
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      failed++
      await db
        .update(businesses)
        .set({ ingestionStatus: 'failed', updatedAt: new Date() })
        .where(eq(businesses.id, pending[i].id))
    }
  }

  return NextResponse.json({ processed: pending.length, failed })
}
