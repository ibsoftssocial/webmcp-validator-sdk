import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  renderJsonReport,
  renderMarkdownReport,
  renderHtmlReport,
  renderTerminalReport,
  renderSarifReport,
  renderJunitReport,
  generateReport,
  inferReportFormat,
  saveReportToFile,
} from '../index.js';
import {
  WebMCPReadinessReport,
  calculateReadinessScore,
  WebMCPDetectionResult,
  LintResult,
} from '../../index.js';

function createMockReport(overrides: Partial<WebMCPReadinessReport> = {}): WebMCPReadinessReport {
  const detection: WebMCPDetectionResult = {
    url: 'https://example-shop.com',
    scannedAt: 1727800000000,
    durationMs: 320,
    hasNavigatorModelContext: true,
    imperativeDetected: true,
    declarativeDetected: false,
    hasLlmsTxt: true,
    tools: [
      {
        name: 'search_products',
        description: 'Search store catalog by keyword & category',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Product search query' },
            category: { type: 'string' },
          },
          required: ['query'],
        },
        source: 'imperative',
        annotations: {
          readOnlyHint: true,
          confirmationHint: false,
        },
        discoveredAt: 1727800000000,
      },
      {
        name: 'checkout_cart',
        description: 'Process user shopping cart checkout with credit card',
        inputSchema: {
          type: 'object',
          properties: {
            cartId: { type: 'string' },
          },
          required: ['cartId'],
        },
        source: 'imperative',
        annotations: {
          readOnlyHint: false,
          confirmationHint: true,
        },
        discoveredAt: 1727800000000,
      },
    ],
    scanErrors: [],
  };

  const lintResult: LintResult = {
    url: 'https://example-shop.com',
    findings: [
      {
        ruleId: 'SEC-002',
        title: 'Confirmation Hint for Sensitive Operations',
        severity: 'warning',
        category: 'security',
        message: "Tool 'checkout_cart' performs sensitive state modifications without confirmationHint.",
        toolName: 'checkout_cart',
        suggestion: "Add confirmationHint: true to annotations for 'checkout_cart'.",
      },
      {
        ruleId: 'DESC-002',
        title: 'Comprehensive Tool Description',
        severity: 'info',
        category: 'tool-quality',
        message: "Tool 'search_products' has a relatively short description (43 chars).",
        toolName: 'search_products',
        suggestion: 'Expand description to explain return structure and practical usage.',
      },
    ],
    errorCount: 0,
    warningCount: 1,
    infoCount: 1,
    rulesExecuted: 11,
    durationMs: 4,
  };

  const baseReport = calculateReadinessScore(detection, lintResult, { passingScore: 80 });
  return {
    ...baseReport,
    ...overrides,
  };
}

