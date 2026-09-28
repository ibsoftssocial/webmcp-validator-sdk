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
  /** Execute validation check */
  validate(context: RuleContext): RuleFinding[] | Promise<RuleFinding[]>;
}
