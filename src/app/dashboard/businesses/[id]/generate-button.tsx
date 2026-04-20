'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

const PLATFORMS = ['facebook', 'instagram', 'twitter', 'tiktok'] as const

interface GenerateButtonProps {
  productId: string
  productName: string
}

export function GenerateButton({ productId, productName }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: [...PLATFORMS] }),
      })
      if (res.ok) setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span className="bg-white text-green-600 text-xs font-medium px-3 py-1.5 rounded-lg">
        ✓ Queued
      </span>
    )
  }

  return (
    <Button size="sm" loading={loading} onClick={handleGenerate}>
      ✨ Generate
    </Button>
  )
}
