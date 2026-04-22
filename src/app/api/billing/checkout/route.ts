import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { createCheckoutUrl, PLANS } from '@/lib/billing'
import { z } from 'zod'

const WEB_URL = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export async function GET(_req: NextRequest) {
  return NextResponse.json(PLANS)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = z.object({ plan: z.enum(['pro', 'agency']) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let url: string
  try {
    url = await createCheckoutUrl({
      userId: user.id,
      userEmail: user.email,
      plan: parsed.data.plan,
      successUrl: `${WEB_URL}/dashboard/billing?success=1`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create checkout'
    console.error('[checkout]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ url })
}
