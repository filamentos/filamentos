// Affiliate tags — empty for now, populated via env vars when ready
const AMAZON_TAG  = process.env.AMAZON_AFFILIATE_TAG  || ''
const BAMBU_ID    = process.env.BAMBU_AFFILIATE_ID    || ''
const _ALI_KEY    = process.env.ALIEXPRESS_AFFILIATE_KEY || ''

export function buildAmazonUrl(query: string): string {
  const base = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`
  return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base
}

export function buildBambuUrl(sku: string): string {
  const base = `https://store.bambulab.com/search?q=${encodeURIComponent(sku)}`
  return base // Bambu affiliate appended here when enrolled
}

export function buildAliUrl(query: string): string {
  const base = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`
  return base // AliExpress affiliate appended here when enrolled
}

export function buildBuyLinks(componentName: string, bambuSku?: string | null) {
  return {
    amazon:     buildAmazonUrl(componentName),
    bambu:      bambuSku ? buildBambuUrl(bambuSku) : null,
    aliexpress: buildAliUrl(componentName),
  }
}
