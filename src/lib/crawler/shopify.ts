/**
 * Universal e-commerce crawler
 *
 * Detection order (fastest / most reliable first):
 *  1. Shopify  — /products.json  (public, no auth)
 *  2. WooCommerce — /wp-json/wc/v3/products (public read)
 *  3. JSON-LD / schema.org Product markup (works on almost every modern store)
 *  4. Open Graph + meta heuristics (fallback)
 */
import * as cheerio from 'cheerio'

// ─── Public types ─────────────────────────────────────────────────────────────

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
  platform_type: 'shopify' | 'woocommerce' | 'generic'
  products: CrawledProduct[]
  brand_text: string
  colors: string[]
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function crawl(url: string): Promise<CrawlResult> {
  const base = normalizeBase(url)

  // 1. Shopify
  const shopify = await crawlShopify(base)
  if (shopify) return shopify

  // 2. WooCommerce
  const woo = await crawlWooCommerce(base)
  if (woo) return woo

  // 3. Generic (JSON-LD + heuristic)
  return crawlGeneric(base)
}

// ─── Shopify ──────────────────────────────────────────────────────────────────

export async function crawlShopify(baseUrl: string): Promise<CrawlResult | null> {
  const base = normalizeBase(baseUrl)
  try {
    const res = await fetch(`${base}/products.json?limit=250`, {
      headers: { 'User-Agent': 'AutoPostLabs/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.products?.length) return null

    const products: CrawledProduct[] = (data.products as any[]).slice(0, 50).map((p: any) => {
      const variant = p.variants?.[0] ?? {}
      return {
        external_id: String(p.id),
        name: p.title,
        description: p.body_html ? stripHtml(p.body_html) : undefined,
        price: variant.price ? parseFloat(variant.price) : undefined,
        currency: 'USD',
        category: p.product_type || undefined,
        tags: p.tags ? p.tags.split(', ').filter(Boolean) : [],
        images: (p.images ?? []).map((img: any) => ({
          url: img.src,
          alt: img.alt ?? '',
          width: img.width,
          height: img.height,
        })),
        handle: p.handle,
      }
    })

    const brandData = await fetchBrandData(base)
    return { ...brandData, platform_type: 'shopify', products }
  } catch {
    return null
  }
}

// ─── WooCommerce ──────────────────────────────────────────────────────────────

async function crawlWooCommerce(base: string): Promise<CrawlResult | null> {
  try {
    const res = await fetch(`${base}/wp-json/wc/v3/products?per_page=50&status=publish`, {
      headers: { 'User-Agent': 'AutoPostLabs/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    const products: CrawledProduct[] = data.map((p: any) => ({
      external_id: String(p.id),
      name: p.name,
      description: p.short_description ? stripHtml(p.short_description) : undefined,
      price: p.price ? parseFloat(p.price) : undefined,
      currency: 'USD',
      category: p.categories?.[0]?.name,
      tags: (p.tags ?? []).map((t: any) => t.name),
      images: (p.images ?? []).map((img: any) => ({
        url: img.src,
        alt: img.alt ?? '',
      })),
      handle: p.slug,
    }))

    const brandData = await fetchBrandData(base)
    return { ...brandData, platform_type: 'woocommerce', products }
  } catch {
    return null
  }
}

// ─── Generic (JSON-LD + heuristic) ────────────────────────────────────────────

export async function crawlGeneric(url: string): Promise<CrawlResult> {
  const base = normalizeBase(url)

  let html = ''
  try {
    const res = await fetch(base, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(20000),
    })
    html = await res.text()
  } catch {
    return { business_name: null, platform_type: 'generic', products: [], brand_text: '', colors: [] }
  }

  const $ = cheerio.load(html)
  const brandData = extractBrandData($, html, base)

  // Try JSON-LD first — most reliable
  let products = extractJsonLdProducts($, base)

  // If JSON-LD found nothing, try a smarter DOM heuristic
  if (products.length === 0) {
    products = extractProductsHeuristic($, base)
  }

  // Also try fetching a /products, /shop, or /collections page for more products
  if (products.length < 3) {
    const extraProducts = await tryProductListingPages(base)
    if (extraProducts.length > products.length) products = extraProducts
  }

  return { ...brandData, platform_type: 'generic', products }
}

// ─── JSON-LD extractor ────────────────────────────────────────────────────────

function extractJsonLdProducts(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string,
): CrawledProduct[] {
  const products: CrawledProduct[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() ?? ''
      const data = JSON.parse(raw)

      const items: any[] = Array.isArray(data)
        ? data
        : data['@graph']
          ? data['@graph']
          : [data]

      for (const item of items) {
        if (item['@type'] === 'Product') {
          products.push(parseSchemaProduct(item, baseUrl))
        }
        // ItemList of Products
        if (item['@type'] === 'ItemList' && Array.isArray(item.itemListElement)) {
          for (const el of item.itemListElement) {
            const inner = el.item ?? el
            if (inner['@type'] === 'Product') {
              products.push(parseSchemaProduct(inner, baseUrl))
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  })

  return products.slice(0, 50)
}

function parseSchemaProduct(p: any, baseUrl: string): CrawledProduct {
  const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers
  const price = offers?.price ? parseFloat(String(offers.price)) : undefined
  const currency = offers?.priceCurrency ?? 'USD'

  const rawImages = Array.isArray(p.image) ? p.image : p.image ? [p.image] : []
  const images = rawImages.map((img: any) => {
    const src = typeof img === 'string' ? img : img.url ?? img.contentUrl ?? ''
    return { url: resolveUrl(src, baseUrl), alt: p.name ?? '' }
  })

  return {
    external_id: p['@id'] ?? p.sku ?? p.name,
    name: p.name ?? 'Product',
    description: p.description ? stripHtml(String(p.description)) : undefined,
    price,
    currency,
    category: p.category,
    tags: Array.isArray(p.keywords) ? p.keywords : p.keywords ? [p.keywords] : [],
    images,
  }
}

// ─── Try common product listing pages ────────────────────────────────────────

async function tryProductListingPages(base: string): Promise<CrawledProduct[]> {
  const paths = ['/products', '/shop', '/collections/all', '/catalog', '/store']

  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const $ = cheerio.load(html)
      const products = extractJsonLdProducts($, base)
      if (products.length > 0) return products
      const heuristic = extractProductsHeuristic($, base)
      if (heuristic.length > 2) return heuristic
    } catch {
      continue
    }
  }
  return []
}

// ─── DOM heuristic extractor ─────────────────────────────────────────────────

function extractProductsHeuristic(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string,
): CrawledProduct[] {
  const products: CrawledProduct[] = []
  const seen = new Set<string>()
  const pricePattern = /(?:\$|USD|EUR|GBP|£|€)\s*[\d,]+(?:\.\d{2})?/i

  // Common product card selectors used by most themes
  const cardSelectors = [
    '[class*="product-card"]',
    '[class*="product-item"]',
    '[class*="product-tile"]',
    '[class*="ProductCard"]',
    '[class*="ProductItem"]',
    '[data-product-id]',
    '[data-product]',
    'li[class*="product"]',
    'article[class*="product"]',
  ]

  for (const selector of cardSelectors) {
    $(selector).each((_, el) => {
      if (products.length >= 30) return false
      const text = $(el).text()
      if (!pricePattern.test(text)) return

      const nameEl = $(el).find('h1, h2, h3, h4, [class*="title"], [class*="name"], a').first()
      const name = nameEl.text().trim()
      if (!name || name.length < 2 || seen.has(name)) return
      seen.add(name)

      const priceMatch = text.match(pricePattern)
      const price = priceMatch
        ? parseFloat(priceMatch[0].replace(/[^0-9.]/g, ''))
        : undefined

      const imgSrc = $(el).find('img').first().attr('src') ?? ''
      const imgUrl = resolveUrl(imgSrc, baseUrl)

      products.push({
        external_id: name,
        name,
        price,
        currency: 'USD',
        tags: [],
        images: imgUrl ? [{ url: imgUrl, alt: name }] : [],
      })
    })
    if (products.length >= 5) break
  }

  // Fallback: scan all elements if card selectors found nothing
  if (products.length === 0) {
    $('*').each((_, el) => {
      if (products.length >= 20) return false
      const children = $(el).children()
      if (children.length > 12) return
      const text = $(el).text()
      if (!pricePattern.test(text)) return

      const nameEl = $(el).find('h1,h2,h3,h4,a').first()
      const name = nameEl.text().trim()
      if (!name || name.length < 3 || seen.has(name)) return
      seen.add(name)

      const priceMatch = text.match(pricePattern)
      const price = priceMatch
        ? parseFloat(priceMatch[0].replace(/[^0-9.]/g, ''))
        : undefined

      const imgSrc = $(el).find('img').first().attr('src') ?? ''
      const imgUrl = resolveUrl(imgSrc, baseUrl)

      products.push({
        external_id: name,
        name,
        price,
        currency: 'USD',
        tags: [],
        images: imgUrl ? [{ url: imgUrl, alt: name }] : [],
      })
    })
  }

  return products
}

// ─── Brand data helpers ───────────────────────────────────────────────────────

async function fetchBrandData(base: string): Promise<{
  business_name: string | null
  brand_text: string
  colors: string[]
}> {
  try {
    const res = await fetch(base, {
      headers: { 'User-Agent': 'AutoPostLabs/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    const $ = cheerio.load(html)
    return extractBrandData($, html, base)
  } catch {
    return { business_name: null, brand_text: '', colors: [] }
  }
}

function extractBrandData(
  $: ReturnType<typeof cheerio.load>,
  _html: string,
  _baseUrl: string,
): { business_name: string | null; brand_text: string; colors: string[] } {
  const ogSiteName = $('meta[property="og:site_name"]').attr('content')
  const appName = $('meta[name="application-name"]').attr('content')
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const titleTag = $('title').text()

  const business_name =
    ogSiteName ||
    appName ||
    (ogTitle ? ogTitle.split(/[|–\-]/)[0].trim() : null) ||
    (titleTag ? titleTag.split(/[|–\-]/)[0].trim() : null) ||
    null

  const sections: string[] = []
  $('p, h1, h2, h3, [class*="hero"], [class*="banner"], [class*="tagline"]').each((_, el) => {
    const text = $(el).text().trim()
    if (text.length > 20 && text.length < 500) sections.push(text)
  })
  const brand_text = sections.slice(0, 20).join(' ')

  const colors: string[] = []
  const themeColor = $('meta[name="theme-color"]').attr('content')
  if (themeColor) colors.push(themeColor)
  $('style').slice(0, 3).each((_, el) => {
    const matches = $(el).html()?.match(/#[0-9a-fA-F]{6}/g) ?? []
    colors.push(...matches.slice(0, 5))
  })

  return { business_name, brand_text, colors: [...new Set(colors)].slice(0, 6) }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function normalizeBase(url: string): string {
  const u = url.trim().replace(/\/$/, '')
  return u.startsWith('http') ? u : `https://${u}`
}

function resolveUrl(src: string, baseUrl: string): string {
  if (!src) return ''
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('http')) return src
  try { return new URL(src, baseUrl).href } catch { return src }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
