/**
 * One-time admin user seed endpoint.
 * Protected by ADMIN_SEED_KEY env var.
 *
 * Usage (run once):
 *   POST https://your-domain.com/api/admin/seed?key=YOUR_ADMIN_SEED_KEY
 *
 * Idempotent — safe to call multiple times (upserts).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, users, subscriptions } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const ADMIN_EMAIL = 'highyieldofficial@gmail.com'
const ADMIN_NAME = 'Admin'
const ADMIN_PASSWORD = 'buttertoast'

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  const envKey = process.env.ADMIN_SEED_KEY

  if (!envKey) {
    return NextResponse.json({ error: 'ADMIN_SEED_KEY env var not set' }, { status: 500 })
  }
  if (!key || key !== envKey) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12)

  // Upsert user
  const existing = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, ADMIN_EMAIL),
  })

  let uid: string

  if (existing) {
    await db
      .update(users)
      .set({ password: hashed, name: ADMIN_NAME, updatedAt: new Date() } as any)
      .where(eq(users.id, existing.id))
    uid = existing.id
  } else {
    uid = crypto.randomUUID()
    await db.insert(users).values({
      id: uid,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashed,
      updatedAt: new Date(),
    } as any)
  }

  // Upsert subscription — agency tier so billing page shows correct plan
  const existingSub = await db.query.subscriptions.findFirst({
    where: (s, { eq }) => eq(s.userId, uid),
  })

  if (existingSub) {
    await db
      .update(subscriptions)
      .set({ tier: 'agency', status: 'active', updatedAt: new Date() } as any)
      .where(eq(subscriptions.userId, uid))
  } else {
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId: uid,
      tier: 'agency',
      status: 'active',
      updatedAt: new Date(),
    } as any)
  }

  return NextResponse.json({ ok: true, userId: uid, email: ADMIN_EMAIL })
}
