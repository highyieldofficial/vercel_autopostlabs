import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, products } from '@/lib/db'
import { eq, and, ilike, or, count, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const businessId = searchParams.get('businessId')
  const page = searchParams.get('page') ?? '1'
  const limit = searchParams.get('limit') ?? '24'
  const q = searchParams.get('q') ?? undefined

  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const take = Math.min(Number(limit), 100)
  const skip = (Number(page) - 1) * take

  const ownershipCheck = and(eq(businesses.id, businessId), eq(businesses.userId, userId))
  const [biz] = await db.select().from(businesses).where(ownershipCheck).limit(1)
  if (!biz) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const baseWhere = and(
    eq(products.businessId, businessId),
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

  return NextResponse.json({ products: allProducts, total, page: Number(page), limit: take })
}
