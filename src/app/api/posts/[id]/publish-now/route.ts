import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, contentPosts, publishAttempts } from '@/lib/db'
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
    with: {
      business: {
        with: { platformConnections: true },
      },
    },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowedStatuses = ['draft', 'pending_approval', 'scheduled', 'failed']
  if (!allowedStatuses.includes(post.status)) {
    return NextResponse.json(
      { error: `Cannot publish a post with status: ${post.status}` },
      { status: 409 },
    )
  }

  const connection = post.business.platformConnections.find(
    (c) => c.platform === post.platform && c.isActive,
  )
  if (!connection) {
    return NextResponse.json(
      { error: `No active ${post.platform} connection for this business` },
      { status: 422 },
    )
  }

  await db
    .update(contentPosts)
    .set({ status: 'publishing', updatedAt: new Date() } as any)
    .where(eq(contentPosts.id, id))

  const { getAdapter } = await import('@/lib/social')
  const { decrypt } = await import('@/lib/crypto')

  const adapter = getAdapter(post.platform)
  const result = await adapter.publish(
    {
      caption: post.caption ?? '',
      hashtags: post.hashtags,
      mediaUrls: post.mediaKeys,
      ctaText: post.ctaText ?? undefined,
    },
    {
      accessToken: decrypt(connection.accessToken),
      refreshToken: connection.refreshToken ? decrypt(connection.refreshToken) : undefined,
      platformAccountId: connection.platformAccountId ?? '',
    },
  )

  await db.insert(publishAttempts).values({
    id: crypto.randomUUID(),
    postId: id,
    success: result.success,
    errorCode: result.error?.code ?? null,
    errorMsg: result.error?.message ?? null,
  } as any)

  if (result.success) {
    await db
      .update(contentPosts)
      .set({
        status: 'published',
        publishedAt: new Date(),
        externalPostId: result.externalPostId,
        updatedAt: new Date(),
      } as any)
      .where(eq(contentPosts.id, id))

    return NextResponse.json({ published: true, externalPostId: result.externalPostId })
  } else {
    await db
      .update(contentPosts)
      .set({ status: 'failed', updatedAt: new Date() } as any)
      .where(eq(contentPosts.id, id))

    return NextResponse.json(
      { error: result.error?.message ?? 'Publish failed' },
      { status: 502 },
    )
  }
}
