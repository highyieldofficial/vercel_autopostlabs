'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { credentialsSignIn } from '@/actions/auth'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Step 1: create the account
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Something went wrong')
      setLoading(false)
      return
    }

    // Step 2: sign in via server action — redirects to /dashboard on success
    const result = await credentialsSignIn(email, password)
    if (result?.error) {
      // Account was created but auto sign-in failed — send to sign-in page
      setError('Account created! Redirecting to sign in…')
      setLoading(false)
      setTimeout(() => (window.location.href = '/sign-in'), 1500)
    }
    // On success credentialsSignIn throws NEXT_REDIRECT — component unmounts
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-brand-600">
            AutoPost Labs
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Create your free account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="At least 8 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-brand-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
