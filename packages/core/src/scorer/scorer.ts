import {
  CategoryScore,
  ChecklistItem,
  DEFAULT_PASSING_SCORE,
  FindingCategory,
  GradeRating,
  LintResult,
  RuleRegistry,
  ScorerOptions,
  SEVERITY_PENALTIES,
  WebMCPDetectionResult,
  WebMCPReadinessReport,
  WebMCPReadinessReportSchema,
  CATEGORY_WEIGHTS,
} from '../index.js';
import { getDefaultRegistry } from '../linter/default-registry.js';

export const READINESS_CATEGORIES: FindingCategory[] = [
  'infrastructure',
  'agent-access',
  'declarative',
  'imperative',
  'discovery-manifest',
  'chrome-ai',
];

export const ALL_READINESS_CATEGORIES: FindingCategory[] = READINESS_CATEGORIES;

export const CATEGORY_TITLES: Record<string, string> = {
  'infrastructure': 'Infrastructure & Connectivity',
  'agent-access': 'Agent Access & Permissions',
  'declarative': 'Declarative WebMCP Implementation',
  'imperative': 'Imperative WebMCP JavaScript API',
  'discovery-manifest': 'Discovery Manifest',
  'chrome-ai': 'Chrome Built-in AI (Prompt API)',
};

/**
 * Calculates a letter grade rating (A, B, C, D, F) from a 0-100 numerical score
 */
