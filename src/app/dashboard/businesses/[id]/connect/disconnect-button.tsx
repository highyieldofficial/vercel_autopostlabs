'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface DisconnectButtonProps {
  connectionId: string
  platform: string
}

export function DisconnectButton({ connectionId, platform }: DisconnectButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handle() {
    if (!confirm(`Disconnect ${platform}? Scheduled posts for this platform will be cancelled.`)) return
    setLoading(true)
    try {
      await fetch(`/api/connections/${connectionId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handle}>
      Disconnect
    </Button>
  )
}
