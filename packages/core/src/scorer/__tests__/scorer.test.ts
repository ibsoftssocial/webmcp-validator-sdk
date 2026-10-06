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
    hasNavigatorModelContext: true,
    imperativeDetected: true,
    declarativeDetected: false,
    hasLlmsTxt: true,
    tools: [
      {
        name: 'search_catalog',
        description: 'Search catalog by query',
        inputSchema: { type: 'object' },
        source: 'imperative',
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

    it('computes weighted reductions across multiple categories', () => {
      const detection = createMockDetection();
      const findings: RuleFinding[] = [
        // tool-quality: TQ-001 (10 pts) -> score 90 (weighted 90 * 0.25 = 22.5)
        {
          ruleId: 'TQ-001',
          title: 'Tool Name Format',
          message: 'Format error',
          severity: 'error',
          category: 'tool-quality',
        },
        // discoverability: DISC-001 (4 pts) -> score 96 (weighted 96 * 0.10 = 9.6)
        {
          ruleId: 'DISC-001',
          title: 'Manifest Link Present',
          message: 'No manifest link',
          severity: 'info',
          category: 'discoverability',
        },
      ];
      // Other categories (implementation: 30, best-practices: 20, security: 15) remain 100.
      // Expected total: 30 + 22.5 + 20 + 15 + 9.6 = 97.1 -> rounded to 97

      const lint = createMockLintResult(findings);
      const report = calculateReadinessScore(detection, lint);

      expect(report.overallScore).toBe(97);
      expect(report.grade).toBe('A');
      expect(report.passed).toBe(true);
      expect(report.categories['tool-quality']!.score).toBe(90);
      expect(report.categories['discoverability']!.score).toBe(96);
    });

    it('marks report as failed when score is below passingScore', () => {
      const detection = createMockDetection();
      // Implementation missing: IMP-001 (25 pts) -> implementation score 75 (weighted 22.5)
      // Tool quality: 3 errors (30 pts) -> score 70 (weighted 17.5)
      // Best practices: 3 errors (30 pts) -> score 70 (weighted 14.0)
      // Total: 22.5 + 17.5 + 14.0 + 15 + 10 = 79
      const findings: RuleFinding[] = [
        { ruleId: 'IMP-001', title: 'Presence', message: 'Err', severity: 'error', category: 'implementation' },
        { ruleId: 'TQ-001', title: 'Name', message: 'Err', severity: 'error', category: 'tool-quality' },
        { ruleId: 'TQ-002', title: 'Desc', message: 'Err', severity: 'error', category: 'tool-quality' },
        { ruleId: 'TQ-001', title: 'Name 2', message: 'Err', severity: 'error', category: 'tool-quality' },
        { ruleId: 'BP-001', title: 'Schema 1', message: 'Err', severity: 'error', category: 'best-practices' },
        { ruleId: 'BP-001', title: 'Schema 2', message: 'Err', severity: 'error', category: 'best-practices' },
        { ruleId: 'BP-001', title: 'Schema 3', message: 'Err', severity: 'error', category: 'best-practices' },
      ];

      const lint = createMockLintResult(findings);
      const report = calculateReadinessScore(detection, lint);

      expect(report.overallScore).toBe(57);
      expect(report.grade).toBe('F');
      expect(report.passed).toBe(false); // default threshold is 80
    });

    it('respects custom passing score threshold', () => {
      const detection = createMockDetection();
      const findings: RuleFinding[] = [
        { ruleId: 'TQ-001', title: 'Name', message: 'Err', severity: 'error', category: 'tool-quality' },
      ]; // Score = 97.5 -> 98

      const lint = createMockLintResult(findings);
      const report = calculateReadinessScore(detection, lint, {
        passingScore: 99,
      });

      expect(report.overallScore).toBe(98);
      expect(report.passed).toBe(false); // 98 < 99
    });

    it('respects custom category weights', () => {
      const detection = createMockDetection();
      const findings: RuleFinding[] = [
        { ruleId: 'TQ-001', title: 'Name', message: 'Err', severity: 'error', category: 'tool-quality' },
      ]; // tool-quality score: 90

      const lint = createMockLintResult(findings);
      const report = calculateReadinessScore(detection, lint, {
        categoryWeights: {
          'tool-quality': 60,
          'implementation': 10,
          'best-practices': 10,
          'security': 10,
          'discoverability': 10,
        },
      });

      // tool-quality: 90 * 0.60 = 54
      // others: 10 + 10 + 10 + 10 = 40
      // total = 94
      expect(report.categories['tool-quality']!.weight).toBe(60);
      expect(report.categories['tool-quality']!.weightedScore).toBe(54);
      expect(report.overallScore).toBe(94);
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

    it('scores /malformed with errors, warnings, and reduced tool quality', async () => {
      const { scanUrl } = await import('../../scanner/playwright-scanner.js');
      const { lintWebMCP } = await import('../../linter/linter.js');

      const detection = await scanUrl(server.getUrl('/malformed'));
      const lint = await lintWebMCP(detection);
      const report = calculateReadinessScore(detection, lint);

      expect(report.url).toBe(server.getUrl('/malformed'));
      expect(report.overallScore).toBeLessThan(100);
      expect(report.summary.errorCount).toBeGreaterThan(0);
      expect(report.summary.warningCount).toBeGreaterThan(0);
      expect(report.categories['tool-quality']!.score).toBeLessThanOrEqual(80);
      expect(report.categories['best-practices']!.score).toBeLessThanOrEqual(90);
    });

    it('scores /legacy with a failing score (< 20, Grade F) due to absence of WebMCP', async () => {
      const { scanUrl } = await import('../../scanner/playwright-scanner.js');
      const { lintWebMCP } = await import('../../linter/linter.js');

      const detection = await scanUrl(server.getUrl('/legacy'));
      const lint = await lintWebMCP(detection);
      const report = calculateReadinessScore(detection, lint);

      expect(report.url).toBe(server.getUrl('/legacy'));
      expect(report.overallScore).toBeLessThan(20);
      expect(report.passed).toBe(false);
      expect(report.grade).toBe('F');
      expect(report.categories['implementation']!.score).toBe(0);
      expect(report.categories['tool-quality']!.score).toBe(0);
      expect(report.categories['best-practices']!.score).toBe(0);
      expect(report.categories['security']!.score).toBe(0);
    });
  });
});

