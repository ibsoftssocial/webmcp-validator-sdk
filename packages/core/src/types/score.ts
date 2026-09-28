import { z } from 'zod';
import { FindingCategorySchema, RuleFindingSchema } from './finding.js';
import { DiscoveredToolSchema } from './scanner.js';

export const GradeRatingSchema = z.enum(['A', 'B', 'C', 'D', 'F']);
export type GradeRating = z.infer<typeof GradeRatingSchema>;

export const CategoryScoreSchema = z.object({
  category: FindingCategorySchema,
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100),
  weightedScore: z.number().min(0).max(100),
  findingsCount: z.object({
    errors: z.number(),
    warnings: z.number(),
    info: z.number(),
  }),
});

export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

export const WebMCPReadinessReportSchema = z.object({
  /** Target URL audited */
  url: string(),
  /** Timestamp when audit completed */
  timestamp: z.number(),
  /** Overall readiness score from 0 to 100 */
  overallScore: z.number().min(0).max(100),
  /** Letter grade rating (A, B, C, D, F) */
  grade: GradeRatingSchema,
  /** Whether the audit passed the threshold (default: >= 80) */
  passed: z.boolean(),
  /** Breakdown by category */
  categories: z.record(FindingCategorySchema, CategoryScoreSchema),
  /** List of all discovered tools */
  tools: z.array(DiscoveredToolSchema),
  /** Total count of tools discovered */
  toolCount: z.number(),
  /** All linter findings and rule violations */
  findings: z.array(RuleFindingSchema),
  /** Summary metadata */
  summary: z.object({
    totalFindings: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
    infoCount: z.number(),
    hasNavigatorModelContext: z.boolean(),
    hasLlmsTxt: z.boolean(),
  }),
});

function string() {
  return z.string();
}

export type WebMCPReadinessReport = z.infer<typeof WebMCPReadinessReportSchema>;
