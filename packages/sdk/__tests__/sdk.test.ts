import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WebMCPValidator, WebMCP, MockServer, startMockServer } from '../src/index.js';

describe('WebMCPValidator SDK (Programmatic API)', () => {
  let server: MockServer;
  let tempDir: string;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webmcp-sdk-test-'));
  });

  afterAll(async () => {
    await server.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('exposes version and convenience alias', () => {
    expect(WebMCPValidator.version).toBe('0.1.0');
    expect(WebMCP).toBe(WebMCPValidator);
  });

  it('scans a website and discovers tools', async () => {
    const result = await WebMCPValidator.scan(server.getUrl('/perfect'));
    expect(result.url).toContain('/perfect');
    expect(result.tools.length).toBeGreaterThan(0);
    expect(result.hasNavigatorModelContext).toBe(true);
  });

  it('runs linter rules on a scan result', async () => {
    const result = await WebMCPValidator.scan(server.getUrl('/perfect'));
    const lint = await WebMCPValidator.lint(result);
    expect(lint.rulesExecuted).toBeGreaterThan(0);
  });

  it('calculates score and produces readiness report', async () => {
    const result = await WebMCPValidator.scan(server.getUrl('/perfect'));
    const lint = await WebMCPValidator.lint(result);
    const report = WebMCPValidator.score(result, lint);

    expect(report.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.grade).toBe('A');
    expect(report.passed).toBe(true);
  });

  it('performs end-to-end audit() in a single call', async () => {
    const report = await WebMCPValidator.audit(server.getUrl('/perfect'));

    expect(report.url).toContain('/perfect');
    expect(report.overallScore).toBeGreaterThanOrEqual(90);
    expect(report.toolCount).toBeGreaterThanOrEqual(3);
    expect(report.grade).toBe('A');
  });

  it('generates multi-format report strings via SDK generateReport()', async () => {
    const report = await WebMCPValidator.audit(server.getUrl('/perfect'));

    const json = WebMCPValidator.generateReport(report, 'json');
    expect(JSON.parse(json).url).toBe(report.url);

    const markdown = WebMCPValidator.generateReport(report, 'markdown');
    expect(markdown).toContain('# WebMCP AI Readiness Audit Report');

    const html = WebMCPValidator.generateReport(report, 'html');
    expect(html).toContain('<!DOCTYPE html>');

    const sarif = WebMCPValidator.generateReport(report, 'sarif');
    expect(JSON.parse(sarif).version).toBe('2.1.0');

    const junit = WebMCPValidator.generateReport(report, 'junit');
    expect(junit).toContain('<testsuites name="WebMCP AI Readiness Audit"');
  });

  it('persists reports directly to file via SDK saveReport()', async () => {
    const report = await WebMCPValidator.audit(server.getUrl('/perfect'));
    const outPath = path.join(tempDir, 'sdk-report.html');

    await WebMCPValidator.saveReport(report, outPath);

    const exists = await fs.stat(outPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(outPath, 'utf8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('Grade A');
  });

  describe('Day 10 Batch Scanning & Sitemap SDK APIs', () => {
    it('crawls sitemaps via WebMCPValidator.crawlSitemap()', async () => {
      const urls = await WebMCPValidator.crawlSitemap(server.getUrl('/sitemap.xml'));
      expect(urls.length).toBeGreaterThan(0);
      expect(urls).toContain(server.getUrl('/perfect'));
    });

    it('runs batch audits via WebMCPValidator.batchAudit()', async () => {
      const result = await WebMCPValidator.batchAudit({
        urls: [server.getUrl('/perfect'), server.getUrl('/declarative')],
        concurrency: 2,
      });

      expect(result.totalUrls).toBe(2);
      expect(result.successfulAudits).toBe(2);
      expect(result.averageScore).toBeGreaterThan(0);
      expect(result.summary.uniqueTools.length).toBeGreaterThan(0);
    });

    it('generates and saves batch reports via SDK', async () => {
      const result = await WebMCPValidator.batchAudit({
        urls: [server.getUrl('/perfect')],
      });

      const jsonStr = WebMCPValidator.generateBatchReport(result, 'json');
      expect(JSON.parse(jsonStr).totalUrls).toBe(1);

      const htmlStr = WebMCPValidator.generateBatchReport(result, 'html');
      expect(htmlStr).toContain('Site-Wide Batch Audit Report');

      const outPath = path.join(tempDir, 'sdk-batch-report.md');
      await WebMCPValidator.saveBatchReport(result, outPath);

      const exists = await fs.stat(outPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('# WebMCP Site-Wide Batch Audit Report');
    });
  });

  describe('Day 11 SVG Badge SDK APIs', () => {
    it('generates SVG readiness badges via SDK', async () => {
      const report = await WebMCPValidator.audit(server.getUrl('/perfect'));
      const badgeSvg = WebMCPValidator.generateBadge(report);

      expect(badgeSvg).toContain('<svg');
      expect(badgeSvg).toContain('WebMCP');
      expect(badgeSvg).toContain('Grade A');
    });

    it('saves badge directly to file via SDK', async () => {
      const report = await WebMCPValidator.audit(server.getUrl('/perfect'));
      const badgePath = path.join(tempDir, 'badge.svg');

      await WebMCPValidator.saveBadge(report, badgePath);

      const exists = await fs.stat(badgePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      const content = await fs.readFile(badgePath, 'utf8');
      expect(content).toContain('<svg');
      expect(content).toContain('Grade A');
    });

    it('generates markdown badge snippets via SDK helper', () => {
      const md = WebMCPValidator.generateMarkdownBadgeSnippet({
        badgePathOrUrl: './badge.svg',
        targetUrl: 'https://example.com/audit.html',
      });
      expect(md).toBe('[![WebMCP AI Readiness](./badge.svg)](https://example.com/audit.html)');
    });
  });
});

