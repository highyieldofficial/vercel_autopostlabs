import Link from 'next/link'
import { auth } from '@/lib/auth'

export default async function LandingPage() {
  const session = await auth()

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-xl font-bold text-brand-600 tracking-tight">AutoPost Labs</span>
        <div className="flex items-center gap-4">
          {session ? (
            <Link
              href="/dashboard"
              className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          <span className="w-2 h-2 bg-brand-500 rounded-full" />
          AI-powered organic marketing
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Your store content,
          <br />
          <span className="text-brand-600">posted everywhere. Automatically.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Paste your Shopify URL. AutoPost Labs reads your products, generates platform-perfect social
          posts with AI, and publishes them on schedule — while you focus on running your business.
        </p>
        {session ? (
          <Link
            href="/dashboard"
            className="inline-block bg-brand-600 text-white font-semibold px-8 py-4 rounded-xl text-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-100"
          >
            Go to dashboard
          </Link>
        ) : (
          <Link
            href="/sign-up"
            className="inline-block bg-brand-600 text-white font-semibold px-8 py-4 rounded-xl text-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-100"
          >
            Connect your store — it&apos;s free
          </Link>
        )}
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: '🔍',
            title: 'Smart store scanning',
            desc: 'Paste any Shopify URL. We extract your products, prices, and brand identity automatically.',
          },
          {
            icon: '✨',
            title: 'AI content generation',
            desc: 'Platform-tuned captions and AI-generated lifestyle images for every product, every channel.',
          },
          {
            icon: '📅',
            title: 'Auto-publish & schedule',
            desc: 'Posts go live on Facebook, Instagram, Twitter, and TikTok on your schedule — no manual work.',
          },
        ].map((f) => (
          <div key={f.title} className="bg-gray-50 rounded-2xl p-6">
            <div className="text-3xl mb-4">{f.icon}</div>
            <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
