/**
 * Token Refresh Cron
 *
 * Runs every hour via Vercel Cron. Finds PlatformConnections whose tokens expire
 * within 24 hours and proactively refreshes them so publishing never fails due
 * to an expired token.
 */

import { NextResponse } from 'next/server'
import { db, platformConnections } from '@/lib/db'
import { eq, and, isNotNull, lt, inArray } from 'drizzle-orm'
import { encrypt, decrypt } from '@/lib/crypto'
import { getAdapter } from '@/lib/social'
import type { TokenSet } from '@/lib/social'

const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS)

  const expiring = await db.query.platformConnections.findMany({
    where: (c, { and, eq, isNotNull, lt, inArray }) =>
      and(
        eq(c.isActive, true),
        isNotNull(c.refreshToken),
        lt(c.tokenExpiresAt, cutoff),
        inArray(c.platform, ['twitter', 'tiktok']),
      ),
    with: { business: { columns: { id: true } } },
  })

  if (expiring.length === 0) {
    console.log('[token-refresh] No tokens expiring soon.')
    return NextResponse.json({ refreshed: 0 })
  }

  console.log(`[token-refresh] Refreshing ${expiring.length} token(s)...`)

  let refreshed = 0
  let failed = 0

  for (const conn of expiring) {
    try {
      const adapter = getAdapter(conn.platform)

      const tokenSet: TokenSet = {
        accessToken: decrypt(conn.accessToken),
        refreshToken: conn.refreshToken ? decrypt(conn.refreshToken) : undefined,
        expiresAt: conn.tokenExpiresAt ?? undefined,
        platformAccountId: conn.platformAccountId ?? '',
      }

      const newTokens = await adapter.refreshTokens(tokenSet)

      await db
        .update(platformConnections)
        .set({
          accessToken: encrypt(newTokens.accessToken),
          refreshToken: newTokens.refreshToken
            ? encrypt(newTokens.refreshToken)
            : conn.refreshToken,
          tokenExpiresAt: newTokens.expiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(platformConnections.id, conn.id))

      console.log(
        `[token-refresh] Refreshed ${conn.platform} for business ${conn.businessId}`,
      )
      refreshed++
    } catch (err) {
      console.error(
        `[token-refresh] Failed for ${conn.platform} connection ${conn.id}:`,
        err,
      )
      await db
        .update(platformConnections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(platformConnections.id, conn.id))
      failed++
    }
  }

  return NextResponse.json({ refreshed, failed })
}
