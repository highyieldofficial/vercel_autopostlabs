import { clsx } from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function StatCard({ label, value, sub, trend, trendValue }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {(sub || trendValue) && (
        <div className="flex items-center gap-2 mt-1">
          {trendValue && (
            <span
              className={clsx(
                'text-xs font-medium',
                trend === 'up' && 'text-green-600',
                trend === 'down' && 'text-red-500',
                trend === 'neutral' && 'text-gray-400'
              )}
            >
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'} {trendValue}
            </span>
          )}
          {sub && <span className="text-xs text-gray-400">{sub}</span>}
        </div>
      )}
    </div>
  )
}
