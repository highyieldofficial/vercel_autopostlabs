import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { rateLimit, getIp } from '@/lib/rate-limit'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export async function POST(req: NextRequest) {
  // 5 registrations per IP per hour
  const rl = rateLimit(`register:${getIp(req)}`, 5, 60 * 60 * 1000)
  if (rl.ok === false) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 },
    )
  }

  const body = await req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    const firstError =
      Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ??
      parsed.error.flatten().formErrors[0] ??
      'Invalid input'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { email, password, name } = parsed.data

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const newUser: typeof users.$inferInsert = {
    id: crypto.randomUUID(),
    email,
    password: hashed,
    name: name ?? null,
    updatedAt: new Date(),
  }
  await db.insert(users).values(newUser)

  return NextResponse.json({ ok: true }, { status: 201 })
}
