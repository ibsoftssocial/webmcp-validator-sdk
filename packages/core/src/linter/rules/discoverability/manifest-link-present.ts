import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const manifestLinkPresentRule: LintRule = {
  id: 'DISC-001',
  title: 'Declarative Manifest Link',
  description: 'Audits whether the page links an MCP manifest via <link rel="model-context"> for static agent discovery.',
  category: 'discoverability',
  defaultSeverity: 'info',
  penaltyPoints: 4,
  scope: 'page',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/discovery.md#manifest-linking',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const detection = context.detection;

    const hasManifestLink = (detection.declarativeMetadata?.manifestLinks || []).length > 0;
    const hasDiscoveredManifest = detection.manifestDetails?.hasManifest === true;

    if (!hasManifestLink && !hasDiscoveredManifest) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: 'No declarative MCP manifest link found in HTML.',
        severity: this.defaultSeverity,
        category: this.category,
        suggestion:
          'Add a <link rel="model-context" type="application/json" href="/.well-known/mcp.json"> tag to <head> to enable static tool discovery without executing JavaScript.',
        docsUrl: this.docsUrl,
      });
    }

    return findings;
  },
};
