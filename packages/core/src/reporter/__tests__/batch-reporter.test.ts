import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  renderBatchTerminalReport,
  renderBatchJsonReport,
  renderBatchMarkdownReport,
  renderBatchSarifReport,
  renderBatchJunitReport,
  renderBatchHtmlReport,
  generateBatchReport,
  saveBatchReportToFile,
} from '../index.js';
import { BatchAuditResult, WebMCPReadinessReport } from '../../types/index.js';

const mockReport1: WebMCPReadinessReport = {
  url: 'https://example.com/page1',
  timestamp: 1700000000000,
  overallScore: 92,
  grade: 'A',
  passed: true,
  categories: {
    'infrastructure': {
      category: 'infrastructure',
      score: 95,
      weight: 20,
      weightedScore: 19,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
    'agent-access': {
      category: 'agent-access',
      score: 90,
      weight: 20,
      weightedScore: 18,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
    'declarative': {
      category: 'declarative',
      score: 90,
      weight: 28,
      weightedScore: 25.2,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
    'imperative': {
      category: 'imperative',
      score: 90,
      weight: 12,
      weightedScore: 10.8,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
  },
  tools: [
    {
      name: 'search_items',
      description: 'Search store catalog items',
      inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      annotations: { readOnlyHint: true },
      source: 'imperative',
      discoveredAt: Date.now(),
    },
  ],
  toolCount: 1,
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

const mockReport2: WebMCPReadinessReport = {
  url: 'https://example.com/page2',
  timestamp: 1700000000000,
  overallScore: 78,
  grade: 'C',
  passed: false,
  categories: {
    'infrastructure': {
      category: 'infrastructure',
      score: 75,
      weight: 20,
      weightedScore: 15,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
    'agent-access': {
      category: 'agent-access',
      score: 80,
      weight: 20,
      weightedScore: 16,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
    'declarative': {
      category: 'declarative',
      score: 80,
      weight: 28,
      weightedScore: 22.4,
      findingsCount: { errors: 0, warnings: 1, info: 0 },
      checklist: [],
    },
    'imperative': {
      category: 'imperative',
      score: 75,
      weight: 12,
      weightedScore: 9,
      findingsCount: { errors: 0, warnings: 0, info: 0 },
      checklist: [],
    },
  },
  tools: [
    {
      name: 'order_item',
      description: 'Place an order for item',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } } },
      annotations: { consequentialHint: true },
      source: 'declarative',
      discoveredAt: Date.now(),
    },
  ],
  toolCount: 1,
  findings: [
    {
      ruleId: 'SEC-001',
      category: 'imperative',
      title: 'State-Changing Tool Confirmation',
      severity: 'warning',
      message: 'State-changing tool requires confirmation',
      suggestion: 'Add consequentialHint: true',
    },
  ],
  summary: {
    totalFindings: 1,
    errorCount: 0,
    warningCount: 1,
    infoCount: 0,
    hasNavigatorModelContext: true,
    hasLlmsTxt: false,
  },
};

const mockBatchResult: BatchAuditResult = {
  timestamp: 1700000000000,
  durationMs: 3250,
  totalUrls: 2,
  successfulAudits: 2,
  failedAudits: 0,
  averageScore: 85,
  overallGrade: 'B',
  passed: true,
  reports: [mockReport1, mockReport2],
  errors: [],
  summary: {
    totalToolsDiscovered: 2,
    uniqueTools: [...mockReport1.tools, ...mockReport2.tools],
    totalFindings: 1,
    errorCount: 0,
    warningCount: 1,
    infoCount: 0,
    categoryAverages: {
      'infrastructure': 85,
      'agent-access': 85,
      'declarative': 85,
      'imperative': 83,
    },
  },
};

describe('Batch Reporter', () => {
  const tempFiles: string[] = [];

  afterEach(async () => {
    for (const f of tempFiles) {
      try {
        await fs.unlink(f);
      } catch {}
    }
  });

  it('renders clean terminal report with colors disabled', () => {
    const report = renderBatchTerminalReport(mockBatchResult, { colors: false });
    expect(report).toContain('WebMCP Site-Wide Batch Audit Report');
    expect(report).toContain('Site-Wide Average Score:   85/100');
    expect(report).toContain('https://example.com/page1');
    expect(report).toContain('https://example.com/page2');
    expect(report).toContain('search_items');
    expect(report).toContain('order_item');
  });

  it('renders valid batch JSON output', () => {
    const jsonStr = renderBatchJsonReport(mockBatchResult);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.totalUrls).toBe(2);
    expect(parsed.averageScore).toBe(85);
    expect(parsed.reports).toHaveLength(2);
    expect(parsed.summary.uniqueTools).toHaveLength(2);
  });

  it('renders markdown report with tables and badges', () => {
    const md = renderBatchMarkdownReport(mockBatchResult);
    expect(md).toContain('# WebMCP Site-Wide Batch Audit Report');
    expect(md).toContain('| Page URL | Score | Grade | Status | Discovered Tools | Findings |');
    expect(md).toContain('https://example.com/page1');
    expect(md).toContain('https://example.com/page2');
    expect(md).toContain('## Site-Wide Unique Tools Inventory');
  });

  it('renders SARIF report containing merged findings across pages', () => {
    const sarifStr = renderBatchSarifReport(mockBatchResult);
    const sarif = JSON.parse(sarifStr);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toBeDefined();
    expect(sarif.runs[0]?.results.length).toBeGreaterThan(0);
  });

  it('renders multi-testsuite JUnit XML document', () => {
    const junitXml = renderBatchJunitReport(mockBatchResult);
    expect(junitXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(junitXml).toContain('<testsuites name="WebMCP Site-Wide Batch Audit" tests="2"');
    expect(junitXml).toContain('<testsuite name="webmcp.readiness.categories"');
    expect(junitXml).toContain('<testsuite name="webmcp.linter.rules"');
  });

  it('renders self-contained HTML batch dashboard', () => {
    const html = renderBatchHtmlReport(mockBatchResult);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('WebMCP Site-Wide Batch Audit Report');
    expect(html).toContain('https://example.com/page1');
    expect(html).toContain('https://example.com/page2');
    expect(html).toContain('search_items');
    expect(html).toContain('order_item');
  });

  it('supports generateBatchReport with all formats', () => {
    expect(generateBatchReport(mockBatchResult, 'pretty')).toContain('WebMCP Site-Wide Batch');
    expect(generateBatchReport(mockBatchResult, 'json')).toContain('"averageScore": 85');
    expect(generateBatchReport(mockBatchResult, 'markdown')).toContain('# WebMCP Site-Wide');
    expect(generateBatchReport(mockBatchResult, 'html')).toContain('<!DOCTYPE html>');
    expect(generateBatchReport(mockBatchResult, 'sarif')).toContain('2.1.0');
    expect(generateBatchReport(mockBatchResult, 'junit')).toContain('<testsuites');
  });

  it('saves batch report to file with correct inferred format', async () => {
    const tmpFile = path.join(os.tmpdir(), `batch-test-${Date.now()}.json`);
    tempFiles.push(tmpFile);

    await saveBatchReportToFile(mockBatchResult, tmpFile);
    const content = await fs.readFile(tmpFile, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.totalUrls).toBe(2);
  });
});
