import { auth } from '@/lib/auth'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { EngagementChart } from './engagement-chart'
import { api } from '@/lib/api'

export default async function AnalyticsPage() {
  const session = await auth()
  const userId = session?.user?.id
  const data = userId ? await api.analytics.summary(userId).catch(() => null) : null

  if (!data || data.totals.published === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Analytics</h1>
        <EmptyState
          icon="📊"
          title="No data yet"
          description="Analytics will appear once your first posts are published. Generate and approve some content to get started."
          action={{ label: 'Go to approvals', href: '/dashboard/approvals' }}
        />
      </div>
    )
  }

  const { totals, byPlatform, topPosts } = data
  const engagementRate = totals.reach > 0
    ? (((totals.likes + totals.comments + totals.shares) / totals.reach) * 100).toFixed(1)
    : '0'

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
          Data updates every 24–48h
        </span>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Posts published" value={totals.published} />
        <StatCard label="Total reach" value={totals.reach.toLocaleString()} />
        <StatCard label="Total impressions" value={totals.impressions.toLocaleString()} />
        <StatCard label="Avg engagement rate" value={`${engagementRate}%`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Engagement breakdown */}
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown</CardTitle>
            </CardHeader>
            <EngagementChart
              data={[
                { name: 'Likes', value: totals.likes, color: '#22c55e' },
                { name: 'Comments', value: totals.comments, color: '#3b82f6' },
                { name: 'Shares', value: totals.shares, color: '#a855f7' },
              ]}
            />
          </Card>

          {/* Top posts table */}
          {topPosts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Posts by Engagement</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {topPosts.map((post, i) => (
                  <div key={post.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-bold text-gray-300 w-5">{i + 1}</span>
                    <PlatformIcon platform={post.platform} size="sm" />
                    <div className="flex-1 min-w-0">
                      {post.productName && (
                        <p className="text-xs text-gray-400 truncate">{post.productName}</p>
                      )}
                      <p className="text-sm text-gray-800 truncate">
                        {post.caption ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{post.engagement.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">engagements</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Platform breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Posts by Platform</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {byPlatform.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
              ) : (
                byPlatform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between">
                    <PlatformIcon platform={p.platform} size="sm" showLabel />
                    <span className="text-sm font-semibold text-gray-900">{p.posts}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Engagement Totals</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {[
                { label: '❤️ Likes', value: totals.likes },
                { label: '💬 Comments', value: totals.comments },
                { label: '🔁 Shares', value: totals.shares },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{m.label}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {m.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
