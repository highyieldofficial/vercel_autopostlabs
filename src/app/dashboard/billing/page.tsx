import { auth } from '@/lib/auth'
import { api, type BillingStatus, type BillingPlans } from '@/lib/api'
import { CheckoutButton } from './checkout-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function statusBadge(status: BillingStatus['status']) {
  const map: Record<BillingStatus['status'], { label: string; className: string }> = {
    active:   { label: 'Active',    className: 'bg-green-100 text-green-700' },
    trialing: { label: 'Trial',     className: 'bg-blue-100 text-blue-700' },
    past_due: { label: 'Past due',  className: 'bg-yellow-100 text-yellow-700' },
    canceled: { label: 'Canceled',  className: 'bg-red-100 text-red-700' },
  }
  const s = map[status] ?? map.active
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>{s.label}</span>
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-600">
      <svg className="w-4 h-4 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {children}
    </li>
  )
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const session = await auth()
  const userId = session?.user?.id

  const [status, plans] = await Promise.all([
    userId ? api.billing.status(userId).catch((): BillingStatus => ({ tier: 'free', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEndsAt: null })) : Promise.resolve<BillingStatus>({ tier: 'free', status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEndsAt: null }),
    userId ? api.billing.plans(userId).catch(() => null) : Promise.resolve<BillingPlans | null>(null),
  ])

  const params = await searchParams
  const justUpgraded = params.success === '1'

  const currentTier = status.tier

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
      </div>

      {/* Success banner */}
      {justUpgraded && (
        <div className="mb-6 rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-green-800">
            You&apos;re all set! Your subscription is now active.
          </p>
        </div>
      )}

      {/* Current plan summary */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-4 pb-1">
          <div>
            <p className="text-2xl font-bold text-gray-900 capitalize">{currentTier}</p>
            {plans && <p className="text-sm text-gray-500 mt-0.5">{plans[currentTier].name} plan</p>}
          </div>
          <div>{statusBadge(status.status)}</div>
          {status.currentPeriodEnd && !status.cancelAtPeriodEnd && (
            <p className="text-sm text-gray-500 ml-auto">Renews {formatDate(status.currentPeriodEnd)}</p>
          )}
          {status.cancelAtPeriodEnd && status.currentPeriodEnd && (
            <p className="text-sm text-red-500 ml-auto">Cancels {formatDate(status.currentPeriodEnd)}</p>
          )}
          {status.trialEndsAt && (
            <p className="text-sm text-blue-600 ml-auto">Trial ends {formatDate(status.trialEndsAt)}</p>
          )}
        </div>
      </Card>

      {/* Pricing plans */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Free */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Free</p>
            <p className="text-3xl font-bold text-gray-900">$0<span className="text-base font-normal text-gray-400">/mo</span></p>
          </div>
          <ul className="space-y-2 flex-1">
            <PlanFeature>1 store</PlanFeature>
            <PlanFeature>1 post / month</PlanFeature>
            <PlanFeature>1 platform</PlanFeature>
          </ul>
          {currentTier === 'free' ? (
            <span className="block text-center text-sm font-medium text-gray-400 border border-gray-200 rounded-xl py-2">
              Current plan
            </span>
          ) : null}
        </div>

        {/* Pro */}
        <div className={`rounded-2xl border-2 bg-white p-6 flex flex-col gap-4 relative ${currentTier === 'pro' ? 'border-brand-500' : 'border-gray-200'}`}>
          {currentTier !== 'pro' && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
              Most popular
            </span>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pro</p>
            <p className="text-3xl font-bold text-gray-900">$29<span className="text-base font-normal text-gray-400">/mo</span></p>
          </div>
          <ul className="space-y-2 flex-1">
            <PlanFeature>1 store</PlanFeature>
            <PlanFeature>30 posts / month</PlanFeature>
            <PlanFeature>5 platforms</PlanFeature>
            <PlanFeature>Full analytics</PlanFeature>
          </ul>
          {currentTier === 'pro' ? (
            <span className="block text-center text-sm font-medium text-brand-600 border border-brand-200 bg-brand-50 rounded-xl py-2">
              Current plan
            </span>
          ) : (
            <CheckoutButton plan="pro" label={currentTier === 'agency' ? 'Downgrade to Pro' : 'Upgrade to Pro'} />
          )}
        </div>

        {/* Agency */}
        <div className={`rounded-2xl border-2 bg-white p-6 flex flex-col gap-4 ${currentTier === 'agency' ? 'border-brand-500' : 'border-gray-200'}`}>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Agency</p>
            <p className="text-3xl font-bold text-gray-900">$99<span className="text-base font-normal text-gray-400">/mo</span></p>
          </div>
          <ul className="space-y-2 flex-1">
            <PlanFeature>5 stores</PlanFeature>
            <PlanFeature>30 posts / store / month</PlanFeature>
            <PlanFeature>All platforms</PlanFeature>
            <PlanFeature>Full analytics</PlanFeature>
          </ul>
          {currentTier === 'agency' ? (
            <span className="block text-center text-sm font-medium text-brand-600 border border-brand-200 bg-brand-50 rounded-xl py-2">
              Current plan
            </span>
          ) : (
            <CheckoutButton plan="agency" label="Upgrade to Agency" />
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Payments processed securely by Whop. Cancel anytime from your Whop dashboard.
      </p>
    </div>
  )
}
