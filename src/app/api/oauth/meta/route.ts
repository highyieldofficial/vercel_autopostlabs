import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { createOAuthState, metaAuthUrl } from '@/lib/oauth'

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const state = createOAuthState(businessId)
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/oauth/meta/callback`
  const url = metaAuthUrl(state, redirectUri)

  return NextResponse.redirect(url)
}
