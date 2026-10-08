import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  generateReadinessBadge,
  generateBatchReadinessBadge,
  saveReadinessBadgeToFile,
  saveBatchReadinessBadgeToFile,
  generateMarkdownBadgeSnippet,
  generateReport,
  generateBatchReport,
  inferReportFormat,
} from '../index.js';
import { WebMCPReadinessReport, BatchAuditResult } from '../../types/index.js';

const mockReportA: WebMCPReadinessReport = {
  url: 'https://example.com/perfect',
  timestamp: 1700000000000,
  overallScore: 92,
  grade: 'A',
  passed: true,
  categories: {} as any,
  tools: [],
  toolCount: 3,
  findings: [],
  summary: {
    totalFindings: 0,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    hasNavigatorModelContext: true,
    hasLlmsTxt: true,
  },
};

const mockReportC: WebMCPReadinessReport = {
  url: 'https://example.com/average',
  timestamp: 1700000000000,
  overallScore: 74,
  grade: 'C',
  passed: false,
  categories: {} as any,
  tools: [],
  toolCount: 1,
  findings: [],
  summary: {
    totalFindings: 2,
    errorCount: 0,
    warningCount: 2,
    infoCount: 0,
    hasNavigatorModelContext: true,
    hasLlmsTxt: false,
  },
};

const mockReportF: WebMCPReadinessReport = {
  url: 'https://example.com/failing',
  timestamp: 1700000000000,
  overallScore: 40,
  grade: 'F',
  passed: false,
  categories: {} as any,
  tools: [],
  toolCount: 0,
  findings: [],
  summary: {
    totalFindings: 5,
    errorCount: 3,
    warningCount: 2,
    infoCount: 0,
    hasNavigatorModelContext: false,
    hasLlmsTxt: false,
  },
};

const mockBatchResult: BatchAuditResult = {
  timestamp: 1700000000000,
  durationMs: 4000,
  totalUrls: 3,
  successfulAudits: 3,
  failedAudits: 0,
  averageScore: 88,
  overallGrade: 'B',
  passed: true,
  reports: [mockReportA, mockReportC],
  errors: [],
  summary: {
    totalToolsDiscovered: 4,
    uniqueTools: [],
    totalFindings: 2,
    errorCount: 0,
    warningCount: 2,
    infoCount: 0,
    categoryAverages: {},
  },
};

describe('Badge Reporter (Day 11 SVG Embeddable Badges)', () => {
  const tempFiles: string[] = [];

  afterEach(async () => {
    for (const f of tempFiles) {
      try {
        await fs.unlink(f);
      } catch {}
    }
  });

  describe('generateReadinessBadge', () => {
    it('generates standard combined badge with Grade A emerald color', () => {
      const svg = generateReadinessBadge(mockReportA);
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('WebMCP');
      expect(svg).toContain('92/100 · Grade A');
      expect(svg).toContain('#10b981'); // Emerald color for Grade A
      expect(svg).toContain('rx="3"'); // Default rounded flat style
    });

    it('generates Grade C badge with amber color', () => {
      const svg = generateReadinessBadge(mockReportC, { type: 'grade' });
      expect(svg).toContain('Grade C');
      expect(svg).toContain('#f59e0b'); // Amber color for Grade C
    });

    it('generates Grade F badge with red color', () => {
      const svg = generateReadinessBadge(mockReportF, { type: 'score' });
      expect(svg).toContain('40/100');
      expect(svg).toContain('#ef4444'); // Red color for Grade F
    });

    it('supports compact badge type', () => {
      const svg = generateReadinessBadge(mockReportA, { type: 'compact' });
      expect(svg).toContain('A (92)');
    });

    it('supports custom label and flat-square style', () => {
      const svg = generateReadinessBadge(mockReportA, {
        label: 'AI Audit',
        style: 'flat-square',
      });
      expect(svg).toContain('AI Audit');
      expect(svg).toContain('rx="0"');
    });

    it('escapes special characters in XML title and label', () => {
      const customReport: WebMCPReadinessReport = {
        ...mockReportA,
        url: 'https://example.com/search?q=a&b=c',
      };
      const svg = generateReadinessBadge(customReport, { label: 'Web & AI' });
      expect(svg).toContain('Web &amp; AI');
      expect(svg).toContain('q=a&amp;b=c');
    });
  });

  describe('generateBatchReadinessBadge', () => {
    it('generates site-wide batch readiness badge with Grade B blue color', () => {
      const svg = generateBatchReadinessBadge(mockBatchResult);
      expect(svg).toContain('WebMCP Site');
      expect(svg).toContain('88/100 · Grade B');
      expect(svg).toContain('#3b82f6'); // Blue color for Grade B
    });
  });

  describe('file saving & format inference', () => {
    it('infers badge format from .svg file extension', () => {
      expect(inferReportFormat('audit-badge.svg')).toBe('badge');
      expect(inferReportFormat('/path/to/readiness.svg')).toBe('badge');
    });

    it('generates badge through generateReport and generateBatchReport', () => {
      const singleSvg = generateReport(mockReportA, 'badge');
      expect(singleSvg).toContain('92/100 · Grade A');

      const batchSvg = generateBatchReport(mockBatchResult, 'badge');
      expect(batchSvg).toContain('88/100 · Grade B');
    });

    it('saves badge to file on disk', async () => {
      const outPath = path.join(os.tmpdir(), `badge-test-${Date.now()}.svg`);
      tempFiles.push(outPath);

      await saveReadinessBadgeToFile(mockReportA, outPath);
      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('<svg');
      expect(content).toContain('92/100 · Grade A');
    });

    it('saves batch badge to file on disk', async () => {
      const outPath = path.join(os.tmpdir(), `batch-badge-test-${Date.now()}.svg`);
      tempFiles.push(outPath);

      await saveBatchReadinessBadgeToFile(mockBatchResult, outPath);
      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('<svg');
      expect(content).toContain('88/100 · Grade B');
    });
  });

  describe('generateMarkdownBadgeSnippet', () => {
    it('generates standard markdown image badge link', () => {
      const snippet = generateMarkdownBadgeSnippet({
        badgePathOrUrl: 'https://example.com/badge.svg',
        targetUrl: 'https://example.com/audit.html',
        altText: 'WebMCP Score',
      });
      expect(snippet).toBe('[![WebMCP Score](https://example.com/badge.svg)](https://example.com/audit.html)');
    });
  });
});
