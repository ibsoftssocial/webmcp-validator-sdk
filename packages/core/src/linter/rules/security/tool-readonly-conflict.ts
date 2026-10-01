import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const toolReadOnlyConflictRule: LintRule = {
  id: 'SEC-002',
  title: 'Conflicting Safety Annotations',
  description: 'A tool cannot simultaneously declare readOnlyHint: true and destructiveHint: true.',
  category: 'security',
  defaultSeverity: 'error',
  penaltyPoints: 10,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/security.md#mutually-exclusive-hints',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool || !tool.annotations) return findings;

    const { readOnlyHint, destructiveHint } = tool.annotations;

    if (readOnlyHint === true && destructiveHint === true) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" contains contradictory annotations: both "readOnlyHint: true" and "destructiveHint: true" are asserted.`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: tool.name,
        suggestion: `Remove readOnlyHint: true if the tool modifies or deletes data; otherwise remove destructiveHint: true.`,
        docsUrl: this.docsUrl,
      });
    }

    return findings;
  },
};
