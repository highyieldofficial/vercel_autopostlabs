'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export function ReingestButton({ businessId, isFailed }: { businessId: string; isFailed?: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handle() {
    setLoading(true)
    try {
      await fetch(`/api/businesses/${businessId}/ingest`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={isFailed ? 'primary' : 'secondary'} loading={loading} onClick={handle}>
      ↻ Rescan
    </Button>
  )
}
