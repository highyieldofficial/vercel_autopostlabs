/**
 * OAuth state management — stores businessId in a signed state param
 * so callbacks know which business to attach the connection to.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.OAUTH_STATE_SECRET ?? process.env.ENCRYPTION_KEY ?? 'dev-secret'

export function createOAuthState(businessId: string): string {
  const nonce = randomBytes(8).toString('hex')
  const payload = `${businessId}:${nonce}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyOAuthState(state: string): string {
  let decoded: string
  try {
    decoded = Buffer.from(state, 'base64url').toString('utf8')
  } catch {
    throw new Error('Invalid state param')
  }

  const parts = decoded.split(':')
  if (parts.length !== 3) throw new Error('Invalid state format')

  const [businessId, nonce, sig] = parts
  const payload = `${businessId}:${nonce}`
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16)

  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('State signature mismatch')
  }

  return businessId
}

// ─── Platform OAuth URLs ───────────────────────────────────────────────────────

export function metaAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_user_content',
    response_type: 'code',
    state,
  })
  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`
}

export function twitterAuthUrl(state: string, redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://twitter.com/i/oauth2/authorize?${params}`
}
