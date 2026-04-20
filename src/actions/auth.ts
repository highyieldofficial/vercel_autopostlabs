'use server'

import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'

/**
 * Server action for credentials sign-in.
 * On success: throws NEXT_REDIRECT — Next.js navigates the browser to /dashboard automatically.
 * On failure: returns { error: string } so the client can show the message.
 *
 * This replaces the broken client-side signIn('credentials', { redirect: false })
 * pattern from next-auth/react which hangs indefinitely in NextAuth v5 beta.
 */
export async function credentialsSignIn(email: string, password: string) {
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password.' }
        default:
          return { error: `Sign-in failed (${error.type}). Check your AUTH_SECRET env var.` }
      }
    }
    // NEXT_REDIRECT is thrown on success — re-throw so Next.js handles navigation
    throw error
  }
}
