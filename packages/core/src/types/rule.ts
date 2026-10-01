import { FindingCategory, FindingSeverity, RuleFinding } from './finding.js';
import { DiscoveredTool, WebMCPDetectionResult } from './scanner.js';

export interface RuleContext {
  /** The full detection result from scanning */
  detection: WebMCPDetectionResult;
  /** Current tool being inspected (if tool-level rule) */
  tool?: DiscoveredTool;
  /** List of all tools */
  allTools: DiscoveredTool[];
}

export interface LintRule {
  /** Unique rule ID, e.g., 'IMP-001', 'TQ-002', 'BP-001' */
  id: string;
  /** Short human-readable title */
  title: string;
  /** Description of what this rule validates */
  description: string;
  /** Category */
  category: FindingCategory;
  /** Default severity when violated */
  defaultSeverity: FindingSeverity;
  /** Points penalty deducted from the category score when violated */
  penaltyPoints: number;
  /** Scope of rule evaluation: 'page' (evaluates once per scan) or 'tool' (evaluates once per tool). Default is inferred. */
  scope?: 'page' | 'tool';
  /** External documentation or specification URL */
  docsUrl?: string;
  /** Execute validation check */
  validate(context: RuleContext): RuleFinding[] | Promise<RuleFinding[]>;
}

export interface LintResult {
  /** Target URL that was audited */
  url: string;
  /** All findings and rule violations */
  findings: RuleFinding[];
  /** Breakdown counts by severity */
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Number of distinct rules evaluated */
  rulesExecuted: number;
  /** Evaluation execution duration in ms */
  durationMs: number;
}

export interface LinterOptions {
  /** Specific rule IDs to include (whitelist) */
  includeRules?: string[];
  /** Specific rule IDs to exclude (blacklist) */
  excludeRules?: string[];
  /** Filter to specific categories */
  categories?: FindingCategory[];
  /** Minimum severity to include in report ('info' | 'warning' | 'error') */
  minSeverity?: FindingSeverity;
  /** Severity overrides per rule ID */
  severityOverrides?: Record<string, FindingSeverity>;
}
