'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const POLLING_STATUSES = new Set(['pending', 'in_progress'])
const POLL_INTERVAL_MS = 3000

/**
 * Invisible component — mounts when ingestionStatus is pending/in_progress
 * and calls router.refresh() every 3 seconds so the server component
 * re-fetches the latest status. Stops automatically once status is terminal.
 */
export function IngestionPoller({
  businessId,
  status,
}: {
  businessId: string
  status: string
}) {
  const router = useRouter()

  useEffect(() => {
    if (!POLLING_STATUSES.has(status)) return

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/businesses/${businessId}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()

        if (!POLLING_STATUSES.has(data.ingestionStatus)) {
          // Terminal state reached — do one final refresh then stop
          clearInterval(id)
          router.refresh()
        } else {
          router.refresh()
        }
      } catch {
        // ignore transient fetch errors — keep polling
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(id)
  }, [businessId, status, router])

  return null
}
