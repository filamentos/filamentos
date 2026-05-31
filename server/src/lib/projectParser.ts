export type ProjectPlatform = 'makerworld' | 'printables' | 'thingiverse' | 'cults3d' | 'other'

export interface ParsedProjectPage {
  title:        string
  designer:     string | null
  platform:     ProjectPlatform
  description:  string
  fullText:     string
  thumbnailUrl: string | null
  licenseText:  string | null
}

// ── Platform detection ─────────────────────────────────────────

function detectPlatform(url: string): ProjectPlatform {
  const host = new URL(url).hostname.replace('www.', '')
  if (host.includes('makerworld.com'))  return 'makerworld'
  if (host.includes('printables.com')) return 'printables'
  if (host.includes('thingiverse.com')) return 'thingiverse'
  if (host.includes('cults3d.com'))    return 'cults3d'
  return 'other'
}

// ── HTML helpers ───────────────────────────────────────────────

function extractMeta(html: string, property: string): string | null {
  // og:description, og:title, og:image — both property= and name= attrs
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(property)}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return decodeHtmlEntities(m[1].trim())
  }
  return null
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : 'Untitled Project'
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Designer extraction ────────────────────────────────────────

function extractDesigner(html: string, title: string, platform: ProjectPlatform): string | null {
  // Try og:author or author meta
  const author = extractMeta(html, 'author') ?? extractMeta(html, 'og:article:author')
  if (author) return author

  // Platform-specific patterns in title
  if (platform === 'makerworld' || platform === 'printables') {
    // "Model Name by Designer | Platform"
    const m = title.match(/\bby\s+([^|–\-]+?)(?:\s*[|–\-]|$)/i)
    if (m?.[1]) return m[1].trim()
  }

  return null
}

// ── License extraction ─────────────────────────────────────────

export interface LicenseInfo {
  license:       string
  commercial_ok: boolean | null
}

export function extractLicense(text: string): LicenseInfo | null {
  const t = text.toLowerCase()

  // Strong non-commercial signals
  if (t.includes('cc by-nc-sa') || t.includes('cc by-nc sa')) {
    return { license: 'CC BY-NC-SA', commercial_ok: false }
  }
  if (t.includes('cc by-nc-nd') || t.includes('cc by-nc nd')) {
    return { license: 'CC BY-NC-ND', commercial_ok: false }
  }
  if (t.includes('cc by-nc') || t.includes('cc-by-nc') ||
      t.includes('noncommercial') || t.includes('non-commercial') ||
      t.includes('personal use only') || t.includes('not for commercial')) {
    return { license: 'CC BY-NC', commercial_ok: false }
  }

  // Commercial-ok signals
  if (t.includes('cc0') || t.includes('public domain')) {
    return { license: 'CC0 / Public Domain', commercial_ok: true }
  }
  if (t.includes('cc by-sa') || t.includes('cc by sa')) {
    return { license: 'CC BY-SA', commercial_ok: true }
  }
  if (t.includes('cc by-nd') || t.includes('cc by nd')) {
    return { license: 'CC BY-ND', commercial_ok: true }
  }
  if (/\bcc[\s-]by\b/i.test(t) || t.includes('attribution')) {
    return { license: 'CC BY', commercial_ok: true }
  }

  // MakerWorld-specific labels
  if (t.includes('standard makerworld license') || t.includes('makerworld license')) {
    return { license: 'Standard MakerWorld License', commercial_ok: null }
  }
  if (t.includes('commercial license') && !t.includes('no commercial')) {
    return { license: 'Commercial License', commercial_ok: true }
  }

  return null
}

// ── Main fetcher ───────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
}

export async function fetchProjectPage(url: string): Promise<ParsedProjectPage> {
  const platform = detectPlatform(url)

  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }

  const html = await response.text()

  // Extract structured fields
  const title       = extractMeta(html, 'og:title') ?? extractTitle(html)
  const description = extractMeta(html, 'og:description') ?? extractMeta(html, 'description') ?? ''
  const thumbnail   = extractMeta(html, 'og:image')
  const designer    = extractDesigner(html, title, platform)
  const fullText    = stripHtml(html).slice(0, 20_000) // cap to 20k chars for Claude

  // License detection
  const licenseInfo = extractLicense(fullText)
  const licenseText = licenseInfo ? JSON.stringify(licenseInfo) : null

  return {
    title:       decodeHtmlEntities(cleanTitle(title, platform)),
    designer,
    platform,
    description: description.slice(0, 2000),
    fullText,
    thumbnailUrl: thumbnail ?? null,
    licenseText,
  }
}

function cleanTitle(title: string, platform: ProjectPlatform): string {
  // Remove trailing " | MakerWorld" etc.
  return title
    .replace(/\s*[\|–\-]\s*(makerworld|printables|thingiverse|cults3d|cults).*$/i, '')
    .trim()
}
