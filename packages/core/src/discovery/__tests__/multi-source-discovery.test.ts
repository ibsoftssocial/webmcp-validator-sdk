import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockServer, startMockServer } from '../../testing/mock-server.js';
import { PlaywrightScanner } from '../../scanner/playwright-scanner.js';
import {
  parseDeclarativeHtml,
  discoverManifest,
  discoverAgentDirectives,
  analyzeRobotsTxt,
  runMultiSourceDiscovery,
} from '../index.js';

describe('Multi-Source Discovery Engine (Day 4)', () => {
  let server: MockServer;
  let scanner: PlaywrightScanner;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
    scanner = new PlaywrightScanner({ headless: true, persistentBrowser: true });
  });

  afterAll(async () => {
    await scanner.close();
    await server.stop();
  });

  describe('Declarative HTML Discoverer', () => {
    it('parses <meta name="webmcp-version"> and <link rel="model-context"> from raw HTML', () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="webmcp-version" content="1.0.0">
          <link rel="model-context" type="application/json" href="/mcp/manifest.json">
          <link rel="help" href="/llms.txt">
          <meta http-equiv="origin-trial" content="test-token-123">
        </head>
        <body><h1>Hello</h1></body>
        </html>
      `;

      const meta = parseDeclarativeHtml(sampleHtml, 'https://example.com/sub/page');
      expect(meta.webmcpVersion).toBe('1.0.0');
      expect(meta.manifestLinks).toEqual(['https://example.com/mcp/manifest.json']);
      expect(meta.helpLinks).toEqual(['https://example.com/llms.txt']);
      expect(meta.originTrialTokens).toEqual(['test-token-123']);
    });

    it('returns empty lists for HTML without WebMCP markup', () => {
      const emptyHtml = `<html><head><title>No WebMCP</title></head><body></body></html>`;
      const meta = parseDeclarativeHtml(emptyHtml, 'https://example.com');
      expect(meta.webmcpVersion).toBeUndefined();
      expect(meta.manifestLinks).toHaveLength(0);
      expect(meta.helpLinks).toHaveLength(0);
      expect(meta.originTrialTokens).toHaveLength(0);
    });
  });

  describe('Manifest Discoverer', () => {
    it('fetches and parses linked manifest correctly', async () => {
      const result = await discoverManifest({
        pageUrl: server.getUrl('/declarative'),
        linkedManifestUrls: [server.getUrl('/mcp/manifest.json')],
      });

      expect(result.hasManifest).toBe(true);
      expect(result.manifestUrl).toBe(server.getUrl('/mcp/manifest.json'));
      expect(result.tools).toHaveLength(2);

      const names = result.tools.map((t) => t.name);
      expect(names).toContain('search_catalog');
      expect(names).toContain('get_store_hours');

      const catalogTool = result.tools.find((t) => t.name === 'search_catalog')!;
      expect(catalogTool.source).toBe('manifest');
      expect(catalogTool.description).toBe('Search store products by keyword and category');
      expect(catalogTool.inputSchema.required).toContain('query');
      expect(catalogTool.annotations?.readOnlyHint).toBe(true);
    });

    it('probes standard /.well-known/mcp.json fallback when no link is provided', async () => {
      const result = await discoverManifest({
        pageUrl: server.getUrl('/'),
        linkedManifestUrls: [],
        probeWellKnown: true,
      });

      expect(result.hasManifest).toBe(true);
      expect(result.manifestUrl).toBe(server.getUrl('/.well-known/mcp.json'));
      expect(result.tools.length).toBeGreaterThan(0);
    });

    it('handles non-existent manifests gracefully without throwing', async () => {
      const result = await discoverManifest({
        pageUrl: server.getUrl('/non-existent'),
        linkedManifestUrls: [server.getUrl('/missing-manifest.json')],
      });

      expect(result.hasManifest).toBe(false);
      expect(result.tools).toHaveLength(0);
    });
  });

  describe('Agent Directives Discoverer', () => {
    it('fetches and extracts /llms.txt content', async () => {
      const result = await discoverAgentDirectives({
        pageUrl: server.getUrl('/'),
        probeWellKnown: true,
      });

      expect(result.hasLlmsTxt).toBe(true);
      expect(result.llmsTxtUrl).toBe(server.getUrl('/llms.txt'));
      expect(result.llmsTxtContent).toContain('Acme Store — WebMCP Agent Information');
      expect(result.llmsTxtContent).toContain('search_catalog');
    });

    it('fetches /robots.txt and analyzes AI crawler permissions', async () => {
      const result = await discoverAgentDirectives({
        pageUrl: server.getUrl('/'),
        probeWellKnown: true,
      });

      expect(result.hasRobotsTxt).toBe(true);
      expect(result.aiCrawlersAllowed).toBe(true);
    });

    it('correctly identifies blocked AI bots in robots.txt parser', () => {
      const blockedRobots = `
        User-agent: GPTBot
        Disallow: /

        User-agent: ClaudeBot
        Disallow: /
      `;
      expect(analyzeRobotsTxt(blockedRobots).aiCrawlersAllowed).toBe(false);

      const allowedRobots = `
        User-agent: *
        Allow: /
      `;
      expect(analyzeRobotsTxt(allowedRobots).aiCrawlersAllowed).toBe(true);
    });
  });

  describe('End-to-End Multi-Source Integration', () => {
    it('scans /declarative fixture and extracts declarative manifest tools', async () => {
      const result = await scanner.scan(server.getUrl('/declarative'));

      expect(result.url).toBe(server.getUrl('/declarative'));
      expect(result.declarativeDetected).toBe(true);
      expect(result.imperativeDetected).toBe(false);
      expect(result.hasNavigatorModelContext).toBe(false);
      expect(result.hasLlmsTxt).toBe(true);

      // 2 declarative tools from /mcp/manifest.json
      expect(result.tools).toHaveLength(2);
      expect(result.tools[0].source).toBe('manifest');
      expect(result.tools[1].source).toBe('manifest');

      expect(result.declarativeMetadata?.webmcpVersion).toBe('1.0');
      expect(result.manifestDetails?.hasManifest).toBe(true);
      expect(result.agentDirectives?.hasLlmsTxt).toBe(true);
    });

    it('scans root URL with probeWellKnown=true and discovers host-wide manifest', async () => {
      const result = await scanner.scan({
        url: server.getUrl('/'),
        probeWellKnown: true,
      });

      expect(result.manifestDetails?.hasManifest).toBe(true);
      expect(result.manifestDetails?.manifestUrl).toContain('/mcp/manifest.json');
      expect(result.hasLlmsTxt).toBe(true);
      expect(result.agentDirectives?.hasRobotsTxt).toBe(true);
    });
  });
});
