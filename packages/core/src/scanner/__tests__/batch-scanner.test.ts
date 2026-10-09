import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { batchAudit } from '../batch-scanner.js';
import { MockServer, startMockServer } from '../../testing/mock-server.js';
import { BatchAuditProgress } from '../../types/batch.js';

describe('BatchScanner & Browser Pooling (Day 10)', () => {
  let server: MockServer;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('audits multiple URLs concurrently with browser pooling', async () => {
    const urls = [server.getUrl('/perfect'), server.getUrl('/declarative')];
    const progressUpdates: BatchAuditProgress[] = [];

    const result = await batchAudit({
      urls,
      concurrency: 2,
      failUnder: 70,
      onProgress: (p) => {
        progressUpdates.push({ ...p });
      },
    });

    expect(result.totalUrls).toBe(2);
    expect(result.successfulAudits).toBe(2);
    expect(result.failedAudits).toBe(0);
    expect(result.reports).toHaveLength(2);
    expect(result.averageScore).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);

    // Verify progress callbacks
    expect(progressUpdates.length).toBeGreaterThanOrEqual(4);
    const scanningStatuses = progressUpdates.filter((p) => p.status === 'scanning');
    expect(scanningStatuses.length).toBe(2);

    // Verify aggregated summary
    expect(result.summary.totalToolsDiscovered).toBeGreaterThan(0);
    expect(result.summary.uniqueTools.length).toBeGreaterThan(0);
    expect(result.summary.categoryAverages).toHaveProperty('infrastructure');
  });

  it('crawls sitemap and audits discovered URLs', async () => {
    const sitemapUrl = server.getUrl('/sitemap.xml');

    const result = await batchAudit({
      sitemapUrl,
      concurrency: 2,
      limit: 5,
    });

    expect(result.totalUrls).toBe(2);
    expect(result.reports).toHaveLength(2);
    const auditedUrls = result.reports.map((r) => r.url);
    expect(auditedUrls).toContain(server.getUrl('/perfect'));
    expect(auditedUrls).toContain(server.getUrl('/declarative'));
  });

  it('handles scan errors gracefully while completing surviving scans', async () => {
    const unreachableUrl = 'http://127.0.0.1:1/nonexistent';
    const validUrl = server.getUrl('/perfect');

    const result = await batchAudit({
      urls: [unreachableUrl, validUrl],
      concurrency: 2,
      scannerOptions: { timeoutMs: 2000 },
    });

    expect(result.totalUrls).toBe(2);
    expect(result.successfulAudits).toBe(1);
    expect(result.failedAudits).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.url).toBe(unreachableUrl);
    expect(result.passed).toBe(false); // Fails when errors occur
  });

  it('throws an error if no URLs are supplied or discovered', async () => {
    await expect(
      batchAudit({
        urls: [],
      })
    ).rejects.toThrow('No valid URLs provided or discovered to audit in batchAudit()');
  });
});
