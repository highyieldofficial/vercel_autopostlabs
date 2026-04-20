import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, randomBytes } from 'node:crypto'
import { createOAuthState, twitterAuthUrl } from '@/lib/oauth'

// PKCE code verifier stored in cookie for the callback
export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const state = createOAuthState(businessId)
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHmac('sha256', codeVerifier)
    .update(codeVerifier)
    .digest('base64url')

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/oauth/twitter/callback`
  const url = twitterAuthUrl(state, redirectUri, codeChallenge)

  const response = NextResponse.redirect(url)
  // Store verifier in a short-lived httpOnly cookie
  response.cookies.set('twitter_cv', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })
  return response
}
