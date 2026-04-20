import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const business = await db.query.businesses.findFirst({
    where: (b, { eq, and }) => and(eq(b.id, id), eq(b.userId, userId)),
    with: {
      products: { orderBy: (p, { desc }) => desc(p.createdAt), limit: 50 },
      platformConnections: {
        columns: { platform: true, isActive: true, platformAccountName: true },
      },
      contentPosts: { columns: { id: true } },
    },
  })

  if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = {
    ...business,
    platformConnections: business.platformConnections,
    _count: { contentPosts: business.contentPosts.length },
    contentPosts: undefined,
  }

  return NextResponse.json(result)
}
