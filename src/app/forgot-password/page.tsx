'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStatus('loading')

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setStatus('idle')
      return
    }

    setStatus('sent')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-brand-600">
            AutoPost Labs
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {status === 'sent' ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Check your email</h3>
              <p className="text-sm text-gray-500">
                If an account exists for <span className="font-medium text-gray-700">{email}</span>,
                we've sent a password reset link. It expires in 60 minutes.
              </p>
              <Link
                href="/sign-in"
                className="block text-sm text-brand-600 hover:underline font-medium mt-2"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-500">
                Enter your email and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-brand-700 transition-colors disabled:opacity-60"
              >
                {status === 'loading' ? 'Sending…' : 'Send reset link'}
              </button>

              <p className="text-center text-sm text-gray-500">
                <Link href="/sign-in" className="text-brand-600 hover:underline font-medium">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
