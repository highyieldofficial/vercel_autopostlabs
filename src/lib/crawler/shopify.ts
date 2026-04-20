import * as cheerio from 'cheerio'

export interface CrawledProduct {
  external_id: string
  name: string
  description?: string
  price?: number
  currency: string
  category?: string
  tags: string[]
  images: Array<{ url: string; alt: string; width?: number; height?: number }>
  handle?: string
}

export interface CrawlResult {
  business_name: string | null
  platform_type: 'shopify' | 'generic'
  products: CrawledProduct[]
  brand_text: string
  colors: string[]
}

export async function crawlShopify(baseUrl: string): Promise<CrawlResult | null> {
  const base = baseUrl.replace(/\/$/, '')

  try {
    const res = await fetch(`${base}/products.json?limit=250`, {
      headers: { 'User-Agent': 'AutoPostLabs/1.0' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.products) return null

    const products: CrawledProduct[] = (data.products as any[]).slice(0, 50).map((p: any) => {
      const variant = p.variants?.[0] ?? {}
      const price = variant.price ? parseFloat(variant.price) : undefined
      const images = (p.images ?? []).map((img: any) => ({
        url: img.src,
        alt: img.alt ?? '',
        width: img.width,
        height: img.height,
      }))
      return {
        external_id: String(p.id),
        name: p.title,
        description: p.body_html ? stripHtml(p.body_html) : undefined,
        price,
        currency: 'USD',
        category: p.product_type || undefined,
        tags: p.tags ? p.tags.split(', ').filter(Boolean) : [],
        images,
        handle: p.handle,
      }
    })

    // Fetch homepage for brand text
    let business_name: string | null = null
    let brand_text = ''
    let colors: string[] = []

    try {
      const homeRes = await fetch(base, {
        headers: { 'User-Agent': 'AutoPostLabs/1.0' },
        signal: AbortSignal.timeout(15000),
      })
      const html = await homeRes.text()
      const result = extractBrandData(html, base)
      business_name = result.business_name
      brand_text = result.brand_text
      colors = result.colors
    } catch {
      // brand text is optional
    }

    return { business_name, platform_type: 'shopify', products, brand_text, colors }
  } catch {
    return null
  }
}

export async function crawlGeneric(url: string): Promise<CrawlResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AutoPostLabs/1.0)',
    },
    signal: AbortSignal.timeout(20000),
  })
  const html = await res.text()
  const { business_name, brand_text, colors } = extractBrandData(html, url)
  const products = extractProductsHeuristic(html, url)

  return {
    business_name,
    platform_type: 'generic',
    products,
    brand_text,
    colors,
  }
}

export async function crawl(url: string): Promise<CrawlResult> {
  const shopify = await crawlShopify(url)
  if (shopify) return shopify
  return crawlGeneric(url)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractBrandData(html: string, baseUrl: string): {
  business_name: string | null
  brand_text: string
  colors: string[]
} {
  const $ = cheerio.load(html)

  const ogSiteName = $('meta[property="og:site_name"]').attr('content')
  const appName = $('meta[name="application-name"]').attr('content')
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const titleTag = $('title').text()

  const business_name =
    ogSiteName ||
    appName ||
    (ogTitle ? ogTitle.split('|')[0].trim() : null) ||
    (titleTag ? titleTag.split('|')[0].trim() : null)

  const sections: string[] = []
  $('p, h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 30) sections.push(text)
  })
  const brand_text = sections.slice(0, 20).join(' ')

  const colors: string[] = []
  const themeColor = $('meta[name="theme-color"]').attr('content')
  if (themeColor) colors.push(themeColor)
  $('style').slice(0, 3).each((_, el) => {
    const matches = $(el).html()?.match(/#[0-9a-fA-F]{6}/g) ?? []
    colors.push(...matches.slice(0, 5))
  })
  const unique = [...new Set(colors)].slice(0, 6)

  return { business_name: business_name || null, brand_text, colors: unique }
}

function extractProductsHeuristic(html: string, baseUrl: string): CrawledProduct[] {
  const $ = cheerio.load(html)
  const products: CrawledProduct[] = []
  const pricePattern = /\$\s*[\d,]+(?:\.\d{2})?/

  $('*').each((_, el) => {
    if (products.length >= 20) return false
    const text = $(el).text()
    if (!pricePattern.test(text)) return
    const children = $(el).children()
    if (children.length > 10) return // skip large containers

    const nameEl = $(el).find('h1, h2, h3, h4, a').first()
    const name = nameEl.text().trim()
    if (!name || name.length < 3) return

    const priceMatch = text.match(pricePattern)
    const price = priceMatch
      ? parseFloat(priceMatch[0].replace('$', '').replace(',', ''))
      : undefined

    const imgSrc = $(el).find('img').first().attr('src')
    let imgUrl = imgSrc ?? ''
    if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl
    else if (imgUrl.startsWith('/')) imgUrl = new URL(imgUrl, baseUrl).href

    products.push({
      external_id: name,
      name,
      price,
      currency: 'USD',
      tags: [],
      images: imgUrl ? [{ url: imgUrl, alt: name }] : [],
    })
  })

  return products
}
