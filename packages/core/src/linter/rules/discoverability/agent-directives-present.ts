import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

export const agentDirectivesPresentRule: LintRule = {
  id: 'DISC-002',
  title: 'Agent Directives (llms.txt & robots.txt)',
  description: 'Audits presence of /llms.txt and verifies robots.txt allows common AI crawlers to discover tools.',
  category: 'discoverability',
  defaultSeverity: 'warning',
  penaltyPoints: 5,
  scope: 'page',
  docsUrl: 'https://llmstxt.org/',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const directives = context.detection.agentDirectives;
    const hasLlmsTxt = context.detection.hasLlmsTxt || directives?.hasLlmsTxt;

    if (!hasLlmsTxt) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: 'No /llms.txt file found on host.',
        severity: 'info',
        category: this.category,
        suggestion:
          'Create an /llms.txt file at the domain root adhering to the llmstxt.org standard to guide LLMs and automated agents.',
        docsUrl: this.docsUrl,
      });
    }

    if (directives?.hasRobotsTxt && directives.aiCrawlersAllowed === false) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: 'robots.txt appears to restrict or block AI crawler user agents.',
        severity: 'warning',
        category: this.category,
        suggestion:
          'Review robots.txt to ensure legitimate AI agent crawlers (e.g. GPTBot, ClaudeBot, PerplexityBot) are permitted if public tool use is intended.',
        docsUrl: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro',
      });
    }

    return findings;
  },
};
