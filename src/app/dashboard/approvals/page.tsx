import { auth } from '@/lib/auth'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/ui/empty-state'
import { ApprovalCard } from './approval-card'

export default async function ApprovalsPage() {
  const session = await auth()
  const userId = session?.user?.id
  const posts = userId
    ? await api.posts.list({ status: 'pending_approval' }, userId).catch(() => [])
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {posts.length} post{posts.length !== 1 ? 's' : ''} waiting for review
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon="✅"
          title="All clear!"
          description="No posts are waiting for approval. Generate content from your products to get started."
          action={{ label: 'Go to businesses', href: '/dashboard/businesses' }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <ApprovalCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
