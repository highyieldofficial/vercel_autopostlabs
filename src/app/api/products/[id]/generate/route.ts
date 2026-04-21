import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, products, contentPosts } from '@/lib/db'
import { z } from 'zod'

const generateSchema = z.object({
  platforms: z
    .array(z.enum(['facebook', 'instagram', 'twitter', 'tiktok', 'pinterest', 'linkedin']))
    .min(1),
  variantCount: z.number().int().min(1).max(5).default(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { platforms, variantCount } = parsed.data

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
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const business = await db.query.businesses.findFirst({
    where: (b, { eq }) => eq(b.id, product.businessId),
  })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { generateCopy } = await import('@/lib/ai')

  const brandProfile = (business.brandProfile ?? {
    voice: 'friendly',
    toneKeywords: [],
    targetAudience: 'general consumers',
    primaryColors: [],
  }) as Parameters<typeof generateCopy>[1]

  const createdPosts = []

  for (const platform of platforms) {
    for (let v = 0; v < variantCount; v++) {
      const copy = await generateCopy(
        {
          name: product.name,
          description: product.description ?? undefined,
          price: product.price ? Number(product.price) : undefined,
          currency: product.currency,
          category: product.category ?? undefined,
          tags: product.tags,
        },
        brandProfile,
        platform,
      )

      const [post] = await db
        .insert(contentPosts)
        .values({
          id: crypto.randomUUID(),
          businessId: product.businessId,
          productId: id,
          platform,
          status: 'draft',
          caption: copy.caption,
          hashtags: copy.hashtags,
          ctaText: copy.ctaText,
          generationMetadata: {
            model: 'claude-sonnet-4-6',
            variant: v,
            altText: copy.altText,
          },
          updatedAt: new Date(),
        } as any)
        .returning()

      createdPosts.push(post)
    }
  }

  return NextResponse.json({ posts: createdPosts }, { status: 201 })
}
