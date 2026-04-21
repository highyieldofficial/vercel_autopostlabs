import { auth } from '@/lib/auth'
import Link from 'next/link'
import { api } from '@/lib/api'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IngestionStatus } from '@/components/ui/ingestion-status'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { Button } from '@/components/ui/button'
import { FailedPostsBanner } from '@/components/ui/alert-banner'

export default async function DashboardOverview() {
  const session = await auth()
  const userId = session?.user?.id

  const [businesses, pendingPosts, scheduledPosts, failedPosts] = await Promise.all([
    userId ? api.businesses.list(userId).catch(() => []) : Promise.resolve([]),
    userId ? api.posts.list({ status: 'pending_approval' }, userId).catch(() => []) : Promise.resolve([]),
    userId ? api.posts.list({ status: 'scheduled' }, userId).catch(() => []) : Promise.resolve([]),
    userId ? api.posts.list({ status: 'failed' }, userId).catch(() => []) : Promise.resolve([]),
  ])

  const totalProducts = (businesses as any[]).reduce((s: number, b) => s + (b._count?.products ?? 0), 0)
  const totalPosts = (businesses as any[]).reduce((s: number, b) => s + (b._count?.contentPosts ?? 0), 0)

  return (
    <div>
      <FailedPostsBanner count={failedPosts.length} />
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <Link href="/dashboard/businesses/new">
          <Button>+ Add store</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Stores connected" value={businesses.length} />
        <StatCard label="Products scanned" value={totalProducts} />
        <StatCard label="Posts generated" value={totalPosts} />
        <StatCard
          label="Pending approval"
          value={pendingPosts.length}
          trend={pendingPosts.length > 0 ? 'up' : 'neutral'}
        />
      </div>

      {businesses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4">🌱</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Connect your first store</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
            Paste your Shopify URL. AutoPost Labs will scan your products and generate ready-to-publish content.
          </p>
          <Link href="/dashboard/businesses/new">
            <Button>Connect a store</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Businesses */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Your Stores</CardTitle>
                <Link href="/dashboard/businesses" className="text-sm text-brand-600 hover:underline">
                  View all
                </Link>
              </CardHeader>
              <div className="space-y-3">
                {businesses.slice(0, 5).map((biz) => (
                  <Link
                    key={biz.id}
                    href={`/dashboard/businesses/${biz.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-sm">
                      {(biz.businessName ?? biz.websiteUrl).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {biz.businessName ?? biz.websiteUrl}
                      </p>
                      <p className="text-xs text-gray-400">
                        {biz._count?.products ?? 0} products · {biz._count?.contentPosts ?? 0} posts
                      </p>
                    </div>
                    <IngestionStatus status={biz.ingestionStatus} />
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Pending approvals */}
            <Card>
              <CardHeader>
                <CardTitle>Needs Approval</CardTitle>
                <Link href="/dashboard/approvals" className="text-sm text-brand-600 hover:underline">
                  View all
                </Link>
              </CardHeader>
              {pendingPosts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nothing pending ✓</p>
              ) : (
                <div className="space-y-2">
                  {pendingPosts.slice(0, 4).map((post) => (
                    <div key={post.id} className="flex items-center gap-2 py-1.5">
                      <PlatformIcon platform={post.platform} size="sm" />
                      <p className="text-sm text-gray-700 flex-1 truncate">
                        {post.product?.name ?? post.caption ?? 'Post'}
                      </p>
                    </div>
                  ))}
                  {pendingPosts.length > 4 && (
                    <p className="text-xs text-gray-400 text-center pt-1">
                      +{pendingPosts.length - 4} more
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Scheduled */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming</CardTitle>
                <Link href="/dashboard/calendar" className="text-sm text-brand-600 hover:underline">
                  Calendar
                </Link>
              </CardHeader>
              {scheduledPosts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No scheduled posts</p>
              ) : (
                <div className="space-y-2">
                  {scheduledPosts.slice(0, 4).map((post) => (
                    <div key={post.id} className="flex items-center gap-2 py-1.5">
                      <PlatformIcon platform={post.platform} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">
                          {post.product?.name ?? post.caption ?? 'Post'}
                        </p>
                        {post.scheduledAt && (
                          <p className="text-xs text-gray-400">
                            {new Date(post.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
