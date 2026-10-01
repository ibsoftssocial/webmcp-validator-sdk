import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const toolParametersDescribedRule: LintRule = {
  id: 'TQ-003',
  title: 'Tool Parameters Described',
  description: 'Input schema properties should include descriptions explaining each argument to the calling LLM.',
  category: 'tool-quality',
  defaultSeverity: 'warning',
  penaltyPoints: 5,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/tools.md#parameters',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool || !tool.inputSchema || !tool.inputSchema.properties) return findings;

    const properties = tool.inputSchema.properties;
    for (const [propName, propDef] of Object.entries(properties)) {
      const desc = propDef?.description?.trim();
      if (!desc) {
        findings.push({
          ruleId: this.id,
          title: this.title,
          message: `Parameter "${propName}" on tool "${tool.name}" is missing a description.`,
          severity: this.defaultSeverity,
          category: this.category,
          toolName: tool.name,
          suggestion: `Add a description to parameter "${propName}" explaining its format, valid values, and purpose.`,
          docsUrl: this.docsUrl,
        });
      }
    }

    return findings;
  },
};
