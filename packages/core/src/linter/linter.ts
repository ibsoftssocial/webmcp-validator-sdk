import {
  FindingSeverity,
  LintResult,
  LinterOptions,
  RuleFinding,
  WebMCPDetectionResult,
} from '../types/index.js';
import { RuleRegistry } from './rule-registry.js';
import { getDefaultRegistry } from './default-registry.js';

const SEVERITY_LEVELS: Record<FindingSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

/**
 * Core WebMCP Linter engine that executes rules and audits discovered tools.
 */
export class WebMCPLinter {
  private registry: RuleRegistry;

  constructor(registry?: RuleRegistry) {
    this.registry = registry || getDefaultRegistry();
  }

  /**
   * Lint a WebMCP detection result and return all discovered findings and violations.
   */
  async lint(detection: WebMCPDetectionResult, options: LinterOptions = {}): Promise<LintResult> {
    const startTime = Date.now();
    const findings: RuleFinding[] = [];

    // Filter rules from the registry
    let rules = this.registry.getEnabledRules();

    if (options.categories && options.categories.length > 0) {
      const allowedCategories = new Set(options.categories);
      rules = rules.filter((r) => allowedCategories.has(r.category));
    }

    if (options.includeRules && options.includeRules.length > 0) {
      const includeSet = new Set(options.includeRules);
      rules = rules.filter((r) => includeSet.has(r.id));
    }

    if (options.excludeRules && options.excludeRules.length > 0) {
      const excludeSet = new Set(options.excludeRules);
      rules = rules.filter((r) => !excludeSet.has(r.id));
    }

    let rulesExecuted = 0;

    for (const rule of rules) {
      rulesExecuted++;

      // Page-level evaluation
      if (rule.scope === 'page') {
        try {
          const ruleFindings = await rule.validate({
            detection,
            allTools: detection.tools,
          });
          if (Array.isArray(ruleFindings)) {
            findings.push(...ruleFindings);
          }
        } catch (err: any) {
          findings.push({
            ruleId: rule.id,
            title: `Error executing rule ${rule.id}`,
            message: `Rule execution threw an exception: ${err instanceof Error ? err.message : String(err)}`,
            severity: 'error',
            category: rule.category,
            suggestion: 'Inspect the custom rule implementation or report an issue.',
          });
        }
      } else {
        // Tool-level evaluation
        for (const tool of detection.tools) {
          try {
            const ruleFindings = await rule.validate({
              detection,
              tool,
              allTools: detection.tools,
            });
            if (Array.isArray(ruleFindings)) {
              findings.push(...ruleFindings);
            }
          } catch (err: any) {
            findings.push({
              ruleId: rule.id,
              title: `Error executing rule ${rule.id} on tool ${tool.name}`,
              message: `Rule execution threw an exception: ${err instanceof Error ? err.message : String(err)}`,
              severity: 'error',
              category: rule.category,
              toolName: tool.name,
              suggestion: 'Inspect the rule implementation or report an issue.',
            });
          }
        }
      }
    }

    // Apply severity overrides
    for (const finding of findings) {
      if (options.severityOverrides && options.severityOverrides[finding.ruleId]) {
        finding.severity = options.severityOverrides[finding.ruleId]!;
      }
    }

    // Filter by minSeverity if configured
    let filteredFindings = findings;
    if (options.minSeverity) {
      const minLevel = SEVERITY_LEVELS[options.minSeverity];
      filteredFindings = findings.filter((f) => SEVERITY_LEVELS[f.severity] >= minLevel);
    }

    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const f of filteredFindings) {
      if (f.severity === 'error') errorCount++;
      else if (f.severity === 'warning') warningCount++;
      else if (f.severity === 'info') infoCount++;
    }

    return {
      url: detection.url,
      findings: filteredFindings,
      errorCount,
      warningCount,
      infoCount,
      rulesExecuted,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Convenience helper to lint a detection result with the default registry.
 */
export async function lintWebMCP(
  detection: WebMCPDetectionResult,
  options?: LinterOptions
): Promise<LintResult> {
  const linter = new WebMCPLinter();
  return linter.lint(detection, options);
}
