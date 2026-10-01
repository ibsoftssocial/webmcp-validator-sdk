import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const toolInputSchemaEmptyRule: LintRule = {
  id: 'BP-002',
  title: 'Input Schema Parameter Check',
  description: 'Flags tools with empty input schemas to encourage explicit parameter definitions or documentation.',
  category: 'best-practices',
  defaultSeverity: 'info',
  penaltyPoints: 2,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/tools.md#zero-parameter-tools',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool || !tool.inputSchema) return findings;

    const propCount = Object.keys(tool.inputSchema.properties || {}).length;
    if (propCount === 0) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" does not take any input parameters.`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: tool.name,
        suggestion: `If "${tool.name}" genuinely takes no parameters, ensure the description explains how it functions without user input.`,
        docsUrl: this.docsUrl,
      });
    }

    return findings;
  },
};
