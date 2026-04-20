import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone is only needed for Docker (Railway). Vercel handles its own
  // bundling and breaks pnpm virtual store tracing when standalone is enabled.
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  serverExternalPackages: ['postgres'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.shopify.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: 'oaidalleapiprodscus.blob.core.windows.net' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'stemkast.com', '*.stemkast.com'] },
  },
}

export default nextConfig
