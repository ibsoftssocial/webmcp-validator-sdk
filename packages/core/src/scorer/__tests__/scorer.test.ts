import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  calculateGrade,
  calculateCategoryScore,
  calculateReadinessScore,
  ALL_READINESS_CATEGORIES,
} from '../scorer.js';
import {
  WebMCPDetectionResult,
  LintResult,
  RuleFinding,
  CATEGORY_WEIGHTS,
} from '../../index.js';

function createMockDetection(overrides: Partial<WebMCPDetectionResult> = {}): WebMCPDetectionResult {
  return {
    url: 'https://example.com',
    scannedAt: Date.now(),
    durationMs: 120,
    responseTimeMs: 80,
    httpStatus: 200,
    hasNavigatorModelContext: true,
    hasDocumentModelContext: true,
    imperativeDetected: true,
    declarativeDetected: true,
    hasLlmsTxt: true,
    hasHtmlForms: true,
    hasToolNameAttribute: true,
    hasToolDescriptionAttribute: true,
    hasToolActionAttribute: true,
    hasChromeBuiltInAI: true,
    hasAgentInvokedOrHumanInLoop: true,
    metaRobotsBlocking: false,
    xRobotsTagBlocking: false,
    agentDirectives: {
      hasLlmsTxt: true,
      hasLlmsFullTxt: false,
      hasRobotsTxt: true,
      aiCrawlersAllowed: true,
      hasSitemapXml: true,
      errors: [],
    },
    manifestDetails: {
      hasManifest: true,
      hasWellKnownWebmcp: true,
      isValidJson: true,
      manifestData: { tools: [] },
      tools: [],
      errors: [],
    },
    tools: [
      {
        name: 'search_catalog',
        description: 'Search catalog by query',
        inputSchema: { type: 'object' },
        source: 'imperative',
        annotations: { confirmationHint: true },
        discoveredAt: Date.now(),
      },
      {
        name: 'declarative_search',
        description: 'Declarative search tool',
        inputSchema: { type: 'object' },
        source: 'declarative',
        discoveredAt: Date.now(),
      },
    ],
    scanErrors: [],
    ...overrides,
  };
}

function createMockLintResult(findings: RuleFinding[] = []): LintResult {
  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  return {
    url: 'https://example.com',
    findings,
    errorCount,
    warningCount,
    infoCount,
    rulesExecuted: 11,
    durationMs: 5,
  };
}

