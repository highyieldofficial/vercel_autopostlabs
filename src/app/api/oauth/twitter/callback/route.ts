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
  const codeVerifier = req.cookies.get('twitter_cv')?.value

  if (error || !code || !state || !codeVerifier) {
    return NextResponse.redirect(new URL('/dashboard?error=twitter_oauth', req.url))
  }

  let businessId: string
  try {
    businessId = verifyOAuthState(state)
  } catch {
    return NextResponse.redirect(new URL('/dashboard?error=oauth_state', req.url))
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/oauth/twitter/callback`

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/dashboard?error=twitter_token', req.url))
  }

  const { access_token, refresh_token, expires_in } = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Get user info
  const userRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  const userData = (await userRes.json()) as {
    data: { id: string; name: string; username: string }
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

  const encryptedAccess = isEncrypted(access_token) ? access_token : encrypt(access_token)
  const encryptedRefresh = isEncrypted(refresh_token) ? refresh_token : encrypt(refresh_token)

  await db
    .insert(platformConnections)
    .values({
      id: crypto.randomUUID(),
      businessId,
      platform: 'twitter',
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      platformAccountId: userData.data?.id,
      platformAccountName: `@${userData.data?.username}`,
      permissionsGranted: ['tweet.read', 'tweet.write'],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [platformConnections.businessId, platformConnections.platform],
      set: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        platformAccountId: userData.data?.id,
        platformAccountName: `@${userData.data?.username}`,
        permissionsGranted: ['tweet.read', 'tweet.write'],
        isActive: true,
        updatedAt: new Date(),
      },
    })

  const response = NextResponse.redirect(
    new URL(`/dashboard/businesses/${businessId}/connect?success=twitter`, req.url),
  )
  response.cookies.delete('twitter_cv')
  return response
}
