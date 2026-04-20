import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, platformConnections } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { encrypt, isEncrypted } from '@/lib/crypto'
import { z } from 'zod'

const patchSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  platformAccountName: z.string().optional(),
  permissionsGranted: z.array(z.string()).optional(),
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

  // Verify ownership via businesses join
  const [existing] = await db
    .select({ id: platformConnections.id })
    .from(platformConnections)
    .innerJoin(businesses, eq(platformConnections.businessId, businesses.id))
    .where(and(eq(platformConnections.id, id), eq(businesses.userId, userId)))
    .limit(1)

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { accessToken, refreshToken, tokenExpiresAt, ...rest } = parsed.data

  const setValues: Record<string, unknown> = {
    ...rest,
    updatedAt: new Date(),
  }

  if (accessToken !== undefined) {
    setValues.accessToken = isEncrypted(accessToken) ? accessToken : encrypt(accessToken)
  }
  if (refreshToken !== undefined) {
    setValues.refreshToken = isEncrypted(refreshToken) ? refreshToken : encrypt(refreshToken)
  }
  if (tokenExpiresAt !== undefined) {
    setValues.tokenExpiresAt = new Date(tokenExpiresAt)
  }

  const [updated] = await db
    .update(platformConnections)
    .set(setValues)
    .where(eq(platformConnections.id, id))
    .returning({
      id: platformConnections.id,
      platform: platformConnections.platform,
      platformAccountId: platformConnections.platformAccountId,
      platformAccountName: platformConnections.platformAccountName,
      isActive: platformConnections.isActive,
      tokenExpiresAt: platformConnections.tokenExpiresAt,
    })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await db
    .update(platformConnections)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(platformConnections.id, id),
        eq(
          platformConnections.businessId,
          db
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.userId, userId))
            .limit(1),
        ),
      ),
    )

  return NextResponse.json({ disconnected: true })
}
