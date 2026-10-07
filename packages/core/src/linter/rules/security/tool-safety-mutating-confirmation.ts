import { LintRule, RuleContext, RuleFinding } from '../../../types/index.js';

const MUTATING_NAME_PREFIXES = /^(delete|remove|cancel|drop|destroy|purge|checkout|pay|order|buy|update|edit|modify|create|send|post|submit|insert|transfer)_/i;

export const toolSafetyMutatingConfirmationRule: LintRule = {
  id: 'SEC-001',
  title: 'Mutating Tool Confirmation Hint',
  description: 'Tools performing state mutation, checkout, or destructive operations should declare consequentialHint: true.',
  category: 'security',
  defaultSeverity: 'warning',
  penaltyPoints: 8,
  scope: 'tool',
  docsUrl: 'https://github.com/webmachinelearning/webmcp/blob/main/spec/security.md#confirmation-hints',

  validate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const tool = context.tool;
    if (!tool) return findings;

    const ann = tool.annotations || {};
    const isDestructive = ann.destructiveHint === true;
    const isExplicitlyMutating = ann.readOnlyHint === false;
    const hasMutatingName = MUTATING_NAME_PREFIXES.test(tool.name);

    const requiresConfirmation = isDestructive || (isExplicitlyMutating && hasMutatingName) || hasMutatingName;

    const hasConfirmationOrConsequential = ann.consequentialHint === true || ann.confirmationHint === true;

    if (requiresConfirmation && !hasConfirmationOrConsequential) {
      findings.push({
        ruleId: this.id,
        title: this.title,
        message: `Tool "${tool.name}" appears to perform mutating or state-changing actions, but does not specify "consequentialHint: true".`,
        severity: this.defaultSeverity,
        category: this.category,
        toolName: tool.name,
        suggestion: `Add "annotations: { consequentialHint: true }" so AI agents will request user confirmation before executing "${tool.name}".`,
        docsUrl: this.docsUrl,
      });
    }

    return findings;
  },
};
