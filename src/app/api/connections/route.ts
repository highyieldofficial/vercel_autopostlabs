import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, businesses, platformConnections } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { encrypt, isEncrypted } from '@/lib/crypto'
import { z } from 'zod'

const connectSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'twitter', 'tiktok', 'pinterest', 'linkedin']),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  platformAccountId: z.string().min(1),
  platformAccountName: z.string().optional(),
  permissionsGranted: z.array(z.string()).default([]),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const connections = await db
    .select({
      id: platformConnections.id,
      platform: platformConnections.platform,
      platformAccountId: platformConnections.platformAccountId,
      platformAccountName: platformConnections.platformAccountName,
      permissionsGranted: platformConnections.permissionsGranted,
      isActive: platformConnections.isActive,
      tokenExpiresAt: platformConnections.tokenExpiresAt,
      updatedAt: platformConnections.updatedAt,
    })
    .from(platformConnections)
    .innerJoin(businesses, eq(platformConnections.businessId, businesses.id))
    .where(and(eq(platformConnections.businessId, businessId), eq(businesses.userId, userId)))

  return NextResponse.json(connections)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const body = await req.json()
  const parsed = connectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    platform,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    platformAccountId,
    platformAccountName,
    permissionsGranted,
  } = parsed.data

  const [business] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.userId, userId)))
    .limit(1)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const [connection] = await db
    .insert(platformConnections)
    .values({
      id: crypto.randomUUID(),
      businessId,
      platform,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      platformAccountId,
      platformAccountName,
      permissionsGranted,
      updatedAt: new Date(),
    } as any)
    .onConflictDoUpdate({
      target: [platformConnections.businessId, platformConnections.platform],
      set: {
        accessToken: isEncrypted(accessToken) ? accessToken : encrypt(accessToken),
        refreshToken: refreshToken
          ? isEncrypted(refreshToken)
            ? refreshToken
            : encrypt(refreshToken)
          : null,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        platformAccountId,
        platformAccountName,
        permissionsGranted,
        isActive: true,
        updatedAt: new Date(),
      } as any,
    })
    .returning({
      id: platformConnections.id,
      platform: platformConnections.platform,
      platformAccountId: platformConnections.platformAccountId,
      platformAccountName: platformConnections.platformAccountName,
      isActive: platformConnections.isActive,
    })

  return NextResponse.json(connection, { status: 201 })
}
