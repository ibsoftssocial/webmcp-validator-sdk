import {
  CategoryScore,
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

export const ALL_READINESS_CATEGORIES: FindingCategory[] = [
  'implementation',
  'tool-quality',
  'best-practices',
  'security',
  'discoverability',
];

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
 * Evaluates the readiness score for a single category based on linter findings
 */
export function calculateCategoryScore(
  category: FindingCategory,
  lint: LintResult,
  options: ScorerOptions = {},
  registry?: RuleRegistry,
  detection?: WebMCPDetectionResult
): CategoryScore {
  const weight = options.categoryWeights?.[category] ?? CATEGORY_WEIGHTS[category];
  const categoryFindings = lint.findings.filter((f) => f.category === category);

  const errors = categoryFindings.filter((f) => f.severity === 'error').length;
  const warnings = categoryFindings.filter((f) => f.severity === 'warning').length;
  const info = categoryFindings.filter((f) => f.severity === 'info').length;

  // If a site has 0 tools, tool-specific categories cannot score 100%
  if (detection && detection.tools.length === 0) {
    if (category === 'tool-quality' || category === 'best-practices' || category === 'security') {
      return {
        category,
        score: 0,
        weight,
        weightedScore: 0,
        findingsCount: {
          errors,
          warnings,
          info,
        },
      };
    }
  }

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

  // Raw score is capped between 0 and 100
  const score = Math.max(0, Math.min(100, 100 - totalPenalties));
  const weightedScore = Math.round(((score * weight) / 100) * 100) / 100;

  return {
    category,
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

  for (const category of ALL_READINESS_CATEGORIES) {
    const catScore = calculateCategoryScore(category, lint, options, registry, detection);
    categoriesMap[category] = catScore;
    totalWeightedScore += catScore.weightedScore;
  }

  // Overall score clamped between 0 and 100 and rounded to nearest integer
  const overallScore = Math.max(0, Math.min(100, Math.round(totalWeightedScore)));
  const grade = calculateGrade(overallScore);
  const passed = overallScore >= passingScore;

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
