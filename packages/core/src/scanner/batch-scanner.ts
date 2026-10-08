import {
  BatchAuditOptions,
  BatchAuditResult,
  WebMCPReadinessReport,
  DiscoveredTool,
} from '../types/index.js';
import { PlaywrightScanner } from './playwright-scanner.js';
import { lintWebMCP } from '../linter/linter.js';
import { calculateReadinessScore, calculateGrade } from '../scorer/scorer.js';
import { fetchAndParseSitemap } from '../discovery/sitemap-parser.js';

/**
 * Executes concurrent, multi-page WebMCP AI readiness audits with browser pooling,
 * sitemap crawling, and aggregated site-wide scoring.
 */
export async function batchAudit(options: BatchAuditOptions): Promise<BatchAuditResult> {
  const startTime = Date.now();
  const rawUrls: string[] = [];

  // 1. Resolve URLs from explicit list
  if (options.urls && options.urls.length > 0) {
    for (const target of options.urls) {
      const url = typeof target === 'string' ? target : target.url;
      if (url && !rawUrls.includes(url)) {
        rawUrls.push(url);
      }
    }
  }

  // 2. Resolve URLs from sitemap if provided
  if (options.sitemapUrl) {
    try {
      const sitemapRes = await fetchAndParseSitemap(options.sitemapUrl, {
        limit: options.limit ?? 50,
      });
      for (const u of sitemapRes.urls) {
        if (!rawUrls.includes(u)) {
          rawUrls.push(u);
        }
      }
    } catch (err: any) {
      // Continue with any explicit URLs
    }
  }

  // Apply overall limit
  const limit = options.limit ?? 25;
  const targetUrls = rawUrls.slice(0, limit);

  if (targetUrls.length === 0) {
    throw new Error('No valid URLs provided or discovered to audit in batchAudit()');
  }

  const reports: WebMCPReadinessReport[] = [];
  const errors: Array<{ url: string; error: string }> = [];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 10));
  const failUnder = options.failUnder ?? 80;

  // 3. Initialize persistent browser scanner
  const scanner = new PlaywrightScanner({
    persistentBrowser: true,
    headless: true,
  });

  let completedCount = 0;
  const totalCount = targetUrls.length;

  try {
    // 4. Concurrency Queue Execution
    let currentIndex = 0;

    async function worker(): Promise<void> {
      while (currentIndex < targetUrls.length) {
        const url = targetUrls[currentIndex++];
        if (!url) break;

        options.onProgress?.({
          completed: completedCount,
          total: totalCount,
          currentUrl: url,
          status: 'scanning',
        });

        try {
          // Scan single page using pooled browser
          const detection = await scanner.scan({
            url,
            ...options.scannerOptions,
          });

          // Check if page navigation failed completely
          if (
            detection.scanErrors.length > 0 &&
            (!detection.httpStatus ||
              detection.scanErrors.some(
                (e) => e.includes('Scanner error') || e.includes('page.goto')
              ))
          ) {
            const fatalMsg = detection.scanErrors.join('; ');
            errors.push({ url, error: fatalMsg });
            completedCount++;
            options.onProgress?.({
              completed: completedCount,
              total: totalCount,
              currentUrl: url,
              status: 'error',
              error: fatalMsg,
            });
            continue;
          }

          // Run linter rules
          const lintResult = await lintWebMCP(detection, options.linterOptions);

          // Compute readiness score
          const report = calculateReadinessScore(detection, lintResult, {
            ...options.scorerOptions,
            passingScore: failUnder,
          });

          reports.push(report);
          completedCount++;

          const isPassed = report.overallScore >= failUnder;
          options.onProgress?.({
            completed: completedCount,
            total: totalCount,
            currentUrl: url,
            status: isPassed ? 'passed' : 'failed',
            score: report.overallScore,
          });
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push({ url, error: errMsg });
          completedCount++;

          options.onProgress?.({
            completed: completedCount,
            total: totalCount,
            currentUrl: url,
            status: 'error',
            error: errMsg,
          });
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, targetUrls.length) }, () =>
      worker()
    );
    await Promise.all(workers);
  } finally {
    // 5. Always close persistent browser instance
    await scanner.close();
  }

  // 6. Aggregate results across all audited pages
  const averageScore =
    reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length)
      : 0;

  const overallGrade = calculateGrade(averageScore);
  const passed = (options.failUnder === undefined || averageScore >= failUnder) && errors.length === 0;

  // Deduplicate tools discovered across pages
  const toolsMap = new Map<string, DiscoveredTool>();
  let totalToolsDiscovered = 0;
  for (const r of reports) {
    totalToolsDiscovered += r.toolCount;
    for (const t of r.tools) {
      if (!toolsMap.has(t.name)) {
        toolsMap.set(t.name, t);
      }
    }
  }

  // Aggregate category averages
  const categorySums: Record<string, { sum: number; count: number }> = {};
  let totalFindings = 0;
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const r of reports) {
    totalFindings += r.summary.totalFindings;
    errorCount += r.summary.errorCount;
    warningCount += r.summary.warningCount;
    infoCount += r.summary.infoCount;

    for (const [cat, data] of Object.entries(r.categories)) {
      if (!categorySums[cat]) {
        categorySums[cat] = { sum: 0, count: 0 };
      }
      categorySums[cat].sum += data.score;
      categorySums[cat].count += 1;
    }
  }

  const categoryAverages: Record<string, number> = {};
  for (const [cat, val] of Object.entries(categorySums)) {
    categoryAverages[cat] = val.count > 0 ? Math.round(val.sum / val.count) : 0;
  }

  return {
    timestamp: startTime,
    durationMs: Date.now() - startTime,
    totalUrls: targetUrls.length,
    successfulAudits: reports.length,
    failedAudits: errors.length,
    averageScore,
    overallGrade,
    passed,
    reports,
    errors,
    summary: {
      totalToolsDiscovered,
      uniqueTools: Array.from(toolsMap.values()),
      totalFindings,
      errorCount,
      warningCount,
      infoCount,
      categoryAverages,
    },
  };
}
