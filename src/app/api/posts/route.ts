import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, contentPosts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const businessId = searchParams.get('businessId') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const platform = searchParams.get('platform') ?? undefined

  const userBusinessIds = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.userId, userId))
    .then((rows) => rows.map((r) => r.id))

  if (userBusinessIds.length === 0) return NextResponse.json([])

  const posts = await db.query.contentPosts.findMany({
    where: (cp, { eq, and, inArray }) => {
      const conditions = [inArray(cp.businessId, userBusinessIds)]
      if (businessId) conditions.push(eq(cp.businessId, businessId))
      if (status)
        conditions.push(eq(cp.status, status as typeof contentPosts.$inferSelect['status']))
      if (platform)
        conditions.push(eq(cp.platform, platform as typeof contentPosts.$inferSelect['platform']))
      return and(...conditions)
    },
    orderBy: (cp, { asc }) => asc(cp.scheduledAt),
    limit: 100,
    with: { product: { columns: { name: true } } },
  })

  return NextResponse.json(posts)
}
