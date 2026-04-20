import Link from 'next/link'

interface AlertBannerProps {
  count: number
}

export function FailedPostsBanner({ count }: AlertBannerProps) {
  if (count === 0) return null
  return (
    <div className="mb-6 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-red-500 text-lg">⚠️</span>
        <p className="text-sm text-red-700 font-medium">
          {count} post{count !== 1 ? 's' : ''} failed to publish
        </p>
      </div>
      <Link
        href="/dashboard/calendar?status=failed"
        className="text-sm text-red-600 font-medium hover:underline"
      >
        Review →
      </Link>
    </div>
  )
}