describe('WebMCP Scorer Engine (Day 7)', () => {
  describe('calculateGrade()', () => {
    it('returns grade A for scores 90-100', () => {
      expect(calculateGrade(100)).toBe('A');
      expect(calculateGrade(95)).toBe('A');
      expect(calculateGrade(90)).toBe('A');
    });

    it('returns grade B for scores 80-89', () => {
      expect(calculateGrade(89)).toBe('B');
      expect(calculateGrade(85)).toBe('B');
      expect(calculateGrade(80)).toBe('B');
    });

    it('returns grade C for scores 70-79', () => {
      expect(calculateGrade(79)).toBe('C');
      expect(calculateGrade(75)).toBe('C');
      expect(calculateGrade(70)).toBe('C');
    });

    it('returns grade D for scores 60-69', () => {
      expect(calculateGrade(69)).toBe('D');
      expect(calculateGrade(65)).toBe('D');
      expect(calculateGrade(60)).toBe('D');
    });

    it('returns grade F for scores below 60', () => {
      expect(calculateGrade(59)).toBe('F');
      expect(calculateGrade(40)).toBe('F');
      expect(calculateGrade(0)).toBe('F');
    });
  });

  describe('calculateCategoryScore()', () => {
    it('returns 100 and full weighted score when there are zero findings', () => {
      const lint = createMockLintResult([]);
      const catScore = calculateCategoryScore('tool-quality', lint);

      expect(catScore.score).toBe(100);
      expect(catScore.weight).toBe(CATEGORY_WEIGHTS['tool-quality']); // 25
      expect(catScore.weightedScore).toBe(25);
      expect(catScore.findingsCount).toEqual({ errors: 0, warnings: 0, info: 0 });
    });

    it('deducts penalty points for rule violations', () => {
      const finding: RuleFinding = {
        ruleId: 'TQ-001', // tool-name-format has penaltyPoints: 10
        title: 'Tool Name Format',
        message: 'Name is invalid',
        severity: 'error',
        category: 'tool-quality',
      };

      const lint = createMockLintResult([finding]);
      const catScore = calculateCategoryScore('tool-quality', lint);

      expect(catScore.score).toBe(90); // 100 - 10
      expect(catScore.weightedScore).toBe(22.5); // 90 * 0.25
      expect(catScore.findingsCount.errors).toBe(1);
    });

    it('caps score at minimum 0 even with excessive findings', () => {
      const findings: RuleFinding[] = Array.from({ length: 15 }, (_, i) => ({
        ruleId: 'IMP-001', // penaltyPoints: 25
        title: 'WebMCP Presence',
        message: `Missing ${i}`,
        severity: 'error',
        category: 'implementation',
      }));

      const lint = createMockLintResult(findings);
      const catScore = calculateCategoryScore('implementation', lint);

      expect(catScore.score).toBe(0);
      expect(catScore.weightedScore).toBe(0);
      expect(catScore.findingsCount.errors).toBe(15);
    });

    it('supports severity penalty strategy', () => {
      const finding: RuleFinding = {
        ruleId: 'CUSTOM-001',
        title: 'Custom Warning',
        message: 'Warning text',
        severity: 'warning', // default warning penalty is 4
        category: 'security',
      };

      const lint = createMockLintResult([finding]);
      const catScore = calculateCategoryScore('security', lint, {
        penaltyStrategy: 'severity',
      });

      expect(catScore.score).toBe(96); // 100 - 4
      expect(catScore.weightedScore).toBe(14.4); // 96 * 0.15 = 14.4
    });
  });

  describe('calculateReadinessScore()', () => {
    it('produces 100/100, Grade A, passed = true for perfect implementation', () => {
      const detection = createMockDetection();
      const lint = createMockLintResult([]);

      const report = calculateReadinessScore(detection, lint);

      expect(report.url).toBe(detection.url);
      expect(report.overallScore).toBe(100);
      expect(report.grade).toBe('A');
      expect(report.passed).toBe(true);
      expect(report.summary.totalFindings).toBe(0);
      expect(report.summary.errorCount).toBe(0);
      expect(report.summary.hasNavigatorModelContext).toBe(true);

      for (const cat of ALL_READINESS_CATEGORIES) {
        expect(report.categories[cat]).toBeDefined();
        expect(report.categories[cat]!.score).toBe(100);
      }
    });

    it('computes checklist point reductions across categories', () => {
      // Perfect score is 100.
      // Dropping Chrome Built-in AI (-10 pts) and Manifest (-10 pts) gives 80
      const detection = createMockDetection({
        hasChromeBuiltInAI: false,
        manifestDetails: {
          hasManifest: false,
          hasWellKnownWebmcp: false,
          isValidJson: false,
          tools: [],
          errors: [],
        },
      });

      const lint = createMockLintResult([]);
      const report = calculateReadinessScore(detection, lint);

      expect(report.overallScore).toBe(80);
      expect(report.grade).toBe('B');
      expect(report.passed).toBe(true);
      expect(report.categories['chrome-ai']!.score).toBe(0);
      expect(report.categories['discovery-manifest']!.score).toBe(0);
    });

    it('marks report as failed when score is below passingScore', () => {
      // Dropping Declarative (-28 pts), Imperative (-12 pts), and Chrome AI (-10 pts) gives 50/100
      const detection = createMockDetection({
        hasHtmlForms: false,
        hasToolNameAttribute: false,
        hasToolDescriptionAttribute: false,
        hasToolActionAttribute: false,
        hasNavigatorModelContext: false,
        hasDocumentModelContext: false,
        imperativeDetected: false,
        hasAgentInvokedOrHumanInLoop: false,
        hasChromeBuiltInAI: false,
        tools: [],
      });

      const lint = createMockLintResult([]);
      const report = calculateReadinessScore(detection, lint);

      expect(report.overallScore).toBe(50);
      expect(report.grade).toBe('F');
      expect(report.passed).toBe(false); // default threshold is 80
    });

    it('respects custom passing score threshold', () => {
      const detection = createMockDetection({
        hasChromeBuiltInAI: false, // 90 / 100
      });

      const lint = createMockLintResult([]);
      const report = calculateReadinessScore(detection, lint, {
        passingScore: 95,
      });

      expect(report.overallScore).toBe(90);
      expect(report.passed).toBe(false); // 90 < 95
    });

    it('respects custom category weights', () => {
      const detection = createMockDetection();
      const lint = createMockLintResult([]);
      const report = calculateReadinessScore(detection, lint, {
        categoryWeights: {
          'declarative': 40,
          'infrastructure': 10,
          'agent-access': 10,
          'imperative': 20,
          'discovery-manifest': 10,
          'chrome-ai': 10,
        },
      });

      expect(report.categories['declarative']!.weight).toBe(40);
      expect(report.categories['declarative']!.weightedScore).toBe(40);
      expect(report.overallScore).toBe(100);
    });
  });

  describe('End-to-End Fixture Audits with MockServer', () => {
    let server: any;

    beforeAll(async () => {
      const { startMockServer } = await import('../../testing/mock-server.js');
      server = await startMockServer({ port: 0 });
    });

    afterAll(async () => {
      if (server) {
        await server.stop();
      }
    });

    it('scores /perfect with a high passing score (Grade A)', async () => {
      const { scanUrl } = await import('../../scanner/playwright-scanner.js');
      const { lintWebMCP } = await import('../../linter/linter.js');

      const detection = await scanUrl(server.getUrl('/perfect'));
      const lint = await lintWebMCP(detection);
      const report = calculateReadinessScore(detection, lint);

      expect(report.url).toBe(server.getUrl('/perfect'));
      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.grade).toBe('A');
      expect(report.passed).toBe(true);
      expect(report.toolCount).toBeGreaterThanOrEqual(3);
    });

    it('scores /malformed with errors and reduced score', async () => {
      const { scanUrl } = await import('../../scanner/playwright-scanner.js');
      const { lintWebMCP } = await import('../../linter/linter.js');

      const detection = await scanUrl(server.getUrl('/malformed'));
      const lint = await lintWebMCP(detection);
      const report = calculateReadinessScore(detection, lint);

      expect(report.url).toBe(server.getUrl('/malformed'));
      expect(report.overallScore).toBeLessThan(100);
      expect(report.summary.errorCount).toBeGreaterThan(0);
      expect(report.categories['declarative']!.score).toBeLessThanOrEqual(80);
    });

    it('scores /legacy with a failing score (< 70) due to absence of WebMCP', async () => {
      const { scanUrl } = await import('../../scanner/playwright-scanner.js');
      const { lintWebMCP } = await import('../../linter/linter.js');

      const detection = await scanUrl(server.getUrl('/legacy'));
      const lint = await lintWebMCP(detection);
      const report = calculateReadinessScore(detection, lint);

      expect(report.url).toBe(server.getUrl('/legacy'));
      expect(report.overallScore).toBeLessThan(70);
      expect(report.passed).toBe(false);
      expect(report.categories['imperative']!.score).toBe(0);
      expect(report.categories['chrome-ai']!.score).toBe(0);
    });
  });
});

