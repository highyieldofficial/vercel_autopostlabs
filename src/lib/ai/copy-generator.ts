import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

let genAI: GoogleGenerativeAI | null = null
function getClient(): GoogleGenerativeAI {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  return genAI
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandProfile {
  voice: string
  toneKeywords: string[]
  targetAudience: string
  primaryColors: string[]
  tagline?: string
}

export interface ProductInfo {
  name: string
  description?: string
  price?: number
  currency?: string
  category?: string
  tags?: string[]
}

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'pinterest' | 'linkedin'

export interface GeneratedCopy {
  platform: SocialPlatform
  caption: string
  hashtags: string[]
  ctaText: string
  altText: string
}

// ─── Platform tone guidelines ─────────────────────────────────────────────────

const PLATFORM_GUIDELINES: Record<SocialPlatform, string> = {
  instagram: 'Aspirational, visually descriptive, 3-5 relevant hashtags inline plus 5-10 at the end, emoji-friendly, 150-220 chars caption',
  facebook: 'Conversational and warm, longer form 2-3 sentences, include a direct question to drive comments, 1-2 hashtags only',
  twitter: 'Punchy and concise under 240 chars total including hashtags, witty if brand allows, 1-2 hashtags max',
  tiktok: 'Trend-aware, energetic, heavy emoji use, 3-5 hashtags including trending ones like #fyp, short punchy hook first',
  pinterest: 'Descriptive and SEO-friendly, keyword-rich, inspirational tone, no hashtags needed',
  linkedin: 'Professional value-focused, lead with a data point or insight, 2-3 hashtags, 2-4 sentence caption',
}

// ─── Copy Generator ───────────────────────────────────────────────────────────

const copySchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  ctaText: z.string(),
  altText: z.string(),
})

export async function generateCopy(
  product: ProductInfo,
  brand: BrandProfile,
  platform: SocialPlatform
): Promise<GeneratedCopy> {
  const prompt = `You are a social media content expert for the brand described below.
Always match the brand voice exactly. Never invent features or prices not provided.

Brand voice: ${brand.voice}
Tone keywords: ${brand.toneKeywords.join(', ')}
Target audience: ${brand.targetAudience}
${brand.tagline ? `Tagline: ${brand.tagline}` : ''}

Platform guidelines for ${platform}: ${PLATFORM_GUIDELINES[platform]}

Generate a ${platform} post for this product:
Name: ${product.name}
${product.description ? `Description: ${product.description}` : ''}
${product.price ? `Price: ${product.currency ?? 'USD'} ${product.price}` : ''}
${product.category ? `Category: ${product.category}` : ''}
${product.tags?.length ? `Tags: ${product.tags.join(', ')}` : ''}

Respond ONLY with valid JSON (no markdown, no code fences):
{ "caption": string, "hashtags": string[], "ctaText": string, "altText": string }`

  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()

  // Strip markdown code fences if model includes them
  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  const parsed = copySchema.parse(JSON.parse(json))

  return { platform, ...parsed } as GeneratedCopy
}

// ─── Brand Analyzer ───────────────────────────────────────────────────────────

export async function analyzeBrand(websiteText: string, businessName: string): Promise<BrandProfile> {
  const prompt = `Extract brand profile from this website copy and respond ONLY with valid JSON (no markdown):
{ "voice": string, "toneKeywords": string[], "targetAudience": string, "tagline": string | null }

Business: ${businessName}

Website copy:
${websiteText.slice(0, 4000)}`

  const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  const raw = JSON.parse(json)

  return {
    voice: raw.voice ?? 'friendly and professional',
    toneKeywords: raw.toneKeywords ?? [],
    targetAudience: raw.targetAudience ?? 'general consumers',
    primaryColors: [],
    tagline: raw.tagline ?? undefined,
  }
}
