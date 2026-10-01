import { LintRule } from '../../types/index.js';

// Tool Quality
import { toolNameFormatRule } from './tool-quality/tool-name-format.js';
import { toolDescriptionRequiredRule } from './tool-quality/tool-description-required.js';
import { toolParametersDescribedRule } from './tool-quality/tool-parameters-described.js';

// Best Practices
import { toolInputSchemaValidRule } from './best-practices/tool-input-schema-valid.js';
import { toolInputSchemaEmptyRule } from './best-practices/tool-input-schema-empty.js';

// Security
import { toolSafetyMutatingConfirmationRule } from './security/tool-safety-mutating-confirmation.js';
import { toolReadOnlyConflictRule } from './security/tool-readonly-conflict.js';

// Implementation
import { webmcpApiPresenceRule } from './implementation/webmcp-api-presence.js';
import { toolDuplicateNamesRule } from './implementation/tool-duplicate-names.js';

// Discoverability
import { manifestLinkPresentRule } from './discoverability/manifest-link-present.js';
import { agentDirectivesPresentRule } from './discoverability/agent-directives-present.js';

export {
  toolNameFormatRule,
  toolDescriptionRequiredRule,
  toolParametersDescribedRule,
  toolInputSchemaValidRule,
  toolInputSchemaEmptyRule,
  toolSafetyMutatingConfirmationRule,
  toolReadOnlyConflictRule,
  webmcpApiPresenceRule,
  toolDuplicateNamesRule,
  manifestLinkPresentRule,
  agentDirectivesPresentRule,
};

/**
 * Array of all built-in WebMCP lint rules across all 5 readiness categories.
 */
export const ALL_BUILTIN_RULES: LintRule[] = [
  // Implementation (Weight 30)
  webmcpApiPresenceRule,
  toolDuplicateNamesRule,

  // Tool Quality (Weight 25)
  toolNameFormatRule,
  toolDescriptionRequiredRule,
  toolParametersDescribedRule,

  // Best Practices (Weight 20)
  toolInputSchemaValidRule,
  toolInputSchemaEmptyRule,

  // Security (Weight 15)
  toolSafetyMutatingConfirmationRule,
  toolReadOnlyConflictRule,

  // Discoverability (Weight 10)
  manifestLinkPresentRule,
  agentDirectivesPresentRule,
];
