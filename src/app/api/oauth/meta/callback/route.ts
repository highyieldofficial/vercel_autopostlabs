import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/oauth'
import { db, businesses, platformConnections } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { encrypt, isEncrypted } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.redirect(new URL('/sign-in', req.url))

  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_denied', req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_invalid', req.url))
  }

  let businessId: string
  try {
    businessId = verifyOAuthState(state)
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_state', req.url))
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/oauth/meta/callback`

  // Exchange code for short-lived token
  const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_token', req.url))
  }

  const { access_token: shortToken } = (await tokenRes.json()) as { access_token: string }

  // Exchange for long-lived token (valid 60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: shortToken,
      }),
  )

  if (!llRes.ok) {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_ll_token', req.url))
  }

  const { access_token: longToken, expires_in } = (await llRes.json()) as {
    access_token: string
    expires_in: number
  }

  // Get user's pages to find the Page token
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`,
  )
  const pagesData = (await pagesRes.json()) as {
    data: { id: string; name: string; access_token: string }[]
  }

  const page = pagesData.data?.[0]
  if (!page) {
    return NextResponse.redirect(
      new URL(`/dashboard/businesses/${businessId}/connect?error=no_page`, req.url),
    )
  }

  const expiresAt = new Date(Date.now() + expires_in * 1000)

  // Verify business ownership
  const [business] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.userId, userId)))
    .limit(1)

  if (!business) {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_business', req.url))
  }

  const encryptedToken = isEncrypted(page.access_token)
    ? page.access_token
    : encrypt(page.access_token)

  // Store Facebook connection
  await db
    .insert(platformConnections)
    .values({
      id: crypto.randomUUID(),
      businessId,
      platform: 'facebook',
      accessToken: encryptedToken,
      refreshToken: null,
      tokenExpiresAt: expiresAt,
      platformAccountId: page.id,
      platformAccountName: page.name,
      permissionsGranted: ['pages_manage_posts', 'pages_read_engagement'],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [platformConnections.businessId, platformConnections.platform],
      set: {
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        platformAccountId: page.id,
        platformAccountName: page.name,
        permissionsGranted: ['pages_manage_posts', 'pages_read_engagement'],
        isActive: true,
        updatedAt: new Date(),
      },
    })

  // Also store for Instagram (same Page ID is used as Instagram Business Account)
  await db
    .insert(platformConnections)
    .values({
      id: crypto.randomUUID(),
      businessId,
      platform: 'instagram',
      accessToken: encryptedToken,
      refreshToken: null,
      tokenExpiresAt: expiresAt,
      platformAccountId: page.id,
      platformAccountName: page.name,
      permissionsGranted: ['instagram_basic', 'instagram_content_publish'],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [platformConnections.businessId, platformConnections.platform],
      set: {
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        platformAccountId: page.id,
        platformAccountName: page.name,
        permissionsGranted: ['instagram_basic', 'instagram_content_publish'],
        isActive: true,
        updatedAt: new Date(),
      },
    })

  return NextResponse.redirect(
    new URL(`/dashboard/businesses/${businessId}/connect?success=meta`, req.url),
  )
}
