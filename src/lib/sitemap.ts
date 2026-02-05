import { XMLParser } from 'fast-xml-parser'

interface SitemapUrl {
  loc: string
  lastmod?: string
  priority?: number
}

export async function fetchSitemap(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`)
  }

  const xml = await response.text()
  return parseSitemap(xml, sitemapUrl)
}

export function parseSitemap(xml: string, baseUrl: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })

  const result = parser.parse(xml)
  const urls: string[] = []

  // Handle standard sitemap
  if (result.urlset?.url) {
    const urlList = Array.isArray(result.urlset.url)
      ? result.urlset.url
      : [result.urlset.url]

    for (const item of urlList) {
      const loc = item.loc
      if (loc) {
        urls.push(urlToSlug(loc, baseUrl))
      }
    }
  }

  // Handle sitemap index
  if (result.sitemapindex?.sitemap) {
    // For sitemap index, we'd need to fetch each child sitemap
    // For now, just return empty and let user know
    console.warn('Sitemap index detected - only direct sitemaps supported')
  }

  return urls
}

function urlToSlug(fullUrl: string, baseUrl: string): string {
  try {
    const url = new URL(fullUrl)
    const base = new URL(baseUrl)

    // If same origin, return pathname
    if (url.origin === base.origin) {
      return url.pathname || '/'
    }

    // Otherwise return full URL as slug
    return url.pathname || '/'
  } catch {
    return fullUrl
  }
}
