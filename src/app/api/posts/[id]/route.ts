import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, contentPosts } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'

async function getUserBusinessIds(userId: string): Promise<string[]> {
  return db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.userId, userId))
    .then((rows) => rows.map((r) => r.id))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userBusinessIds = await getUserBusinessIds(userId)
  if (userBusinessIds.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const post = await db.query.contentPosts.findFirst({
    where: (cp, { eq, and, inArray }) =>
      and(eq(cp.id, id), inArray(cp.businessId, userBusinessIds)),
    with: { product: { columns: { name: true } } },
  })

  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
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
  const parsed = scheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const userBusinessIds = await getUserBusinessIds(userId)
  if (userBusinessIds.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const post = await db.query.contentPosts.findFirst({
    where: (cp, { eq, and, inArray }) =>
      and(eq(cp.id, id), inArray(cp.businessId, userBusinessIds)),
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const scheduledAt = new Date(parsed.data.scheduledAt)
  await db
    .update(contentPosts)
    .set({ scheduledAt, updatedAt: new Date() } as any)
    .where(eq(contentPosts.id, id))

  return NextResponse.json({ scheduled: true, scheduledAt })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userBusinessIds = await getUserBusinessIds(userId)
  if (userBusinessIds.length === 0) return NextResponse.json({ deleted: true })

  await db
    .delete(contentPosts)
    .where(
      and(
        eq(contentPosts.id, id),
        inArray(contentPosts.businessId, userBusinessIds),
        inArray(contentPosts.status, ['draft', 'pending_approval', 'failed']),
      ),
    )

  return NextResponse.json({ deleted: true })
}
