'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { Button } from '@/components/ui/button'
import type { Post } from '@/lib/api'

export function ApprovalCard({ post }: { post: Post }) {
  const [loading, setLoading] = useState<'approve' | 'delete' | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (dismissed) return null

  async function approve() {
    setLoading('approve')
    try {
      await fetch(`/api/posts/${post.id}/approve`, { method: 'POST' })
      setDismissed(true)
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function remove() {
    setLoading('delete')
    try {
      await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      setDismissed(true)
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  const imageUrl = post.mediaKeys?.[0]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
      {/* Image preview */}
      <div className="aspect-square relative bg-gray-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt="Post preview"
            fill
            className="object-cover"
            sizes="400px"
            unoptimized={imageUrl.startsWith('https://oaidalleapiprodscus')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
            🖼️
          </div>
        )}
        {/* Platform badge overlay */}
        <div className="absolute top-3 left-3">
          <PlatformIcon platform={post.platform} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {post.product?.name && (
          <p className="text-xs text-gray-400 mb-2">{post.product.name}</p>
        )}
        <p className="text-sm text-gray-800 leading-relaxed flex-1 line-clamp-4">
          {post.caption ?? <span className="text-gray-400 italic">No caption</span>}
        </p>
        {post.hashtags?.length > 0 && (
          <p className="text-xs text-brand-500 mt-2 line-clamp-2">
            {post.hashtags.map((h) => `#${h}`).join(' ')}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            className="flex-1"
            loading={loading === 'approve'}
            disabled={loading !== null}
            onClick={approve}
          >
            ✓ Approve
          </Button>
          <Button
            variant="secondary"
            loading={loading === 'delete'}
            disabled={loading !== null}
            onClick={remove}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  )
}
