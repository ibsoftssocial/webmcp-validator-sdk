import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

const GENERIC_PLACEHOLDERS = new Set([
  'test',
  'tool',
  'my tool',
  'does something',
  'placeholder',
  'todo',
  'sample',
  'example',
  'demo',
]);

export const toolDescriptionRequiredRule: LintRule = {
  id: 'TQ-002',
  title: 'Tool Description Required',
  description: 'Tools must provide informative descriptions explaining their behavior and parameters to LLMs.',
  category: 'tool-quality',
  defaultSeverity: 'error',
  penaltyPoints: 10,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/tools.md#descriptions',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool) return findings;

    const desc = tool.description ? tool.description.trim() : '';

    if (!desc) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" is missing a description. AI agents rely on descriptions to determine when and how to invoke this tool.`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: tool.name,
        suggestion: `Add a descriptive explanation of what "${tool.name}" does, what parameters it requires, and what result it produces.`,
        docsUrl: this.docsUrl,
      });
      return findings;
    }

    if (GENERIC_PLACEHOLDERS.has(desc.toLowerCase())) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" has a placeholder description ("${desc}").`,
        severity: 'warning',
        category: this.category,
        toolName: tool.name,
        suggestion: `Replace the placeholder with a clear, specific description of the tool's action.`,
        docsUrl: this.docsUrl,
      });
      return findings;
    }

    if (desc.length < 10) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" has an excessively brief description ("${desc}"). Descriptions under 10 characters lack sufficient context for LLM agents.`,
        severity: 'warning',
        category: this.category,
        toolName: tool.name,
        suggestion: `Expand the description to at least 15-30 characters with context about parameters and results.`,
        docsUrl: this.docsUrl,
      });
    }

    return findings;
  },
};
