import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, contentPosts } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const post = await db.query.contentPosts.findFirst({
    where: (cp, { eq, and, inArray }) =>
      and(
        eq(cp.id, id),
        inArray(
          cp.businessId,
          db.select({ id: businesses.id }).from(businesses).where(eq(businesses.userId, userId)),
        ),
      ),
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db
    .update(contentPosts)
    .set({ status: 'scheduled', updatedAt: new Date() })
    .where(eq(contentPosts.id, id))

  return NextResponse.json({ approved: true })
}
