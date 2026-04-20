import { auth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { DisconnectButton } from './disconnect-button'

const PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook',
    description: 'Auto-publish to your Facebook Page.',
    oauthPath: 'meta',
    note: 'Connects Facebook + Instagram in one flow.',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'Publish photos directly to Instagram Business.',
    oauthPath: null,
    note: 'Connected automatically with Facebook.',
  },
  {
    key: 'twitter',
    label: 'Twitter / X',
    description: 'Tweet your products with images.',
    oauthPath: 'twitter',
    note: null,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    description: 'Generate + download TikTok-ready content.',
    oauthPath: null,
    note: 'TikTok API approval in progress — download only for now.',
  },
] as const

export default async function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) notFound()

  const [biz, connections] = await Promise.all([
    api.businesses.get(id, userId).catch(() => null),
    api.connections.list(id, userId).catch(() => []),
  ])

  if (!biz) notFound()

  const connMap = Object.fromEntries(connections.map((c) => [c.platform, c]))

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/dashboard/businesses/${id}`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← {biz.businessName ?? biz.websiteUrl}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Connect Platforms</h1>
        <p className="text-gray-500 text-sm mt-1">
          Connect your social accounts to start publishing automatically.
        </p>
      </div>

      <div className="space-y-3">
        {PLATFORMS.map((platform) => {
          const conn = connMap[platform.key]
          const isConnected = conn?.isActive === true

          return (
            <Card key={platform.key}>
              <div className="flex items-center gap-4">
                <PlatformIcon platform={platform.key} size="lg" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{platform.label}</h3>
                    {isConnected && <Badge variant="green">Connected</Badge>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{platform.description}</p>
                  {platform.note && (
                    <p className="text-xs text-gray-400 mt-1">{platform.note}</p>
                  )}
                  {isConnected && conn.platformAccountName && (
                    <p className="text-xs text-brand-600 mt-1 font-medium">
                      {conn.platformAccountName}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {isConnected ? (
                    <DisconnectButton connectionId={conn.id} platform={platform.key} />
                  ) : platform.oauthPath ? (
                    <a
                      href={`/api/oauth/${platform.oauthPath}?businessId=${id}`}
                      className="inline-flex items-center justify-center bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      Connect
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      {platform.key === 'instagram' ? 'Via Facebook' : 'Coming soon'}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
