import { NextRequest, NextResponse } from 'next/server'
import { db, users, verificationTokens } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

const IDENTIFIER_PREFIX = 'password-reset:'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { token, password } = parsed.data

  // Find the token
  const record = await db.query.verificationTokens.findFirst({
    where: (t, { eq }) => eq(t.token, token),
  })

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }

  if (!record.identifier.startsWith(IDENTIFIER_PREFIX)) {
    return NextResponse.json({ error: 'Invalid reset link' }, { status: 400 })
  }

  if (record.expires < new Date()) {
    // Clean up expired token
    await db
      .delete(verificationTokens)
      .where(eq(verificationTokens.identifier, record.identifier))
    return NextResponse.json(
      { error: 'Reset link has expired. Please request a new one.' },
      { status: 400 },
    )
  }

  const email = record.identifier.slice(IDENTIFIER_PREFIX.length)
  const hashed = await bcrypt.hash(password, 12)

  await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.email, email))

  // Delete the used token
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, record.identifier))

  return NextResponse.json({ ok: true })
}
