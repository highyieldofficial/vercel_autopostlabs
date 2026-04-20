import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoPost Labs — Organic Marketing on Autopilot',
  description:
    'Connect your store, generate social content with AI, and auto-publish to every platform.',
  metadataBase: new URL('https://autopostlabs.com'),
  openGraph: {
    title: 'AutoPost Labs',
    description: 'AI-powered organic marketing for e-commerce stores.',
    url: 'https://autopostlabs.com',
    siteName: 'AutoPost Labs',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
