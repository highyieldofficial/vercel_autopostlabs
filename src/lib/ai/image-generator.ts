import OpenAI from 'openai'

let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

export interface GenerateImageOptions {
  productName: string
  productDescription?: string
  brandColors?: string[]
  sourceImageUrl?: string
  platform?: string
}

export interface GeneratedImage {
  url: string
  prompt: string
  model: string
  revisedPrompt?: string
}

// ─── Platform aspect ratio hints ──────────────────────────────────────────────

const PLATFORM_SIZE: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
  instagram: '1024x1024',
  facebook: '1792x1024',
  twitter: '1792x1024',
  tiktok: '1024x1792',
  pinterest: '1024x1792',
  linkedin: '1792x1024',
}

// ─── Image Generator ──────────────────────────────────────────────────────────

export async function generateProductImage(opts: GenerateImageOptions): Promise<GeneratedImage | null> {
  if (!process.env.OPENAI_API_KEY) {
    // Image generation requires OpenAI DALL-E — skip gracefully when key not configured
    return null
  }

  const colorHint = opts.brandColors?.length
    ? `Brand colors: ${opts.brandColors.join(', ')}.`
    : ''

  const prompt = `Professional product lifestyle photography for social media.
Product: ${opts.productName}.
${opts.productDescription ? `Details: ${opts.productDescription}.` : ''}
${colorHint}
Clean background, high quality, commercial photography style, no text or logos.`

  const size = PLATFORM_SIZE[opts.platform ?? 'instagram'] ?? '1024x1024'

  const response = await getOpenAI().images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    quality: 'standard',
  })

  const image = response.data?.[0]
  if (!image?.url) throw new Error('No image URL returned from DALL-E')

  return {
    url: image.url,
    prompt,
    model: 'dall-e-3',
    revisedPrompt: image.revised_prompt,
  }
}
