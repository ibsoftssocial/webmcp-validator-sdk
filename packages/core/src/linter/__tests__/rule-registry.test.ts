import { describe, it, expect, beforeEach } from 'vitest';
import { RuleRegistry } from '../rule-registry.js';
import { LintRule } from '../../types/index.js';

describe('RuleRegistry (Day 6)', () => {
  let registry: RuleRegistry;

  const dummyRule1: LintRule = {
    id: 'TEST-001',
    title: 'Test Rule 1',
    description: 'First test rule',
    category: 'tool-quality',
    defaultSeverity: 'warning',
    penaltyPoints: 5,
    validate: () => [],
  };

  const dummyRule2: LintRule = {
    id: 'TEST-002',
    title: 'Test Rule 2',
    description: 'Second test rule',
    category: 'security',
    defaultSeverity: 'error',
    penaltyPoints: 10,
    validate: () => [],
  };

  beforeEach(() => {
    registry = new RuleRegistry();
  });

  it('registers and retrieves rules by ID', () => {
    registry.register(dummyRule1);
    expect(registry.count).toBe(1);
    expect(registry.hasRule('TEST-001')).toBe(true);
    expect(registry.getRule('TEST-001')).toEqual(dummyRule1);
  });

  it('registers multiple rules with registerAll', () => {
    registry.registerAll([dummyRule1, dummyRule2]);
    expect(registry.count).toBe(2);
    expect(registry.getAllRules()).toHaveLength(2);
  });

  it('manages enabled/disabled states', () => {
    registry.registerAll([dummyRule1, dummyRule2]);

    expect(registry.isRuleEnabled('TEST-001')).toBe(true);
    registry.disableRule('TEST-001');
    expect(registry.isRuleEnabled('TEST-001')).toBe(false);
    expect(registry.getEnabledRules()).toHaveLength(1);
    expect(registry.getEnabledRules()[0]!.id).toBe('TEST-002');

    registry.enableRule('TEST-001');
    expect(registry.isRuleEnabled('TEST-001')).toBe(true);
    expect(registry.getEnabledRules()).toHaveLength(2);
  });

  it('filters rules by category', () => {
    registry.registerAll([dummyRule1, dummyRule2]);
    const qualityRules = registry.getRulesByCategory('tool-quality');
    expect(qualityRules).toHaveLength(1);
    expect(qualityRules[0]!.id).toBe('TEST-001');

    const secRules = registry.getRulesByCategory('security');
    expect(secRules).toHaveLength(1);
    expect(secRules[0]!.id).toBe('TEST-002');
  });

  it('filters rules by minimum severity', () => {
    registry.registerAll([dummyRule1, dummyRule2]);

    const errorRules = registry.getRules({ minSeverity: 'error' });
    expect(errorRules).toHaveLength(1);
    expect(errorRules[0]!.id).toBe('TEST-002');

    const warnRules = registry.getRules({ minSeverity: 'warning' });
    expect(warnRules).toHaveLength(2);
  });

  it('handles severity overrides', () => {
    registry.register(dummyRule1);
    expect(registry.getEffectiveSeverity('TEST-001')).toBe('warning');

    registry.setSeverityOverride('TEST-001', 'error');
    expect(registry.getEffectiveSeverity('TEST-001')).toBe('error');
  });

  it('unregisters rules cleanly', () => {
    registry.registerAll([dummyRule1, dummyRule2]);
    expect(registry.unregister('TEST-001')).toBe(true);
    expect(registry.hasRule('TEST-001')).toBe(false);
    expect(registry.count).toBe(1);
  });

  it('clears all rules', () => {
    registry.registerAll([dummyRule1, dummyRule2]);
    registry.clear();
    expect(registry.count).toBe(0);
    expect(registry.getAllRules()).toHaveLength(0);
  });
});
