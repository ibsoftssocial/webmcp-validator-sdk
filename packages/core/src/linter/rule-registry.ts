import { FindingCategory, FindingSeverity, LintRule } from '../types/index.js';

export interface RuleFilterOptions {
  category?: FindingCategory;
  minSeverity?: FindingSeverity;
  enabledOnly?: boolean;
}

const SEVERITY_LEVELS: Record<FindingSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

/**
 * Registry for managing WebMCP linter rules, their statuses, and metadata.
 */
export class RuleRegistry {
  private rules: Map<string, LintRule> = new Map();
  private enabledRules: Set<string> = new Set();
  private severityOverrides: Map<string, FindingSeverity> = new Map();

  constructor(rules: LintRule[] = []) {
    this.registerAll(rules);
  }

  /**
   * Register a new lint rule. Overwrites existing rule if identical ID.
   */
  register(rule: LintRule): this {
    if (!rule.id || typeof rule.id !== 'string') {
      throw new Error('LintRule must have a valid non-empty string "id".');
    }
    this.rules.set(rule.id, rule);
    this.enabledRules.add(rule.id);
    return this;
  }

  /**
   * Register multiple lint rules at once.
   */
  registerAll(rules: LintRule[]): this {
    for (const rule of rules) {
      this.register(rule);
    }
    return this;
  }

  /**
   * Unregister a rule by ID.
   */
  unregister(ruleId: string): boolean {
    this.enabledRules.delete(ruleId);
    this.severityOverrides.delete(ruleId);
    return this.rules.delete(ruleId);
  }

  /**
   * Retrieve a registered rule by ID.
   */
  getRule(ruleId: string): LintRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Check whether a rule is registered.
   */
  hasRule(ruleId: string): boolean {
    return this.rules.has(ruleId);
  }

  /**
   * Check whether a rule is currently enabled.
   */
  isRuleEnabled(ruleId: string): boolean {
    return this.rules.has(ruleId) && this.enabledRules.has(ruleId);
  }

  /**
   * Enable a registered rule by ID.
   */
  enableRule(ruleId: string): boolean {
    if (this.rules.has(ruleId)) {
      this.enabledRules.add(ruleId);
      return true;
    }
    return false;
  }

  /**
   * Disable a registered rule by ID.
   */
  disableRule(ruleId: string): boolean {
    if (this.rules.has(ruleId)) {
      this.enabledRules.delete(ruleId);
      return true;
    }
    return false;
  }

  /**
   * Set a severity override for a specific rule.
   */
  setSeverityOverride(ruleId: string, severity: FindingSeverity): boolean {
    if (this.rules.has(ruleId)) {
      this.severityOverrides.set(ruleId, severity);
      return true;
    }
    return false;
  }

  /**
   * Get the effective severity of a rule (respecting overrides).
   */
  getEffectiveSeverity(ruleId: string): FindingSeverity | undefined {
    const override = this.severityOverrides.get(ruleId);
    if (override) return override;
    return this.rules.get(ruleId)?.defaultSeverity;
  }

  /**
   * Return all registered rules (both enabled and disabled).
   */
  getAllRules(): LintRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Return only currently enabled rules.
   */
  getEnabledRules(): LintRule[] {
    return this.getAllRules().filter((r) => this.enabledRules.has(r.id));
  }

  /**
   * Query rules matching specific filter options.
   */
  getRules(options: RuleFilterOptions = {}): LintRule[] {
    let result = options.enabledOnly === false ? this.getAllRules() : this.getEnabledRules();

    if (options.category) {
      result = result.filter((r) => r.category === options.category);
    }

    if (options.minSeverity) {
      const minLevel = SEVERITY_LEVELS[options.minSeverity];
      result = result.filter((r) => {
        const severity = this.getEffectiveSeverity(r.id) || r.defaultSeverity;
        return SEVERITY_LEVELS[severity] >= minLevel;
      });
    }

    return result;
  }

  /**
   * Return rules by category.
   */
  getRulesByCategory(category: FindingCategory): LintRule[] {
    return this.getRules({ category });
  }

  /**
   * Total number of registered rules.
   */
  get count(): number {
    return this.rules.size;
  }

  /**
   * Total number of enabled rules.
   */
  get enabledCount(): number {
    return this.enabledRules.size;
  }

  /**
   * Clear all registered rules.
   */
  clear(): void {
    this.rules.clear();
    this.enabledRules.clear();
    this.severityOverrides.clear();
  }
}
