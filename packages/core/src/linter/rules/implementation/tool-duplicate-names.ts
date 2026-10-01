import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const toolDuplicateNamesRule: LintRule = {
  id: 'IMP-002',
  title: 'Unique Tool Identifiers',
  description: 'Tool names must be unique within a web page across imperative, declarative, and manifest sources.',
  category: 'implementation',
  defaultSeverity: 'error',
  penaltyPoints: 10,
  scope: 'page',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/tools.md#unique-identifiers',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const counts = new Map<string, number>();

    for (const tool of context.allTools) {
      counts.set(tool.name, (counts.get(tool.name) || 0) + 1);
    }

    for (const [name, count] of counts.entries()) {
      if (count > 1) {
        findings.push({
          ruleId: this.id,
          title: this.title,
          message: `Duplicate tool name "${name}" detected (${count} occurrences across sources).`,
          severity: this.defaultSeverity,
          category: this.category,
          toolName: name,
          suggestion: `Ensure each tool registered on this page has a distinct and unique name.`,
          docsUrl: this.docsUrl,
        });
      }
    }

    return findings;
  },
};
