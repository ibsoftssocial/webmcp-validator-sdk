export interface SitemapParserOptions {
  /** Maximum number of URLs to extract (default: 50) */
  limit?: number;
  /** Maximum recursion depth for sitemapindex files (default: 2) */
  maxDepth?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Optional regex or substring filter for URLs */
  filter?: RegExp | string;
  /** Custom fetch implementation (useful for testing) */
  fetchFn?: typeof fetch;
}

export interface SitemapParseResult {
  sitemapUrl: string;
  urls: string[];
  totalDiscovered: number;
  isIndex: boolean;
  childSitemaps: string[];
  errors: string[];
}

/**
 * Normalizes input URL to a candidate sitemap URL if not already an XML file
 */
export function normalizeSitemapUrl(inputUrl: string): string {
  try {
    const parsed = new URL(inputUrl);
    if (!parsed.pathname.endsWith('.xml')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') + '/sitemap.xml';
    }
    return parsed.href;
  } catch {
    return inputUrl.endsWith('.xml') ? inputUrl : `${inputUrl.replace(/\/+$/, '')}/sitemap.xml`;
  }
}

/**
 * Parses raw XML text to extract <loc> URLs and determines if the payload is a sitemapindex
 */
export function parseSitemapXml(xmlText: string): { isIndex: boolean; locations: string[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xmlText);
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
  const locations: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xmlText)) !== null) {
    const loc = match[1]?.trim();
    if (loc) {
      locations.push(loc);
    }
  }

  return { isIndex, locations };
}

/**
 * Fetches and recursively parses a sitemap.xml or sitemapindex file to discover page URLs
 */
export async function fetchAndParseSitemap(
  sitemapUrl: string,
  options: SitemapParserOptions = {}
): Promise<SitemapParseResult> {
  const fetchImpl = options.fetchFn ?? fetch;
  const limit = options.limit ?? 50;
  const maxDepth = options.maxDepth ?? 2;
  const timeoutMs = options.timeoutMs ?? 10000;
  const filter = options.filter;

  const resolvedSitemapUrl = normalizeSitemapUrl(sitemapUrl);
  const discoveredUrls = new Set<string>();
  const childSitemaps: string[] = [];
  const errors: string[] = [];

  async function crawl(url: string, depth: number): Promise<void> {
    if (discoveredUrls.size >= limit || depth > maxDepth) {
      return;
    }

    try {
      const response = await fetchImpl(url, {
        headers: {
          'User-Agent':
            'WebMCPValidator-SitemapCrawler/1.0 (+https://github.com/ibsoftssocial/webmcp-validator-sdk)',
          Accept: 'application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        errors.push(`Failed to fetch sitemap ${url}: HTTP ${response.status} ${response.statusText}`);
        return;
      }

      const xmlText = await response.text();
      const { isIndex, locations } = parseSitemapXml(xmlText);

      if (isIndex && depth < maxDepth) {
        for (const childUrl of locations) {
          if (!childSitemaps.includes(childUrl)) {
            childSitemaps.push(childUrl);
          }
          await crawl(childUrl, depth + 1);
          if (discoveredUrls.size >= limit) break;
        }
      } else {
        for (const pageUrl of locations) {
          if (filter) {
            const matches =
              typeof filter === 'string'
                ? pageUrl.includes(filter)
                : filter.test(pageUrl);
            if (!matches) continue;
          }

          discoveredUrls.add(pageUrl);
          if (discoveredUrls.size >= limit) break;
        }
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error crawling sitemap ${url}: ${msg}`);
    }
  }

  await crawl(resolvedSitemapUrl, 1);

  const urls = Array.from(discoveredUrls);
  return {
    sitemapUrl: resolvedSitemapUrl,
    urls,
    totalDiscovered: urls.length,
    isIndex: childSitemaps.length > 0,
    childSitemaps,
    errors,
  };
}

/**
 * Convenience helper to extract a clean string array of page URLs from a sitemap
 */
export async function discoverSitemapUrls(
  baseUrlOrSitemap: string,
  options?: SitemapParserOptions
): Promise<string[]> {
  const result = await fetchAndParseSitemap(baseUrlOrSitemap, options);
  return result.urls;
}
