/**
 * @autopostlabs/billing
 *
 * Whop billing integration.
 * Whop is a payments platform for digital products with built-in
 * tax handling and a global checkout experience.
 *
 * Docs: https://dev.whop.com/
 */

import crypto from 'node:crypto'

// ─── Pricing config ───────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    businesses: 1,
    postsPerMonth: 1,
    platforms: 1,
    planId: null,
  },
  pro: {
    name: 'Pro',
    price: 29,
    businesses: 1,
    postsPerMonth: 30,
    platforms: 5,
    planId: process.env.WHOP_PRO_PLAN_ID ?? null,
  },
  agency: {
    name: 'Agency',
    price: 99,
    businesses: 5,
    postsPerMonth: 150, // 30 posts per store × 5 stores
    platforms: 6,
    planId: process.env.WHOP_AGENCY_PLAN_ID ?? null,
  },
} as const

export type PlanKey = keyof typeof PLANS

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutUrl(opts: {
  userId: string
  userEmail: string
  plan: Exclude<PlanKey, 'free'>
  successUrl: string
}): Promise<string> {
  const apiKey = process.env.WHOP_API_KEY
  if (!apiKey) throw new Error('WHOP_API_KEY is not set')

  const plan = PLANS[opts.plan]
  if (!plan.planId) throw new Error(`Plan ${opts.plan} has no Whop product ID configured`)

  // Whop: prod_... → product_id field (v1); plan_... → plan_id field (v2 then v1)
  const isProd = plan.planId.startsWith('prod_')
  const idField = isProd ? 'product_id' : 'plan_id'

  const payload = {
    [idField]: plan.planId,
    redirect_url: opts.successUrl,
    metadata: {
      user_id: opts.userId,
      user_email: opts.userEmail,
      plan: opts.plan,
    },
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // prod_ IDs only work on v1; plan_ IDs try v2 first then fall back to v1
  const endpoints = isProd
    ? ['https://api.whop.com/api/v1/checkout_configurations']
    : ['https://api.whop.com/api/v2/checkout_sessions', 'https://api.whop.com/api/v1/checkout_configurations']

  let res!: Response
  for (const endpoint of endpoints) {
    res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) })
    if (res.ok || (res.status !== 404 && res.status !== 422 && res.status !== 400)) break
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Whop checkout error ${res.status}: ${err}`)
  }

  const data = await res.json() as { purchase_url?: string; checkout_url?: string; url?: string }
  const url = data.purchase_url ?? data.checkout_url ?? data.url
  if (!url) throw new Error('Whop did not return a checkout URL')

  return url
}

// ─── Webhook verification ─────────────────────────────────────────────────────
// Whop signs webhooks with: HMAC-SHA256( "{timestamp}.{rawBody}", secret )
// Header format: "whop-signature: t={ts},v1={hex_sig}"

export function verifyWhopWebhook(rawBody: string, signatureHeader: string): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET
  if (!secret) throw new Error('WHOP_WEBHOOK_SECRET is not set')

  // Parse "t=1234,v1=abcdef"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=') as [string, string])
  )
  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  const payload = `${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// ─── Membership status helpers ────────────────────────────────────────────────

export function mapWhopStatus(whopStatus: string): 'active' | 'past_due' | 'canceled' | 'trialing' {
  switch (whopStatus) {
    case 'active':
    case 'completed':   return 'active'
    case 'trialing':    return 'trialing'
    case 'past_due':    return 'past_due'
    case 'canceled':
    case 'cancelled':
    case 'expired':
    case 'invalid':     return 'canceled'
    default:            return 'active'
  }
}
