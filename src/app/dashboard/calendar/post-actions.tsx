'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/api'

const PUBLISHABLE = ['draft', 'pending_approval', 'scheduled', 'failed']

export function PostActions({ post }: { post: Post }) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function doAction(action: string) {
    setLoading(action)
    try {
      if (action === 'delete') {
        if (!confirm('Delete this post?')) return
        const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
        if (!res.ok) { alert('Failed to delete post.'); return }
        router.refresh()
      } else if (action === 'approve') {
        const res = await fetch(`/api/posts/${post.id}/approve`, { method: 'POST' })
        if (!res.ok) { alert('Failed to approve post.'); return }
        router.refresh()
      } else if (action === 'publish-now') {
        if (!confirm('Publish this post immediately?')) return
        const res = await fetch(`/api/posts/${post.id}/publish-now`, { method: 'POST' })
        if (!res.ok) { alert('Failed to publish post.'); return }
        router.refresh()
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {post.status === 'pending_approval' && (
        <button
          onClick={() => doAction('approve')}
          disabled={loading !== null}
          className="text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 rounded hover:bg-green-50 disabled:opacity-50"
        >
          {loading === 'approve' ? '…' : 'Approve'}
        </button>
      )}
      {PUBLISHABLE.includes(post.status) && (
        <button
          onClick={() => doAction('publish-now')}
          disabled={loading !== null}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded hover:bg-brand-50 disabled:opacity-50"
        >
          {loading === 'publish-now' ? '…' : '↑ Now'}
        </button>
      )}
      {(post.status === 'draft' || post.status === 'pending_approval') && (
        <button
          onClick={() => doAction('delete')}
          disabled={loading !== null}
          className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
        >
          {loading === 'delete' ? '…' : '✕'}
        </button>
      )}
    </div>
  )
}
