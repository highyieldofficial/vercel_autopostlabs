import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, products } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const product = await db.query.products.findFirst({
    where: (p, { eq, and, inArray }) =>
      and(
        eq(p.id, id),
        inArray(
          p.businessId,
          db.select({ id: businesses.id }).from(businesses).where(eq(businesses.userId, userId)),
        ),
      ),
    with: {
      contentPosts: {
        orderBy: (cp, { desc }) => desc(cp.createdAt),
        limit: 10,
        columns: { id: true, platform: true, status: true, scheduledAt: true, publishedAt: true },
      },
    },
  })

  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  currency: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

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

  const [updated] = await db
    .update(products)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()

  return NextResponse.json(updated)
}
