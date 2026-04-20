import axios from 'axios'
import { BasePlatformAdapter, PostPayload, PublishResult, TokenSet } from '../base'

const V2_BASE = 'https://api.twitter.com/2'
const V1_MEDIA_BASE = 'https://upload.twitter.com/1.1'

// ─── Twitter/X Adapter ────────────────────────────────────────────────────────
// Text posting uses API v2. Media upload still requires v1.1.

export class TwitterAdapter extends BasePlatformAdapter {
  readonly platform = 'twitter'

  async publish(payload: PostPayload, tokens: TokenSet): Promise<PublishResult> {
    const text = [
      payload.caption,
      payload.hashtags.map((h) => `#${h}`).join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 280)

    const body: Record<string, unknown> = { text }

    // Upload media if present (v1.1 endpoint)
    if (payload.mediaUrls.length > 0) {
      const mediaIds = await Promise.all(
        payload.mediaUrls.slice(0, 4).map((url) => this._uploadMedia(url, tokens.accessToken))
      )
      body.media = { media_ids: mediaIds }
    }

    try {
      const res = await axios.post(`${V2_BASE}/tweets`, body, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      return { success: true, externalPostId: res.data.data.id }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { title?: string; detail?: string } } }
      return {
        success: false,
        error: {
          code: e.response?.data?.title ?? 'UNKNOWN',
          message: e.response?.data?.detail ?? 'Unknown error',
        },
      }
    }
  }

  async refreshTokens(tokens: TokenSet): Promise<TokenSet> {
    if (!tokens.refreshToken) return tokens
    const res = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: process.env.TWITTER_CLIENT_ID!,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    return {
      ...tokens,
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
    }
  }

  async getMetrics(externalPostId: string, tokens: TokenSet): Promise<Record<string, number>> {
    const res = await axios.get(`${V2_BASE}/tweets/${externalPostId}`, {
      params: {
        'tweet.fields': 'public_metrics',
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    })
    const m = res.data.data?.public_metrics ?? {}
    return {
      likes: m.like_count ?? 0,
      comments: m.reply_count ?? 0,
      shares: m.retweet_count ?? 0,
      impressions: m.impression_count ?? 0,
    }
  }

  private async _uploadMedia(imageUrl: string, accessToken: string): Promise<string> {
    // Fetch the image as a buffer
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer' })
    const base64 = Buffer.from(imgRes.data).toString('base64')

    const res = await axios.post(
      `${V1_MEDIA_BASE}/media/upload.json`,
      new URLSearchParams({ media_data: base64 }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    return res.data.media_id_string
  }
}
