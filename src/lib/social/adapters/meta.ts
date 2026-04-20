import axios from 'axios'
import { BasePlatformAdapter, PostPayload, PublishResult, TokenSet } from '../base'

const GRAPH_BASE = 'https://graph.facebook.com/v19.0'

// ─── Meta (Facebook + Instagram) Adapter ─────────────────────────────────────
// Uses Meta Graph API v19.
// Instagram requires a 2-step publish: create container → publish container.

export class MetaFacebookAdapter extends BasePlatformAdapter {
  readonly platform = 'facebook'

  async publish(payload: PostPayload, tokens: TokenSet): Promise<PublishResult> {
    const caption = [payload.caption, ...payload.hashtags.map((h) => `#${h}`)].join(' ')

    try {
      // Upload photo first if media present
      let photoIds: string[] = []
      if (payload.mediaUrls.length > 0) {
        photoIds = await Promise.all(
          payload.mediaUrls.map((url) =>
            this._uploadPhoto(url, tokens.accessToken, tokens.platformAccountId, true)
          )
        )
      }

      const body: Record<string, unknown> = { message: caption, access_token: tokens.accessToken }
      if (photoIds.length === 1) {
        body.attached_media = [{ media_fbid: photoIds[0] }]
      }

      const res = await axios.post(`${GRAPH_BASE}/${tokens.platformAccountId}/feed`, body)
      return { success: true, externalPostId: res.data.id }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { code?: number; message?: string } } } }
      return {
        success: false,
        error: {
          code: String(e.response?.data?.error?.code ?? 'UNKNOWN'),
          message: e.response?.data?.error?.message ?? 'Unknown error',
        },
      }
    }
  }

  async refreshTokens(tokens: TokenSet): Promise<TokenSet> {
    // Facebook long-lived tokens don't need refresh (60 day, exchanged on first auth)
    // Page tokens don't expire — return as-is
    return tokens
  }

  async getMetrics(externalPostId: string, tokens: TokenSet): Promise<Record<string, number>> {
    const fields = 'likes.summary(true),comments.summary(true),shares,impressions,reach'
    const res = await axios.get(`${GRAPH_BASE}/${externalPostId}`, {
      params: { fields, access_token: tokens.accessToken },
    })
    const d = res.data
    return {
      likes: d.likes?.summary?.total_count ?? 0,
      comments: d.comments?.summary?.total_count ?? 0,
      shares: d.shares?.count ?? 0,
      impressions: d.impressions ?? 0,
      reach: d.reach ?? 0,
    }
  }

  private async _uploadPhoto(
    url: string,
    accessToken: string,
    pageId: string,
    published: boolean
  ): Promise<string> {
    const res = await axios.post(`${GRAPH_BASE}/${pageId}/photos`, {
      url,
      published,
      access_token: accessToken,
    })
    return res.data.id
  }
}

export class MetaInstagramAdapter extends BasePlatformAdapter {
  readonly platform = 'instagram'

  async publish(payload: PostPayload, tokens: TokenSet): Promise<PublishResult> {
    const caption = [payload.caption, ...payload.hashtags.map((h) => `#${h}`)].join('\n\n')
    const imageUrl = payload.mediaUrls[0]

    try {
      // Step 1: Create media container
      const containerRes = await axios.post(
        `${GRAPH_BASE}/${tokens.platformAccountId}/media`,
        { image_url: imageUrl, caption, access_token: tokens.accessToken }
      )
      const containerId: string = containerRes.data.id

      // Step 2: Poll until container is ready
      await this._waitForContainer(containerId, tokens.accessToken)

      // Step 3: Publish the container
      const publishRes = await axios.post(
        `${GRAPH_BASE}/${tokens.platformAccountId}/media_publish`,
        { creation_id: containerId, access_token: tokens.accessToken }
      )

      return { success: true, externalPostId: publishRes.data.id }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { code?: number; message?: string } } } }
      return {
        success: false,
        error: {
          code: String(e.response?.data?.error?.code ?? 'UNKNOWN'),
          message: e.response?.data?.error?.message ?? 'Unknown error',
        },
      }
    }
  }

  async refreshTokens(tokens: TokenSet): Promise<TokenSet> {
    return tokens
  }

  async getMetrics(externalPostId: string, tokens: TokenSet): Promise<Record<string, number>> {
    const fields = 'like_count,comments_count,impressions,reach,saved,plays'
    const res = await axios.get(`${GRAPH_BASE}/${externalPostId}/insights`, {
      params: { metric: fields, access_token: tokens.accessToken },
    })
    const metrics: Record<string, number> = {}
    for (const item of res.data.data ?? []) {
      metrics[item.name] = item.values?.[0]?.value ?? 0
    }
    return metrics
  }

  private async _waitForContainer(
    containerId: string,
    accessToken: string,
    maxAttempts = 10
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await axios.get(`${GRAPH_BASE}/${containerId}`, {
        params: { fields: 'status_code', access_token: accessToken },
      })
      if (res.data.status_code === 'FINISHED') return
      if (res.data.status_code === 'ERROR') throw new Error('Instagram container processing failed')
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('Instagram container timed out')
  }
}
