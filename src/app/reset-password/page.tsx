'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setStatus('loading')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong')
      setStatus('idle')
      return
    }

    setStatus('done')
    setTimeout(() => router.push('/sign-in'), 2500)
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-red-600">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="text-brand-600 hover:underline text-sm font-medium">
          Request new link
        </Link>
      </div>
    )
  }

  return (
    <>
      {status === 'done' ? (
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">Password updated!</h3>
          <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Repeat your new password"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {status === 'loading' ? 'Updating…' : 'Set new password'}
          </button>
        </form>
      )}
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-brand-600">
            AutoPost Labs
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Set a new password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <Suspense fallback={<p className="text-sm text-gray-500 text-center">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
