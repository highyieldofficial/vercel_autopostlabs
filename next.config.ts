import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone is only needed for Docker (Railway). Vercel handles its own
  // bundling and breaks pnpm virtual store tracing when standalone is enabled.
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  serverExternalPackages: ['postgres'],
  images: {
    remotePatterns: [
      // Allow any HTTPS/HTTP image source (product images come from any store)
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'autopostlabs.com', '*.autopostlabs.com'] },
  },
}

export default nextConfig
