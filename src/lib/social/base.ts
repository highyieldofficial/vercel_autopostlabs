// ─── Base Platform Adapter ────────────────────────────────────────────────────
// All platform adapters must implement this interface.

export interface PostPayload {
  caption: string
  hashtags: string[]
  mediaUrls: string[]   // public URLs to images/video
  ctaText?: string
  scheduledAt?: Date
}

export interface PublishResult {
  success: boolean
  externalPostId?: string
  externalUrl?: string
  error?: {
    code: string
    message: string
  }
}

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  platformAccountId: string
}

export abstract class BasePlatformAdapter {
  abstract readonly platform: string

  abstract publish(payload: PostPayload, tokens: TokenSet): Promise<PublishResult>

  abstract refreshTokens(tokens: TokenSet): Promise<TokenSet>

  abstract getMetrics(
    externalPostId: string,
    tokens: TokenSet
  ): Promise<Record<string, number>>
}
