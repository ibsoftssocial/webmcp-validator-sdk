import { describe, it, expect, vi } from 'vitest';
import {
  normalizeSitemapUrl,
  parseSitemapXml,
  fetchAndParseSitemap,
  discoverSitemapUrls,
} from '../sitemap-parser.js';

describe('Sitemap Parser', () => {
  describe('normalizeSitemapUrl', () => {
    it('appends /sitemap.xml when given a bare domain or directory', () => {
      expect(normalizeSitemapUrl('https://example.com')).toBe('https://example.com/sitemap.xml');
      expect(normalizeSitemapUrl('https://example.com/')).toBe('https://example.com/sitemap.xml');
      expect(normalizeSitemapUrl('https://example.com/blog')).toBe('https://example.com/blog/sitemap.xml');
    });

    it('preserves existing .xml filenames', () => {
      expect(normalizeSitemapUrl('https://example.com/sitemap.xml')).toBe('https://example.com/sitemap.xml');
      expect(normalizeSitemapUrl('https://example.com/nested/posts.xml')).toBe('https://example.com/nested/posts.xml');
    });
  });

  describe('parseSitemapXml', () => {
    it('parses standard urlset with locations', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/home</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
  <url>
    <loc>https://example.com/tools</loc>
  </url>
</urlset>`;

      const result = parseSitemapXml(xml);
      expect(result.isIndex).toBe(false);
      expect(result.locations).toEqual([
        'https://example.com/home',
        'https://example.com/about',
        'https://example.com/tools',
      ]);
    });

    it('identifies sitemapindex documents correctly', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/post-sitemap.xml</loc>
  </sitemap>
  <sitemap>
    <loc>https://example.com/page-sitemap.xml</loc>
  </sitemap>
</sitemapindex>`;

      const result = parseSitemapXml(xml);
      expect(result.isIndex).toBe(true);
      expect(result.locations).toEqual([
        'https://example.com/post-sitemap.xml',
        'https://example.com/page-sitemap.xml',
      ]);
    });

    it('handles empty or malformed XML gracefully', () => {
      const result = parseSitemapXml('<html><body>No locs here</body></html>');
      expect(result.isIndex).toBe(false);
      expect(result.locations).toEqual([]);
    });
  });

  describe('fetchAndParseSitemap', () => {
    it('fetches and returns parsed page URLs', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/page1</loc></url>
  <url><loc>https://example.com/page2</loc></url>
</urlset>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => xml,
      } as any);

      const result = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        fetchFn: mockFetch as any,
      });

      expect(result.totalDiscovered).toBe(2);
      expect(result.urls).toEqual([
        'https://example.com/page1',
        'https://example.com/page2',
      ]);
      expect(result.isIndex).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('recursively resolves sitemapindex child sitemaps', async () => {
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-sub1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-sub2.xml</loc></sitemap>
</sitemapindex>`;

      const sub1Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/sub1/pageA</loc></url>
</urlset>`;

      const sub2Xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/sub2/pageB</loc></url>
</urlset>`;

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('sitemap-sub1')) {
          return Promise.resolve({ ok: true, text: async () => sub1Xml });
        }
        if (url.includes('sitemap-sub2')) {
          return Promise.resolve({ ok: true, text: async () => sub2Xml });
        }
        return Promise.resolve({ ok: true, text: async () => indexXml });
      });

      const result = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        fetchFn: mockFetch as any,
      });

      expect(result.isIndex).toBe(true);
      expect(result.childSitemaps).toContain('https://example.com/sitemap-sub1.xml');
      expect(result.childSitemaps).toContain('https://example.com/sitemap-sub2.xml');
      expect(result.urls).toEqual([
        'https://example.com/sub1/pageA',
        'https://example.com/sub2/pageB',
      ]);
    });

    it('enforces limit option', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/p1</loc></url>
  <url><loc>https://example.com/p2</loc></url>
  <url><loc>https://example.com/p3</loc></url>
  <url><loc>https://example.com/p4</loc></url>
</urlset>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => xml,
      } as any);

      const result = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        limit: 2,
        fetchFn: mockFetch as any,
      });

      expect(result.urls).toHaveLength(2);
      expect(result.urls).toEqual(['https://example.com/p1', 'https://example.com/p2']);
    });

    it('filters URLs by string and RegExp', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/blog/article-1</loc></url>
  <url><loc>https://example.com/docs/api</loc></url>
  <url><loc>https://example.com/blog/article-2</loc></url>
</urlset>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => xml,
      } as any);

      const stringFiltered = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        filter: '/docs/',
        fetchFn: mockFetch as any,
      });
      expect(stringFiltered.urls).toEqual(['https://example.com/docs/api']);

      const regexFiltered = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        filter: /article-\d/,
        fetchFn: mockFetch as any,
      });
      expect(regexFiltered.urls).toEqual([
        'https://example.com/blog/article-1',
        'https://example.com/blog/article-2',
      ]);
    });

    it('handles HTTP error responses gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

      const result = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        fetchFn: mockFetch as any,
      });

      expect(result.urls).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('HTTP 404');
    });

    it('handles network throw errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await fetchAndParseSitemap('https://example.com/sitemap.xml', {
        fetchFn: mockFetch as any,
      });

      expect(result.urls).toEqual([]);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Connection refused');
    });
  });

  describe('discoverSitemapUrls helper', () => {
    it('returns an array of discovered URLs directly', async () => {
      const xml = `<urlset><url><loc>https://example.com/foo</loc></url></urlset>`;
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => xml,
      } as any);

      const urls = await discoverSitemapUrls('https://example.com/sitemap.xml', {
        fetchFn: mockFetch as any,
      });

      expect(urls).toEqual(['https://example.com/foo']);
    });
  });
});
