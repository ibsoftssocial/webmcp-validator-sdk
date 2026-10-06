import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const webmcpApiPresenceRule: LintRule = {
  id: 'IMP-001',
  title: 'WebMCP API Presence',
  description: 'Validates that the target site provides a detectable WebMCP implementation (navigator.modelContext, declarative markup, or manifest).',
  category: 'implementation',
  defaultSeverity: 'error',
  penaltyPoints: 100,
  scope: 'page',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/overview.md',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const detection = context.detection;

    const hasImplementation =
      detection.hasNavigatorModelContext ||
      detection.imperativeDetected ||
      detection.declarativeDetected ||
      detection.manifestDetails?.hasManifest ||
      detection.tools.length > 0;

    if (!hasImplementation) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: 'No WebMCP implementation detected on this page.',
        severity: this.defaultSeverity,
        category: this.category,
        suggestion:
          'Implement window.navigator.modelContext.registerTool() or link an MCP manifest via <link rel="model-context" href="/.well-known/mcp.json">.',
        docsUrl: this.docsUrl,
      });
    }

    return findings;
  },
};
