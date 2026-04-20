import { auth } from '@/lib/auth'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IngestionStatus } from '@/components/ui/ingestion-status'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformIcon } from '@/components/ui/platform-icon'

export default async function BusinessesPage() {
  const session = await auth()
  const userId = session?.user?.id
  const businesses = userId ? await api.businesses.list(userId).catch(() => []) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
          <p className="text-sm text-gray-500 mt-1">
            {businesses.length} store{businesses.length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <Link href="/dashboard/businesses/new">
          <Button>+ Add store</Button>
        </Link>
      </div>

      {businesses.length === 0 ? (
        <EmptyState
          icon="🏪"
          title="No stores connected yet"
          description="Paste a Shopify URL to get started. We'll scan your products and generate social content automatically."
          action={{ label: 'Connect a store', href: '/dashboard/businesses/new' }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {businesses.map((biz) => (
            <Link key={biz.id} href={`/dashboard/businesses/${biz.id}`}>
              <Card className="hover:border-brand-200 transition-all h-full">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-900 truncate">
                      {biz.businessName ?? biz.websiteUrl}
                    </h2>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{biz.websiteUrl}</p>
                  </div>
                  <IngestionStatus status={biz.ingestionStatus} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{biz._count?.products ?? 0}</p>
                    <p className="text-xs text-gray-500">Products</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-gray-900">{biz._count?.contentPosts ?? 0}</p>
                    <p className="text-xs text-gray-500">Posts</p>
                  </div>
                </div>

                {/* Platform type */}
                <div className="flex items-center justify-between">
                  <Badge variant={biz.platformType === 'shopify' ? 'green' : 'default'}>
                    {biz.platformType}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {biz.lastCrawledAt
                      ? `Scanned ${new Date(biz.lastCrawledAt).toLocaleDateString()}`
                      : 'Not yet scanned'}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
