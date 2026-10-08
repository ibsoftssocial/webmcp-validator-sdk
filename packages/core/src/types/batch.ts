import { z } from 'zod';
import { ScanTargetOptions, DiscoveredTool } from './scanner.js';
import { LinterOptions } from './rule.js';
import { ScorerOptions, GradeRating, WebMCPReadinessReport } from './score.js';

export interface BatchScanTarget {
  url: string;
  label?: string;
}

export interface BatchAuditOptions {
  /** List of URLs or targets to audit */
  urls?: Array<string | BatchScanTarget>;
  /** Optional sitemap URL to crawl and audit */
  sitemapUrl?: string;
  /** Maximum concurrent browser scans (default: 3) */
  concurrency?: number;
  /** Maximum number of URLs to scan (default: 25) */
  limit?: number;
  /** Target pass threshold score (0-100) (default: 80) */
  failUnder?: number;
  /** Scanner options passed to individual scans (mobile, blockMedia, cookies, headers, timeoutMs) */
  scannerOptions?: Omit<ScanTargetOptions, 'url'>;
  /** Linter options */
  linterOptions?: LinterOptions;
  /** Scorer options */
  scorerOptions?: ScorerOptions;
  /** Progress callback */
  onProgress?: (progress: BatchAuditProgress) => void;
}

export interface BatchAuditProgress {
  completed: number;
  total: number;
  currentUrl: string;
  status: 'scanning' | 'passed' | 'failed' | 'error';
  score?: number;
  error?: string;
}

export interface BatchAuditResult {
  timestamp: number;
  durationMs: number;
  totalUrls: number;
  successfulAudits: number;
  failedAudits: number;
  averageScore: number;
  overallGrade: GradeRating;
  passed: boolean;
  /** Individual page audit reports */
  reports: WebMCPReadinessReport[];
  /** Errors encountered during scans */
  errors: Array<{ url: string; error: string }>;
  summary: {
    totalToolsDiscovered: number;
    uniqueTools: DiscoveredTool[];
    totalFindings: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    categoryAverages: Record<string, number>;
  };
}

export const BatchScanTargetSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
});
