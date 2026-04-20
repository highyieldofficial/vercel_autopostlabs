export * from './base'
export * from './adapters/meta'
export * from './adapters/twitter'

import { MetaFacebookAdapter, MetaInstagramAdapter } from './adapters/meta'
import { TwitterAdapter } from './adapters/twitter'
import { BasePlatformAdapter, type PostPayload, type PublishResult, type TokenSet } from './base'

// ─── Adapter registry ─────────────────────────────────────────────────────────

const adapters: Record<string, BasePlatformAdapter> = {
  facebook: new MetaFacebookAdapter(),
  instagram: new MetaInstagramAdapter(),
  twitter: new TwitterAdapter(),
}

// Platforms that are recognised but not yet implemented — fail gracefully
const COMING_SOON = new Set(['tiktok', 'pinterest', 'linkedin'])

class ComingSoonAdapter extends BasePlatformAdapter {
  constructor(readonly platform: string) { super() }

  async publish(_payload: PostPayload, _tokens: TokenSet): Promise<PublishResult> {
    return {
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: `${this.platform} publishing is coming soon` },
    }
  }

  async refreshTokens(tokens: TokenSet): Promise<TokenSet> {
    return tokens // no-op
  }

  async getMetrics(_externalPostId: string, _tokens: TokenSet): Promise<Record<string, number>> {
    return {}
  }
}

export function getAdapter(platform: string): BasePlatformAdapter {
  const adapter = adapters[platform]
  if (adapter) return adapter
  if (COMING_SOON.has(platform)) return new ComingSoonAdapter(platform)
  throw new Error(`Unknown platform: ${platform}`)
}
