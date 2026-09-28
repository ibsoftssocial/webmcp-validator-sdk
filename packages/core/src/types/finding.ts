import { z } from 'zod';

export const FindingSeveritySchema = z.enum(['error', 'warning', 'info']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingCategorySchema = z.enum([
  'implementation',   // 30 pts: WebMCP presence, core APIs
  'tool-quality',     // 25 pts: Descriptions, naming, parameter definitions
  'best-practices',   // 20 pts: JSON schema validity, reasonable limits
  'security',         // 15 pts: Destructive/mutation safety hints
  'discoverability',  // 10 pts: llms.txt, manifests, discovery tags
]);

export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export const RuleFindingSchema = z.object({
  /** Unique rule ID (e.g. "BP-001", "SEC-002", "TQ-003") */
  ruleId: z.string(),
  /** Human-readable title of the rule */
  title: z.string(),
  /** Description of what failed or was observed */
  message: z.string(),
  /** Severity level */
  severity: FindingSeveritySchema,
  /** Category of the finding */
  category: FindingCategorySchema,
  /** Associated tool name if applicable */
  toolName: z.string().optional(),
  /** Remediation advice on how the developer can fix it */
  suggestion: z.string().optional(),
  /** Reference URL or specification section */
  docsUrl: z.string().optional(),
});

export type RuleFinding = z.infer<typeof RuleFindingSchema>;
