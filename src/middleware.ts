import { getToken } from 'next-auth/jwt'
import { NextResponse, type NextRequest } from 'next/server'

// Routes anyone can access without a session
const PUBLIC_PREFIXES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/api/auth/',
]

// Auth-only pages — redirect to /dashboard if already logged in
const AUTH_REDIRECT_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password']

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  })
  const isLoggedIn = !!token
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  )

  // Already logged in — bounce away from auth pages to dashboard
  if (
    isLoggedIn &&
    AUTH_REDIRECT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Not logged in — redirect to sign-in, preserving destination
  if (!isPublic && !isLoggedIn) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
