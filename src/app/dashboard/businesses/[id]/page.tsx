import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IngestionStatus } from '@/components/ui/ingestion-status'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { GenerateButton } from './generate-button'
import { ReingestButton } from './reingest-button'
import { IngestionPoller } from './ingestion-poller'

const PLATFORMS = ['facebook', 'instagram', 'twitter', 'tiktok'] as const

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) notFound()

  const [biz, productData, connections] = await Promise.all([
    api.businesses.get(id, userId).catch(() => null),
    api.products.list({ businessId: id }, userId).catch(() => ({ products: [], total: 0, page: 1, limit: 24 })),
    api.connections.list(id, userId).catch(() => []),
  ])

  if (!biz) notFound()

  const connectedPlatforms = new Set(connections.filter((c) => c.isActive).map((c) => c.platform))

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard/businesses" className="text-sm text-gray-400 hover:text-gray-600">
              ← Businesses
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {biz.businessName ?? biz.websiteUrl}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <IngestionStatus status={biz.ingestionStatus} />
            <IngestionPoller businessId={id} status={biz.ingestionStatus} />
            <Badge variant={biz.platformType === 'shopify' ? 'green' : 'default'}>
              {biz.platformType}
            </Badge>
            <a
              href={biz.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-brand-600"
            >
              {biz.websiteUrl} ↗
            </a>
          </div>
        </div>
        <div className="flex gap-2">
          <ReingestButton businessId={id} isFailed={biz.ingestionStatus === 'failed'} />
          <Link href={`/dashboard/businesses/${id}/connect`}>
            <Button variant="secondary">Connect platforms</Button>
          </Link>
        </div>
      </div>

      {/* Failed state banner */}
      {biz.ingestionStatus === 'failed' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="mt-0.5 text-lg leading-none">⚠️</span>
          <div className="flex-1">
            <p className="font-medium">Store scan failed</p>
            <p className="mt-0.5 text-red-600">
              The crawler could not reach <strong>{biz.websiteUrl}</strong>. This can happen if the store
              is password-protected, the URL is invalid, or our crawler service is temporarily unavailable.
              Click <strong>↻ Rescan</strong> to try again.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column — main content */}
        <div className="xl:col-span-2 space-y-6">

          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle>Products ({productData.total})</CardTitle>
              <Link href={`/dashboard/businesses/${id}/products`} className="text-sm text-brand-600 hover:underline">
                View all
              </Link>
            </CardHeader>

            {productData.products.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {biz.ingestionStatus === 'completed'
                  ? 'No products found. Try rescanning the store.'
                  : 'Products will appear once the store scan completes.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productData.products.slice(0, 6).map((product) => {
                  const img = product.sourceImages?.[0]?.url
                  return (
                    <div
                      key={product.id}
                      className="group relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50"
                    >
                      {img ? (
                        <div className="aspect-square relative">
                          <Image
                            src={img}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                        </div>
                      ) : (
                        <div className="aspect-square flex items-center justify-center text-3xl bg-gray-100">
                          📦
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                        {product.price && (
                          <p className="text-xs text-gray-500">
                            {product.currency} {product.price}
                          </p>
                        )}
                      </div>
                      {/* Generate overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <GenerateButton productId={product.id} productName={product.name} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right column — brand + connections */}
        <div className="space-y-6">

          {/* Brand Profile */}
          {biz.brandProfile && (
            <Card>
              <CardHeader>
                <CardTitle>Brand Profile</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Voice</p>
                  <p className="text-gray-700">{biz.brandProfile.voice}</p>
                </div>
                {biz.brandProfile.targetAudience && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Audience</p>
                    <p className="text-gray-700">{biz.brandProfile.targetAudience}</p>
                  </div>
                )}
                {biz.brandProfile.toneKeywords?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Tone</p>
                    <div className="flex flex-wrap gap-1">
                      {biz.brandProfile.toneKeywords.map((kw) => (
                        <Badge key={kw} variant="brand">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {biz.brandProfile.primaryColors?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Colors</p>
                    <div className="flex gap-2">
                      {biz.brandProfile.primaryColors.map((color) => (
                        <span
                          key={color}
                          className="w-6 h-6 rounded-full border border-white shadow-sm ring-1 ring-gray-200"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Platform Connections */}
          <Card>
            <CardHeader>
              <CardTitle>Platforms</CardTitle>
              <Link href={`/dashboard/businesses/${id}/connect`}>
                <Button size="sm" variant="ghost">Manage</Button>
              </Link>
            </CardHeader>
            <div className="space-y-2">
              {PLATFORMS.map((platform) => {
                const isConnected = connectedPlatforms.has(platform)
                const conn = connections.find((c) => c.platform === platform)
                return (
                  <div key={platform} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={platform} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">{platform}</p>
                        {conn?.platformAccountName && (
                          <p className="text-xs text-gray-400">{conn.platformAccountName}</p>
                        )}
                      </div>
                    </div>
                    {isConnected ? (
                      <Badge variant="green">Connected</Badge>
                    ) : (
                      <Link href={`/dashboard/businesses/${id}/connect`}>
                        <Button size="sm" variant="ghost">Connect</Button>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
