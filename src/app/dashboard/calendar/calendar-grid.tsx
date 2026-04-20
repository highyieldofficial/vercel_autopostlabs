'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/lib/api'
import { PlatformIcon } from '@/components/ui/platform-icon'
import { Badge } from '@/components/ui/badge'
import type { BadgeVariant } from '@/components/ui/badge'
import { PostActions } from './post-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, BadgeVariant> = {
  draft: 'default',
  pending_approval: 'yellow',
  scheduled: 'blue',
  publishing: 'purple',
  published: 'green',
  failed: 'red',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1)
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

// Build a 6-row × 7-col grid of Date | null for a given month
function buildGrid(year: number, month: number): (Date | null)[] {
  const first = startOfMonth(year, month)
  const offset = first.getDay() // 0=Sun
  const total = daysInMonth(year, month)
  const cells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ─── Component ────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  posts: Post[]
}

export function CalendarGrid({ posts }: CalendarGridProps) {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [rescheduling, setRescheduling] = useState<string | null>(null)

  // Index posts by date key
  const postsByDate: Record<string, Post[]> = {}
  const unscheduled: Post[] = []
  for (const post of posts) {
    if (post.scheduledAt) {
      const key = toDateKey(new Date(post.scheduledAt))
      if (!postsByDate[key]) postsByDate[key] = []
      postsByDate[key].push(post)
    } else if (post.publishedAt) {
      const key = toDateKey(new Date(post.publishedAt))
      if (!postsByDate[key]) postsByDate[key] = []
      postsByDate[key].push(post)
    } else {
      unscheduled.push(post)
    }
  }

  const grid = buildGrid(year, month)
  const todayKey = toDateKey(now)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const handleDrop = useCallback(async (targetDateKey: string) => {
    if (!draggingId) return
    setDropTarget(null)

    const post = posts.find(p => p.id === draggingId)
    if (!post) return

    // Build the new scheduledAt — preserve time if post has one, else set to noon
    const existing = post.scheduledAt ? new Date(post.scheduledAt) : null
    const [targetYear, targetMonthIdx, targetDay] = targetDateKey.split('-').map(Number)
    const newDate = new Date(
      targetYear,
      targetMonthIdx - 1,
      targetDay,
      existing ? existing.getHours() : 12,
      existing ? existing.getMinutes() : 0,
    )

    // Skip if same date
    if (existing && toDateKey(existing) === targetDateKey) return

    setRescheduling(draggingId)
    try {
      const res = await fetch(`/api/posts/${draggingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
      })
      if (res.ok) router.refresh()
    } finally {
      setRescheduling(null)
    }
  }, [draggingId, posts, router])

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          aria-label="Previous month"
        >
          ←
        </button>
        <h2 className="text-lg font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-gray-100 rounded-xl overflow-hidden">
        {grid.map((date, i) => {
          const key = date ? toDateKey(date) : `empty-${i}`
          const isToday = date ? key === todayKey : false
          const cellPosts = date ? (postsByDate[key] ?? []) : []
          const isDropTarget = dropTarget === key
          const isPast = date ? date < new Date(now.getFullYear(), now.getMonth(), now.getDate()) : false

          return (
            <div
              key={key}
              className={[
                'min-h-[100px] border-b border-r border-gray-100 p-1.5 transition-colors',
                date ? 'bg-white' : 'bg-gray-50',
                isToday ? 'bg-blue-50' : '',
                isDropTarget && date ? 'bg-brand-50 ring-2 ring-brand-300 ring-inset' : '',
              ].join(' ')}
              onDragOver={date ? (e) => { e.preventDefault(); setDropTarget(key) } : undefined}
              onDragLeave={date ? () => setDropTarget(t => t === key ? null : t) : undefined}
              onDrop={date ? () => handleDrop(key) : undefined}
            >
              {/* Date number */}
              {date && (
                <div className={[
                  'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-brand-600 text-white' : isPast ? 'text-gray-300' : 'text-gray-600',
                ].join(' ')}>
                  {date.getDate()}
                </div>
              )}

              {/* Posts on this day */}
              <div className="space-y-0.5">
                {cellPosts.slice(0, 3).map(post => (
                  <div
                    key={post.id}
                    draggable={post.status !== 'published' && post.status !== 'publishing'}
                    onDragStart={() => setDraggingId(post.id)}
                    onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
                    className={[
                      'group flex items-center gap-1 px-1 py-0.5 rounded text-xs cursor-grab active:cursor-grabbing select-none',
                      rescheduling === post.id ? 'opacity-40' : '',
                      draggingId === post.id ? 'opacity-50 ring-1 ring-brand-400' : '',
                      post.status === 'published' ? 'bg-green-50' :
                      post.status === 'failed' ? 'bg-red-50' :
                      post.status === 'scheduled' ? 'bg-blue-50' : 'bg-gray-50',
                    ].join(' ')}
                    title={post.caption ?? undefined}
                  >
                    <PlatformIcon platform={post.platform} size="xs" />
                    <span className="truncate flex-1 text-gray-700">
                      {post.product?.name ?? post.caption ?? 'Post'}
                    </span>
                  </div>
                ))}
                {cellPosts.length > 3 && (
                  <p className="text-xs text-gray-400 pl-1">+{cellPosts.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unscheduled posts */}
      {unscheduled.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Unscheduled ({unscheduled.length})
          </h3>
          <div className="space-y-2">
            {unscheduled.map(post => (
              <div
                key={post.id}
                draggable
                onDragStart={() => setDraggingId(post.id)}
                onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
                className={[
                  'bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-4 cursor-grab active:cursor-grabbing select-none',
                  draggingId === post.id ? 'opacity-50' : '',
                  rescheduling === post.id ? 'opacity-40' : '',
                ].join(' ')}
              >
                <PlatformIcon platform={post.platform} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {post.caption ?? <span className="text-gray-400 italic">No caption</span>}
                  </p>
                  {post.product?.name && (
                    <p className="text-xs text-gray-400 mt-0.5">{post.product.name}</p>
                  )}
                </div>
                <Badge variant={STATUS_BADGE[post.status] ?? 'default'}>
                  {post.status.replace('_', ' ')}
                </Badge>
                <PostActions post={post} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Drag unscheduled posts onto a calendar day to schedule them.
          </p>
        </div>
      )}
    </div>
  )
}
