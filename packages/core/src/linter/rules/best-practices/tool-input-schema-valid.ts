import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const toolInputSchemaValidRule: LintRule = {
  id: 'BP-001',
  title: 'Valid Input Schema',
  description: 'Input schema must be a valid JSON Schema object with type: "object", valid properties, and consistent required fields.',
  category: 'best-practices',
  defaultSeverity: 'error',
  penaltyPoints: 10,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/tools.md#schema',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool) return findings;

    const schema = tool.inputSchema;
    if (!schema) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" is missing an inputSchema object.`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: tool.name,
        suggestion: `Define inputSchema with type: "object" and any expected properties.`,
        docsUrl: this.docsUrl,
      });
      return findings;
    }

    if (schema.type !== 'object') {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" inputSchema.type must be "object", received "${schema.type}".`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: tool.name,
        suggestion: `Change inputSchema.type to "object".`,
        docsUrl: this.docsUrl,
      });
    }

    // Check required array references existing properties
    if (schema.required && Array.isArray(schema.required)) {
      const definedProps = new Set(Object.keys(schema.properties || {}));
      for (const reqField of schema.required) {
        if (!definedProps.has(reqField)) {
          findings.push({
            ruleId: this.id,
            title: this.title,
            message: `Tool "${tool.name}" lists "${reqField}" in required array, but it is not defined in properties.`,
            severity: 'error',
            category: this.category,
            toolName: tool.name,
            suggestion: `Add "${reqField}" definition to inputSchema.properties, or remove it from the required array.`,
            docsUrl: this.docsUrl,
          });
        }
      }
    }

    return findings;
  },
};
