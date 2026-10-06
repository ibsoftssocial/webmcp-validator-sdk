import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';
import { TOOL_NAME_REGEX, TOOL_NAME_MAX_LENGTH } from '../../../constants/index.js';

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s.]+/g, '_')
    .toLowerCase();
}

export const toolNameFormatRule: LintRule = {
  id: 'TQ-001',
  title: 'Tool Name Format',
  description: 'Tool names must follow standard naming conventions: lowercase, alphanumeric, underscores/hyphens/dots, 1-64 chars.',
  category: 'tool-quality',
  defaultSeverity: 'error',
  penaltyPoints: 10,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/tools.md#naming',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool) return findings;

    const name = tool.name;

    // Check length
    if (name.length > TOOL_NAME_MAX_LENGTH) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool name "${name}" exceeds the maximum length of ${TOOL_NAME_MAX_LENGTH} characters (${name.length} chars).`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: name,
        suggestion: `Shorten the tool name to under ${TOOL_NAME_MAX_LENGTH} characters while preserving its meaning.`,
        docsUrl: this.docsUrl,
      });
      return findings;
    }

    // Check illegal characters (spaces, symbols, invalid start)
    if (/[^a-zA-Z0-9_.-]/.test(name) || !/^[a-zA-Z]/.test(name)) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool name "${name}" contains invalid characters. Names must start with a letter and contain only alphanumeric characters, underscores, dashes, or dots.`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: name,
        suggestion: `Use a valid name format matching ${TOOL_NAME_REGEX}.`,
        docsUrl: this.docsUrl,
      });
      return findings;
    }

    // Check uppercase or camelCase
    if (/[A-Z]/.test(name)) {
      const suggested = toSnakeCase(name);
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool name "${name}" contains uppercase or camelCase characters. Standard convention requires lowercase snake_case.`,
        severity: 'warning',
        category: this.category,
        toolName: name,
        suggestion: `Rename "${name}" to "${suggested}".`,
        docsUrl: this.docsUrl,
      });
      return findings;
    }

    return findings;
  },
};