describe('WebMCP Reporter Module (Day 8)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webmcp-reporter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('inferReportFormat()', () => {
    it('infers html format for .html and .htm', () => {
      expect(inferReportFormat('/reports/audit.html')).toBe('html');
      expect(inferReportFormat('audit.htm')).toBe('html');
      expect(inferReportFormat('AUDIT.HTML')).toBe('html');
    });

    it('infers markdown format for .md and .markdown', () => {
      expect(inferReportFormat('/reports/summary.md')).toBe('markdown');
      expect(inferReportFormat('summary.markdown')).toBe('markdown');
      expect(inferReportFormat('README.MD')).toBe('markdown');
    });

    it('infers json format for .json', () => {
      expect(inferReportFormat('/data/result.json')).toBe('json');
      expect(inferReportFormat('RESULT.JSON')).toBe('json');
    });

    it('defaults to json for unrecognized or missing extensions', () => {
      expect(inferReportFormat('/data/result.txt')).toBe('json');
      expect(inferReportFormat('/data/result')).toBe('json');
    });
  });

  describe('renderJsonReport()', () => {
    it('renders valid JSON matching WebMCPReadinessReport structure', () => {
      const report = createMockReport();
      const jsonStr = renderJsonReport(report);

      expect(typeof jsonStr).toBe('string');
      const parsed = JSON.parse(jsonStr);

      expect(parsed.url).toBe(report.url);
      expect(parsed.overallScore).toBe(report.overallScore);
      expect(parsed.grade).toBe(report.grade);
      expect(parsed.passed).toBe(report.passed);
      expect(parsed.toolCount).toBe(2);
      expect(parsed.categories['imperative']).toBeDefined();
    });

    it('respects custom jsonIndent option', () => {
      const report = createMockReport();
      const formatted4 = renderJsonReport(report, { jsonIndent: 4 });
      expect(formatted4).toContain('    "url": "https://example-shop.com"');

      const formatted0 = renderJsonReport(report, { jsonIndent: 0 });
      expect(formatted0.includes('\n')).toBe(false);
    });
  });

  describe('renderMarkdownReport()', () => {
    it('generates GFM markdown with executive summary, tables, and tool details', () => {
      const report = createMockReport();
      const md = renderMarkdownReport(report);

      // Title & Target
      expect(md).toContain('# WebMCP AI Readiness Audit Report');
      expect(md).toContain('**Target URL:** `https://example-shop.com`');
      expect(md).toContain(`**Overall Score:** **${report.overallScore}/100**`);

      // Executive Summary
      expect(md).toContain('## Executive Summary');
      expect(md).toContain('| **Total Discovered Tools** | 2 |');

      // Category Breakdown Table
      expect(md).toContain('## Category Breakdown');
      expect(md).toContain('| **Infrastructure & Connectivity** |');
      expect(md).toContain('| **Agent Access & Permissions** |');
      expect(md).toContain('| **Imperative WebMCP JavaScript API** |');

      // Discovered Tools Table
      expect(md).toContain('## Discovered Tools');
      expect(md).toContain('| `search_products` | `imperative` | ✅ |');
      expect(md).toContain('| `checkout_cart` | `imperative` | — | ⚠️ Required |');

      // Tool Schema collapsible blocks
      expect(md).toContain('### Tool Schemas');
      expect(md).toContain('<details>');
      expect(md).toContain('<summary><b><code>search_products</code></b> Input Schema (JSON)</summary>');
      expect(md).toContain('"properties"');

      // Linter Findings Table
      expect(md).toContain('## Linter Audit Findings');
      expect(md).toContain('🟡 **WARN**');
      expect(md).toContain('`SEC-002`');
      expect(md).toContain('`checkout_cart`');
      expect(md).toContain('`DESC-002`');
      expect(md).toContain('↳ *Fix:*');
    });

    it('respects custom title and includeSchemas: false option', () => {
      const report = createMockReport();
      const md = renderMarkdownReport(report, {
        title: 'Custom Brand Audit Report',
        includeSchemas: false,
      });

      expect(md).toContain('# Custom Brand Audit Report');
      expect(md).not.toContain('### Tool Schemas');
      expect(md).not.toContain('<details>');
    });

    it('renders clean fallback messages when there are 0 tools and 0 findings', () => {
      const detection: WebMCPDetectionResult = {
        url: 'https://empty-site.com',
        scannedAt: Date.now(),
        durationMs: 50,
        hasNavigatorModelContext: false,
        imperativeDetected: false,
        declarativeDetected: false,
        hasLlmsTxt: false,
        tools: [],
        scanErrors: [],
      };
      const lintResult: LintResult = {
        url: 'https://empty-site.com',
        findings: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        rulesExecuted: 11,
        durationMs: 2,
      };
      const report = calculateReadinessScore(detection, lintResult);
      const md = renderMarkdownReport(report);

      expect(md).toContain('> ℹ️ *No WebMCP tools were discovered on this page.*');
      expect(md).toContain('> ✅ *Zero findings! All evaluated WebMCP rules and best practices passed.*');
    });
  });

  describe('renderHtmlReport()', () => {
    it('produces a self-contained, offline-capable HTML5 report with SVG radial gauge', () => {
      const report = createMockReport();
      const html = renderHtmlReport(report);

      // Structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');

      // Styles
      expect(html).toContain('<style>');
      expect(html).toContain('--bg: #0b0f19;');
      expect(html).toContain('--grade-color:');

      // SVG radial progress gauge
      expect(html).toContain('<svg class="gauge-svg"');
      expect(html).toContain('<circle class="gauge-bg"');
      expect(html).toContain('<circle class="gauge-progress"');
      expect(html).toContain(`>${report.overallScore}</span>`);
      expect(html).toContain(`Grade ${report.grade}`);

      expect(html).toContain('Category Breakdown');
      expect(html).toContain('Infrastructure &amp; Connectivity');
      expect(html).toContain('Imperative WebMCP JavaScript API');
      expect(html).toContain('cat-progress-fill');

      // Discovered tools section
      expect(html).toContain('Discovered Tools (2)');
      expect(html).toContain('search_products');
      expect(html).toContain('checkout_cart');
      expect(html).toContain('badge-readonly');
      expect(html).toContain('badge-confirm');
      expect(html).toContain('<details class="schema-details">');
      expect(html).toContain('<summary>View inputSchema</summary>');

      // Findings section
      expect(html).toContain('Linter Audit Findings (2)');
      expect(html).toContain('SEC-002');
      expect(html).toContain('DESC-002');
      expect(html).toContain('finding-pill warning');
      expect(html).toContain('finding-pill info');
      expect(html).toContain('finding-remediation');
    });

    it('sanitizes untrusted content with HTML escaping against XSS injection', () => {
      const report = createMockReport();
      // Inject potentially malicious text into tool and finding
      report.tools[0]!.name = '<script>alert("xss")</script>';
      report.tools[0]!.description = 'Search & "filter" <tools>';
      report.findings[0]!.message = 'Warning with <img src=x onerror=alert(1)> & quotes';

      const html = renderHtmlReport(report);

      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).toContain('Search &amp; &quot;filter&quot; &lt;tools&gt;');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('respects custom title and includeSchemas: false in HTML report', () => {
      const report = createMockReport();
      const html = renderHtmlReport(report, {
        title: 'Executive AI Audit',
        includeSchemas: false,
      });

      expect(html).toContain('Executive AI Audit — https://example-shop.com');
      expect(html).toContain('<span>⚡</span> Executive AI Audit');
      expect(html).not.toContain('<details class="schema-details">');
      expect(html).not.toContain('<summary>View inputSchema</summary>');
    });

    it('renders clean empty state messages when no tools or findings exist', () => {
      const report = createMockReport({
        toolCount: 0,
        tools: [],
        findings: [],
        summary: {
          totalFindings: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
          hasNavigatorModelContext: false,
          hasLlmsTxt: false,
        },
      });

      const html = renderHtmlReport(report);
      expect(html).toContain('No WebMCP tools were discovered on this page.');
      expect(html).toContain('✔ Zero rule violations or security warnings found!');
    });
  });

  describe('renderTerminalReport()', () => {
    it('renders terminal report with score banner, categories, tools, and findings', () => {
      const report = createMockReport();
      const term = renderTerminalReport(report, { colors: false });

      expect(term).toContain('WebMCP AI Readiness Score:');
      expect(term).toContain('Target URL:                 https://example-shop.com');
      expect(term).toContain(`Overall Score:           ${report.overallScore}/100`);
      expect(term).toContain(`[Grade ${report.grade}]`);
      expect(term).toContain('Category Breakdown:');
      expect(term).toContain('Infrastructure & Connectivity');
      expect(term).toContain('Imperative WebMCP JavaScript API');
      expect(term).toContain('Discovered Tools (2):');
      expect(term).toContain('search_products');
      expect(term).toContain('checkout_cart');
      expect(term).toContain('Audit Findings (2):');
      expect(term).toContain('SEC-002');
      expect(term).toContain('DESC-002');
    });

    it('renders colored output with ANSI codes when colors is enabled', () => {
      const report = createMockReport();
      const term = renderTerminalReport(report, { colors: true });
      expect(term).toContain('\x1b[');
    });
  });

  describe('renderSarifReport()', () => {
    it('produces valid OASIS SARIF v2.1.0 JSON format', () => {
      const report = createMockReport();
      const sarifText = renderSarifReport(report);
      const sarif = JSON.parse(sarifText);

      expect(sarif.version).toBe('2.1.0');
      expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
      expect(sarif.runs).toHaveLength(1);

      const run = sarif.runs[0];
      expect(run.tool.driver.name).toBe('webmcp-validator');
      expect(run.tool.driver.rules.length).toBeGreaterThan(0);
      expect(run.results.length).toBe(report.findings.length);

      const warningResult = run.results.find((r: any) => r.ruleId === 'SEC-002');
      expect(warningResult).toBeDefined();
      expect(warningResult.level).toBe('warning');
      expect(warningResult.locations[0].physicalLocation.artifactLocation.uri).toBe(report.url);
      expect(warningResult.locations[0].message.text).toContain('checkout_cart');
    });

    it('maps findings severity levels correctly to SARIF levels', () => {
      const report = createMockReport({
        findings: [
          {
            ruleId: 'TEST-ERR',
            title: 'Critical Error',
            severity: 'error',
            category: 'security',
            message: 'Error finding',
          },
          {
            ruleId: 'TEST-WARN',
            title: 'Warning Issue',
            severity: 'warning',
            category: 'best-practice',
            message: 'Warning finding',
          },
          {
            ruleId: 'TEST-INFO',
            title: 'Info Note',
            severity: 'info',
            category: 'documentation',
            message: 'Info finding',
          },
        ],
      });

      const sarif = JSON.parse(renderSarifReport(report));
      const results = sarif.runs[0].results;

      expect(results[0].level).toBe('error');
      expect(results[1].level).toBe('warning');
      expect(results[2].level).toBe('note');
    });
  });

  describe('renderJunitReport()', () => {
    it('produces standard JUnit XML testsuites and testcases', () => {
      const report = createMockReport();
      const xml = renderJunitReport(report);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<testsuites name="WebMCP AI Readiness Audit"');
      expect(xml).toContain('<testsuite name="webmcp.readiness.categories"');
      expect(xml).toContain('<testsuite name="webmcp.linter.rules"');
      expect(xml).toContain('classname="webmcp.linter.security"');
      expect(xml).toContain('name="SEC-002: Confirmation Hint for Sensitive Operations');
      expect(xml).toContain('<failure message=');
    });

    it('records failed categories and clean passing states in JUnit', () => {
      const report = createMockReport({
        findings: [],
        summary: {
          totalFindings: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
          hasNavigatorModelContext: true,
          hasLlmsTxt: true,
        },
      });

      const xml = renderJunitReport(report);
      expect(xml).toContain('name="All Security & Best-Practice Rules Passed"');
    });
  });

  describe('inferReportFormat()', () => {
    it('correctly infers format from file extensions', () => {
      expect(inferReportFormat('audit.sarif')).toBe('sarif');
      expect(inferReportFormat('results.xml')).toBe('junit');
      expect(inferReportFormat('results.junit')).toBe('junit');
      expect(inferReportFormat('report.html')).toBe('html');
      expect(inferReportFormat('report.htm')).toBe('html');
      expect(inferReportFormat('report.md')).toBe('markdown');
      expect(inferReportFormat('report.markdown')).toBe('markdown');
      expect(inferReportFormat('report.json')).toBe('json');
      expect(inferReportFormat('unknown.ext')).toBe('json');
    });
  });

  describe('generateReport() dispatcher', () => {
    it('dispatches to json, markdown, html, pretty, sarif, and junit generators correctly', () => {
      const report = createMockReport();

      const json = generateReport(report, 'json');
      expect(JSON.parse(json).url).toBe(report.url);

      const md = generateReport(report, 'markdown');
      expect(md.startsWith('# ')).toBe(true);

      const html = generateReport(report, 'html');
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);

      const sarif = generateReport(report, 'sarif');
      expect(JSON.parse(sarif).version).toBe('2.1.0');

      const junit = generateReport(report, 'junit');
      expect(junit).toContain('<testsuites name="WebMCP AI Readiness Audit"');

      const pretty = generateReport(report, 'pretty', { colors: false });
      expect(pretty).toContain('WebMCP AI Readiness Score:');
    });
  });

  describe('saveReportToFile()', () => {
    it('saves a report as HTML when path has .html extension', async () => {
      const report = createMockReport();
      const outPath = path.join(tempDir, 'sub', 'reports', 'audit.html');

      await saveReportToFile(report, outPath);

      const exists = await fs.stat(outPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('search_products');
    });

    it('saves a report as Markdown when path has .md extension', async () => {
      const report = createMockReport();
      const outPath = path.join(tempDir, 'audit.md');

      await saveReportToFile(report, outPath);

      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('# WebMCP AI Readiness Audit Report');
      expect(content).toContain('`search_products`');
    });

    it('saves a report as JSON when path has .json extension', async () => {
      const report = createMockReport();
      const outPath = path.join(tempDir, 'audit.json');

      await saveReportToFile(report, outPath);

      const content = await fs.readFile(outPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.overallScore).toBe(report.overallScore);
    });

    it('saves a report as SARIF when path has .sarif extension', async () => {
      const report = createMockReport();
      const outPath = path.join(tempDir, 'audit.sarif');

      await saveReportToFile(report, outPath);

      const content = await fs.readFile(outPath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('2.1.0');
    });

    it('saves a report as JUnit XML when path has .xml extension', async () => {
      const report = createMockReport();
      const outPath = path.join(tempDir, 'junit.xml');

      await saveReportToFile(report, outPath);

      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('<testsuites name="WebMCP AI Readiness Audit"');
    });

    it('allows explicit format override regardless of file extension', async () => {
      const report = createMockReport();
      const outPath = path.join(tempDir, 'audit.custom');

      await saveReportToFile(report, outPath, { format: 'html' });

      const content = await fs.readFile(outPath, 'utf8');
      expect(content).toContain('<!DOCTYPE html>');
    });
  });
});
