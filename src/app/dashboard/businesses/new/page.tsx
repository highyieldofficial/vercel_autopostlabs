'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewBusinessPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: url }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to add business')
      }

      const data = await res.json()
      router.push(`/dashboard/businesses/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect a store</h1>
      <p className="text-gray-500 mb-8">
        Paste your Shopify store URL. We&apos;ll scan your products and brand automatically.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Store URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-store.myshopify.com"
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
        />

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Scanning store...' : 'Connect store'}
        </button>
      </form>

      <p className="text-xs text-gray-400 mt-4 text-center">
        We only read your public product data — we never modify your store.
      </p>
    </div>
  )
}
