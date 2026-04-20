'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CheckoutButtonProps {
  plan: 'pro' | 'agency'
  label: string
}

export function CheckoutButton({ plan, label }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Button
        className="w-full"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Redirecting…' : label}
      </Button>
      {error && <p className="text-xs text-red-500 text-center">{error}</p>}
    </div>
  )
}
