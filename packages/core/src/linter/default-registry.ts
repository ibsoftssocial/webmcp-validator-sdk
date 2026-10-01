import { RuleRegistry } from './rule-registry.js';
import { ALL_BUILTIN_RULES } from './rules/index.js';

let defaultRegistryInstance: RuleRegistry | null = null;

/**
 * Creates a fresh RuleRegistry populated with all standard built-in rules.
 */
export function createDefaultRegistry(): RuleRegistry {
  return new RuleRegistry(ALL_BUILTIN_RULES);
}

/**
 * Returns a shared singleton default RuleRegistry instance.
 */
export function getDefaultRegistry(): RuleRegistry {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = createDefaultRegistry();
  }
  return defaultRegistryInstance;
}
