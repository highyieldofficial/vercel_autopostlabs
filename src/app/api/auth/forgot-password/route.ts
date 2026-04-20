import { NextRequest, NextResponse } from 'next/server'
import { db, users, verificationTokens } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { z } from 'zod'
import crypto from 'crypto'
import { rateLimit, getIp } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email(),
})

const EXPIRY_MINUTES = 60
const IDENTIFIER_PREFIX = 'password-reset:'

export async function POST(req: NextRequest) {
  // 3 password-reset requests per IP per 15 minutes
  const rl = rateLimit(`forgot-pw:${getIp(req)}`, 3, 15 * 60 * 1000)
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429 },
    )
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const { email } = parsed.data

  // Always return 200 to not leak whether an account exists
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    return NextResponse.json({ ok: true })
  }

  const identifier = `${IDENTIFIER_PREFIX}${email}`
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000)

  // Delete any existing reset token for this email
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier))

  // Insert new token
  await db.insert(verificationTokens).values({ identifier, token, expires })

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@autopostlabs.com',
    to: email,
    subject: 'Reset your AutoPost Labs password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;font-size:20px;color:#111">Reset your password</h2>
        <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6">
          We received a request to reset your AutoPost Labs password. Click the button
          below — this link expires in ${EXPIRY_MINUTES} minutes.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
          Reset password
        </a>
        <p style="margin:24px 0 0;color:#999;font-size:12px">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
