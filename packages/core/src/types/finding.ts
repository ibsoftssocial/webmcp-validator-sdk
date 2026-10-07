import { z } from 'zod';

export const FindingSeveritySchema = z.enum(['error', 'warning', 'info']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingCategorySchema = z.enum([
  'infrastructure',       // 20 pts: Infrastructure & Connectivity
  'agent-access',          // 20 pts: Agent Access & Permissions
  'declarative',           // 28 pts: Declarative WebMCP Implementation
  'imperative',            // 12 pts: Imperative WebMCP JavaScript API
  'discovery-manifest',    // 10 pts: Discovery Manifest
  'chrome-ai',             // 10 pts: Chrome Built-in AI (Prompt API)
  'implementation',        // Legacy alias for imperative
  'tool-quality',          // Legacy alias for declarative
  'best-practices',        // Legacy alias for declarative
  'security',              // Legacy alias for imperative
  'discoverability',       // Legacy alias for discovery-manifest
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
