import { auth } from '@/lib/auth'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/ui/empty-state'
import { CalendarGrid } from './calendar-grid'

export default async function CalendarPage() {
  const session = await auth()
  const userId = session?.user?.id
  const posts = userId
    ? await api.posts.list({}, userId).catch(() => [])
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {posts.length} posts total &middot; drag posts between days to reschedule
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon="📅"
          title="No posts yet"
          description="Generate content from your products and it will appear here for scheduling."
          action={{ label: 'Go to businesses', href: '/dashboard/businesses' }}
        />
      ) : (
        <CalendarGrid posts={posts} />
      )}
    </div>
  )
}