export function calculateGrade(score: number): GradeRating {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Maps legacy rule categories to the 6 primary readiness categories
 */
export function mapRuleCategoryToReadinessCategory(ruleCategory: FindingCategory): FindingCategory {
  switch (ruleCategory) {
    case 'infrastructure':
      return 'infrastructure';
    case 'agent-access':
      return 'agent-access';
    case 'declarative':
      return 'declarative';
    case 'imperative':
      return 'imperative';
    case 'discovery-manifest':
      return 'discovery-manifest';
    case 'chrome-ai':
      return 'chrome-ai';
    case 'implementation':
      return 'imperative';
    case 'tool-quality':
    case 'best-practices':
      return 'declarative';
    case 'security':
      return 'imperative';
    case 'discoverability':
      return 'discovery-manifest';
    default:
      return ruleCategory;
  }
}

/**
 * Evaluates the specific checklist items for a readiness category
 */
export function evaluateCategoryChecklist(
  category: FindingCategory,
  detection: WebMCPDetectionResult
): ChecklistItem[] {
  switch (category) {
    case 'infrastructure': {
      const isHttps = Boolean(
        detection.url.startsWith('https://') ||
        (detection.finalUrl && detection.finalUrl.startsWith('https://')) ||
        detection.url.startsWith('http://localhost') ||
        detection.url.startsWith('http://127.0.0.1')
      );
      const isFast = detection.responseTimeMs === undefined || detection.responseTimeMs < 1500;
      const hasRobots = Boolean(detection.agentDirectives?.hasRobotsTxt);
      const hasSitemap = Boolean(detection.agentDirectives?.hasSitemapXml);
      const is200 = detection.httpStatus === 200 || detection.httpStatus === undefined;

      return [
        {
          name: 'HTTPS Enabled',
          passed: isHttps,
          points: isHttps ? 4 : 0,
          maxPoints: 4,
          details: isHttps ? 'HTTPS protocol active' : 'HTTP plaintext (HTTPS required)',
        },
        {
          name: 'Fast Server Response',
          passed: isFast,
          points: isFast ? 4 : 0,
          maxPoints: 4,
          details: detection.responseTimeMs !== undefined ? `${detection.responseTimeMs}ms response time` : '< 1500ms nominal response',
        },
        {
          name: 'robots.txt Present',
          passed: hasRobots,
          points: hasRobots ? 4 : 0,
          maxPoints: 4,
          details: hasRobots ? 'Found /robots.txt' : 'Missing /robots.txt',
        },
        {
          name: 'sitemap.xml Present',
          passed: hasSitemap,
          points: hasSitemap ? 4 : 0,
          maxPoints: 4,
          details: hasSitemap ? (detection.agentDirectives?.sitemapUrl ? `Found: ${detection.agentDirectives.sitemapUrl}` : 'Found sitemap.xml') : 'Missing sitemap.xml',
        },
        {
          name: 'Site Returns 200 OK',
          passed: is200,
          points: is200 ? 4 : 0,
          maxPoints: 4,
          details: is200 ? 'HTTP 200 OK' : `HTTP status ${detection.httpStatus ?? 'error'}`,
        },
      ];
    }

    case 'agent-access': {
      const aiAllowed = detection.agentDirectives?.aiCrawlersAllowed !== false;
      const hasLlms = Boolean(detection.hasLlmsTxt || detection.agentDirectives?.hasLlmsTxt);
      const xRobotsOk = !Boolean(detection.xRobotsTagBlocking);
      const metaRobotsOk = !Boolean(detection.metaRobotsBlocking);

      return [
        {
          name: 'AI Agents Not Blocked',
          passed: aiAllowed,
          points: aiAllowed ? 5 : 0,
          maxPoints: 5,
          details: aiAllowed ? 'AI crawler access permitted' : 'AI crawlers blocked in robots.txt',
        },
        {
          name: 'llms.txt Present',
          passed: hasLlms,
          points: hasLlms ? 5 : 0,
          maxPoints: 5,
          details: hasLlms ? 'Found /llms.txt directives' : 'Missing /llms.txt',
        },
        {
          name: 'X-Robots-Tag Not Blocking',
          passed: xRobotsOk,
          points: xRobotsOk ? 5 : 0,
          maxPoints: 5,
          details: xRobotsOk ? 'X-Robots-Tag header allows agents' : 'X-Robots-Tag blocks indexing/crawling',
        },
        {
          name: 'Meta Robots Not Blocking',
          passed: metaRobotsOk,
          points: metaRobotsOk ? 5 : 0,
          maxPoints: 5,
          details: metaRobotsOk ? 'Meta robots tag allows agents' : 'Meta robots tag blocks indexing/crawling',
        },
      ];
    }

    case 'declarative': {
      const hasToolName = Boolean(
        detection.hasToolNameAttribute ||
        detection.tools.some((t) => t.source === 'declarative' && t.name)
      );
      const hasToolDesc = Boolean(
        detection.hasToolDescriptionAttribute ||
        detection.tools.some((t) => t.source === 'declarative' && t.description)
      );
      const hasToolAction = Boolean(
        detection.hasToolActionAttribute ||
        detection.tools.some((t) => t.source === 'declarative')
      );
      const hasForms = Boolean(detection.hasHtmlForms);

      return [
        {
          name: 'toolname Attribute',
          passed: hasToolName,
          points: hasToolName ? 7 : 0,
          maxPoints: 7,
          details: hasToolName ? 'Declared toolname attribute' : 'Missing toolname attribute',
        },
        {
          name: 'tooldescription Attribute',
          passed: hasToolDesc,
          points: hasToolDesc ? 7 : 0,
          maxPoints: 7,
          details: hasToolDesc ? 'Declared tooldescription attribute' : 'Missing tooldescription attribute',
        },
        {
          name: 'toolaction Attribute',
          passed: hasToolAction,
          points: hasToolAction ? 7 : 0,
          maxPoints: 7,
          details: hasToolAction ? 'Declared toolaction/action attribute' : 'Missing toolaction attribute',
        },
        {
          name: 'HTML Forms Present',
          passed: hasForms,
          points: hasForms ? 7 : 0,
          maxPoints: 7,
          details: hasForms ? 'HTML <form> markup detected' : 'No HTML forms detected',
        },
      ];
    }

    case 'imperative': {
      const hasModelContext = Boolean(
        detection.hasNavigatorModelContext ||
        (detection as any).hasDocumentModelContext
      );
      const hasReg = Boolean(
        detection.imperativeDetected ||
        detection.tools.some((t) => t.source === 'imperative')
      );
      const hasAgentInvoked = Boolean(
        (detection as any).hasAgentInvokedOrHumanInLoop ||
        detection.tools.some((t) => t.annotations?.confirmationHint || t.annotations?.readOnlyHint !== undefined)
      );

      return [
        {
          name: 'document.modelContext API',
          passed: hasModelContext,
          points: hasModelContext ? 4 : 0,
          maxPoints: 4,
          details: hasModelContext ? 'document/navigator.modelContext API present' : 'Missing modelContext API',
        },
        {
          name: 'registerTool() Call',
          passed: hasReg,
          points: hasReg ? 4 : 0,
          maxPoints: 4,
          details: hasReg ? `${detection.tools.filter(t => t.source === 'imperative').length} tool(s) registered via registerTool()` : 'No registerTool() calls detected',
        },
        {
          name: 'agentInvoked / Human-in-Loop',
          passed: hasAgentInvoked,
          points: hasAgentInvoked ? 4 : 0,
          maxPoints: 4,
          details: hasAgentInvoked ? 'agentInvoked / confirmation callbacks configured' : 'No agentInvoked or confirmation handlers',
        },
      ];
    }

    case 'discovery-manifest': {
      const hasWellKnown = Boolean(
        detection.manifestDetails?.hasWellKnownWebmcp ||
        detection.manifestDetails?.manifestUrl?.includes('/.well-known/webmcp') ||
        detection.manifestDetails?.manifestUrl?.includes('/.well-known/mcp.json')
      );
      const hasValidJson = Boolean(
        detection.manifestDetails?.isValidJson ??
        (detection.manifestDetails?.hasManifest && detection.manifestDetails?.manifestData)
      );

      return [
        {
          name: '/.well-known/webmcp Present',
          passed: hasWellKnown,
          points: hasWellKnown ? 5 : 0,
          maxPoints: 5,
          details: hasWellKnown ? (detection.manifestDetails?.manifestUrl ? `Found: ${detection.manifestDetails.manifestUrl}` : 'Found /.well-known/webmcp') : 'Missing /.well-known/webmcp endpoint',
        },
        {
          name: 'Valid Manifest JSON',
          passed: hasValidJson,
          points: hasValidJson ? 5 : 0,
          maxPoints: 5,
          details: hasValidJson ? 'Valid manifest JSON payload' : 'Missing or invalid manifest JSON',
        },
      ];
    }

    case 'chrome-ai': {
      const hasChromeAI = Boolean(detection.hasChromeBuiltInAI);

      return [
        {
          name: 'Chrome Built-in AI (Gemini Nano)',
          passed: hasChromeAI,
          points: hasChromeAI ? 10 : 0,
          maxPoints: 10,
          details: hasChromeAI ? 'window.ai / Prompt API (Gemini Nano) detected' : 'Chrome Built-in AI not detected',
        },
      ];
    }

    default:
      return [];
  }
}

/**
 * Evaluates the readiness score for a single category
 */
export function calculateCategoryScore(
  category: FindingCategory,
  lint: LintResult,
  options: ScorerOptions = {},
  registry?: RuleRegistry,
  detection?: WebMCPDetectionResult
): CategoryScore {
  const weight = options.categoryWeights?.[category] ?? CATEGORY_WEIGHTS[category] ?? 20;
  const title = CATEGORY_TITLES[category] ?? category;

  // Filter findings mapped to this category
  const categoryFindings = lint.findings.filter(
    (f) => f.category === category || mapRuleCategoryToReadinessCategory(f.category) === category
  );

  const errors = categoryFindings.filter((f) => f.severity === 'error').length;
  const warnings = categoryFindings.filter((f) => f.severity === 'warning').length;
  const info = categoryFindings.filter((f) => f.severity === 'info').length;

  if (detection) {
    const checklist = evaluateCategoryChecklist(category, detection);
    const maxPoints = checklist.reduce((sum, item) => sum + item.maxPoints, 0) || weight;
    const earnedPoints = checklist.reduce((sum, item) => sum + item.points, 0);

    const score = Math.max(0, Math.min(100, Math.round((earnedPoints / maxPoints) * 100)));
    const weightedScore = Math.round(((score * weight) / 100) * 100) / 100;

    return {
      category,
      title,
      score,
      weight,
      weightedScore,
      checklist,
      findingsCount: {
        errors,
        warnings,
        info,
      },
    };
  }

  // Fallback for standalone lint evaluation without detection (unit testing)
  let totalPenalties = 0;
  for (const finding of categoryFindings) {
    let penalty: number;
    if (options.penaltyStrategy === 'severity') {
      penalty =
        options.severityPenalties?.[finding.severity] ??
        SEVERITY_PENALTIES[finding.severity] ??
        0;
    } else {
      const rule = registry?.getRule(finding.ruleId);
      if (rule && typeof rule.penaltyPoints === 'number') {
        penalty = rule.penaltyPoints;
      } else {
        penalty =
          options.severityPenalties?.[finding.severity] ??
          SEVERITY_PENALTIES[finding.severity] ??
          0;
      }
    }
    totalPenalties += penalty;
  }

  const score = Math.max(0, Math.min(100, 100 - totalPenalties));
  const weightedScore = Math.round(((score * weight) / 100) * 100) / 100;

  return {
    category,
    title,
    score,
    weight,
    weightedScore,
    findingsCount: {
      errors,
      warnings,
      info,
    },
  };
}

/**
 * Calculates the comprehensive WebMCP AI Readiness Report and numerical score (0-100)
 */
export function calculateReadinessScore(
  detection: WebMCPDetectionResult,
  lint: LintResult,
  options: ScorerOptions = {}
): WebMCPReadinessReport {
  const registry: RuleRegistry = options.ruleRegistry ?? getDefaultRegistry();
  const passingScore = options.passingScore ?? DEFAULT_PASSING_SCORE;

  const categoriesMap: Record<FindingCategory, CategoryScore> = {} as any;
  let totalWeightedScore = 0;

  for (const category of READINESS_CATEGORIES) {
    const catScore = calculateCategoryScore(category, lint, options, registry, detection);
    categoriesMap[category] = catScore;
    totalWeightedScore += catScore.weightedScore;
  }

  // Overall score clamped between 0 and 100 and rounded to nearest integer
  const overallScore = Math.max(0, Math.min(100, Math.round(totalWeightedScore)));
  const grade = calculateGrade(overallScore);
  const passed = overallScore >= passingScore;

  // Add backward-compatible aliases for legacy category access
  const legacyAliases: [FindingCategory, FindingCategory][] = [
    ['implementation', 'imperative'],
    ['tool-quality', 'declarative'],
    ['best-practices', 'declarative'],
    ['security', 'imperative'],
    ['discoverability', 'discovery-manifest'],
  ];

  for (const [legacy, target] of legacyAliases) {
    if (!categoriesMap[legacy] && categoriesMap[target]) {
      Object.defineProperty(categoriesMap, legacy, {
        value: categoriesMap[target],
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }

  const report: WebMCPReadinessReport = {
    url: detection.url,
    timestamp: Date.now(),
    overallScore,
    grade,
    passed,
    categories: categoriesMap,
    tools: detection.tools,
    toolCount: detection.tools.length,
    findings: lint.findings,
    summary: {
      totalFindings: lint.findings.length,
      errorCount: lint.errorCount,
      warningCount: lint.warningCount,
      infoCount: lint.infoCount,
      hasNavigatorModelContext: detection.hasNavigatorModelContext,
      hasLlmsTxt: detection.hasLlmsTxt,
    },
  };

  return WebMCPReadinessReportSchema.parse(report);
}
