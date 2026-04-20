import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'

// All dashboard routes are authenticated and data-dynamic — never statically prerender
export const dynamic = 'force-dynamic'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/businesses', label: 'Businesses' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/approvals', label: 'Approvals' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/billing', label: 'Billing' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/')

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-6 px-4 gap-1">
        <Link href="/dashboard" className="text-lg font-bold text-brand-600 mb-6 px-2">
          AutoPost Labs
        </Link>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
          >
            {link.label}
          </Link>
        ))}
        <div className="mt-auto px-2">
          <p className="text-xs text-gray-500 truncate mb-2">{session.user?.email}</p>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/' })
            }}
          >
            <button
              type="submit"
              className="w-full text-left text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  )
}
