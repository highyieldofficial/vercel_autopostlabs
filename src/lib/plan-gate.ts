/**
 * Plan limit helpers — single source of truth for enforcement.
 *
 * Admin bypass: set ADMIN_EMAILS env var to a comma-separated list of emails
 * that should receive unlimited access (all gates return true).
 */

import { db, subscriptions, businesses, contentPosts, platformConnections } from '@/lib/db'
import { eq, count, and, gte, inArray } from 'drizzle-orm'
import { PLANS, type PlanKey } from '@/lib/billing'

// ─── Admin list ───────────────────────────────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanLimits {
  tier: PlanKey
  isAdmin: boolean
  maxBusinesses: number      // Infinity = unlimited
  maxPostsPerMonth: number   // Infinity = unlimited
  maxPlatforms: number       // Infinity = unlimited
  hasAnalytics: boolean
}

// ─── Main gate lookup ─────────────────────────────────────────────────────────

export async function getPlanLimits(
  userId: string,
  userEmail?: string | null,
): Promise<PlanLimits> {
  // Admin bypass — unlimited access
  const email = userEmail?.toLowerCase() ?? ''
  if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email)) {
    return {
      tier: 'agency',
      isAdmin: true,
      maxBusinesses: Infinity,
      maxPostsPerMonth: Infinity,
      maxPlatforms: Infinity,
      hasAnalytics: true,
    }
  }

  const sub = await db.query.subscriptions.findFirst({
    where: (s, { eq }) => eq(s.userId, userId),
  })

  const isActive = sub?.status === 'active' || sub?.status === 'trialing'
  const tier: PlanKey = isActive ? (sub!.tier as PlanKey) : 'free'
  const plan = PLANS[tier]

  return {
    tier,
    isAdmin: false,
    maxBusinesses: plan.businesses,
    maxPostsPerMonth: plan.postsPerMonth,
    maxPlatforms: plan.platforms,
    hasAnalytics: tier !== 'free',
  }
}

// ─── Count helpers ────────────────────────────────────────────────────────────

export async function countUserBusinesses(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(businesses)
    .where(eq(businesses.userId, userId))
  return row?.n ?? 0
}

export async function countPostsThisMonth(userBusinessIds: string[]): Promise<number> {
  if (userBusinessIds.length === 0) return 0
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const [row] = await db
    .select({ n: count() })
    .from(contentPosts)
    .where(
      and(
        inArray(contentPosts.businessId, userBusinessIds),
        gte(contentPosts.createdAt, start),
      ),
    )
  return row?.n ?? 0
}

export async function countActivePlatformConnections(businessId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.businessId, businessId),
        eq(platformConnections.isActive, true),
      ),
    )
  return row?.n ?? 0
}

// ─── Upgrade message helper ───────────────────────────────────────────────────

export function upgradeMsg(tier: PlanKey, reason: string): string {
  const next = tier === 'free' ? 'Pro ($29/mo)' : 'Agency ($99/mo)'
  return `${reason} Upgrade to ${next} at /dashboard/billing.`
}
