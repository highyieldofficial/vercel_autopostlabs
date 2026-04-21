import { NextRequest, NextResponse } from 'next/server'
import { db, users, subscriptions } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { verifyWhopWebhook, mapWhopStatus, PLANS } from '@/lib/billing'

// ─── Whop webhook event shapes ────────────────────────────────────────────────

interface WhopMembership {
  id: string
  user_id: string
  plan_id: string
  product_id?: string
  status: string
  valid_until: string | null
  cancel_at_period_end: boolean
  metadata?: { user_id?: string; plan?: string }
}

interface WhopWebhookEvent {
  action?: string
  event?: string
  data: WhopMembership
}

export async function POST(req: NextRequest) {
  const signatureHeader = req.headers.get('whop-signature')
  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing whop-signature header' }, { status: 400 })
  }

  const rawBody = await req.text()

  let valid: boolean
  try {
    valid = verifyWhopWebhook(rawBody, signatureHeader)
  } catch (err) {
    console.warn('[billing] Whop webhook verification error', err)
    return NextResponse.json({ error: 'Verification error' }, { status: 400 })
  }

  if (!valid) {
    console.warn('[billing] Whop webhook signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as WhopWebhookEvent
  console.log(`[billing] Whop event: ${event.action ?? event.event}`)

  try {
    await handleWhopEvent(event)
  } catch (err) {
    console.error('[billing] Whop webhook handler failed', err)
  }

  return NextResponse.json({ received: true })
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleWhopEvent(event: WhopWebhookEvent) {
  const action = event.action ?? event.event ?? ''
  const { data } = event

  const internalUserId = data.metadata?.user_id
  const plan = (data.metadata?.plan ?? 'pro') as keyof typeof PLANS

  if (!internalUserId) {
    console.warn('[billing] No user_id in Whop membership metadata')
    return
  }

  const [user] = await db.select().from(users).where(eq(users.id, internalUserId)).limit(1)
  if (!user) return

  switch (action) {
    case 'membership_activated': {
      await db
        .insert(subscriptions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          whopMembershipId: data.id,
          whopUserId: data.user_id,
          whopPlanId: data.plan_id,
          tier: plan as 'pro' | 'agency' | 'free',
          status: mapWhopStatus(data.status),
          currentPeriodEnd: data.valid_until ? new Date(data.valid_until) : null,
          cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
          updatedAt: new Date(),
        } as any)
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            whopMembershipId: data.id,
            whopUserId: data.user_id,
            whopPlanId: data.plan_id,
            tier: plan as 'pro' | 'agency' | 'free',
            status: mapWhopStatus(data.status),
            currentPeriodEnd: data.valid_until ? new Date(data.valid_until) : null,
            cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
            updatedAt: new Date(),
          },
        })
      break
    }

    case 'membership_cancel_at_period_end_changed': {
      await db
        .update(subscriptions)
        .set({ cancelAtPeriodEnd: data.cancel_at_period_end ?? true, updatedAt: new Date() } as any)
        .where(eq(subscriptions.whopMembershipId, data.id))
      break
    }

    case 'membership_deactivated': {
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          tier: 'free',
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        } as any)
        .where(eq(subscriptions.whopMembershipId, data.id))
      break
    }

    case 'payment_failed': {
      await db
        .update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() } as any)
        .where(eq(subscriptions.whopMembershipId, data.id))
      break
    }
  }
}
