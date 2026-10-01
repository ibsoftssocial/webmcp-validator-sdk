import { describe, it, expect } from 'vitest';
import { WebMCPLinter, lintWebMCP } from '../linter.js';
import { RuleRegistry } from '../rule-registry.js';
import { DiscoveredTool, LintRule, WebMCPDetectionResult } from '../../types/index.js';

function createMockDetection(tools: DiscoveredTool[] = []): WebMCPDetectionResult {
  return {
    url: 'https://example.com',
    scannedAt: Date.now(),
    durationMs: 150,
    hasNavigatorModelContext: true,
    imperativeDetected: true,
    declarativeDetected: false,
    hasLlmsTxt: true,
    tools,
    scanErrors: [],
  };
}

describe('WebMCPLinter Engine (Day 6)', () => {
  it('executes default rules and returns a structured LintResult', async () => {
    const validTool: DiscoveredTool = {
      name: 'search_catalog',
      description: 'Search store catalog by keyword and category filters',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords' },
        },
        required: ['query'],
      },
      annotations: {
        readOnlyHint: true,
      },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([validTool]);
    const linter = new WebMCPLinter();
    const result = await linter.lint(detection);

    expect(result.url).toBe(detection.url);
    expect(result.rulesExecuted).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // Tool is high quality, so 0 error findings on tool
    const toolErrors = result.findings.filter((f) => f.severity === 'error' && f.toolName === 'search_catalog');
    expect(toolErrors).toHaveLength(0);
  });

  it('detects multiple violations on malformed tools', async () => {
    const badTool: DiscoveredTool = {
      name: 'badToolName!',
      description: '', // missing description
      inputSchema: {
        type: 'string' as any, // invalid schema type
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: true, // conflict
      },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([badTool]);
    const result = await lintWebMCP(detection);

    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.ruleId === 'TQ-001')).toBe(true); // Name format
    expect(result.findings.some((f) => f.ruleId === 'TQ-002')).toBe(true); // Description required
    expect(result.findings.some((f) => f.ruleId === 'BP-001')).toBe(true); // Input schema valid
    expect(result.findings.some((f) => f.ruleId === 'SEC-002')).toBe(true); // Conflicting hints
  });

  it('filters rules by includeRules', async () => {
    const badTool: DiscoveredTool = {
      name: 'badToolName!',
      description: '',
      inputSchema: { type: 'object' },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([badTool]);
    const result = await lintWebMCP(detection, {
      includeRules: ['TQ-001'],
    });

    expect(result.rulesExecuted).toBe(1);
    expect(result.findings.every((f) => f.ruleId === 'TQ-001')).toBe(true);
  });

  it('filters rules by excludeRules', async () => {
    const badTool: DiscoveredTool = {
      name: 'badToolName!',
      description: '',
      inputSchema: { type: 'object' },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([badTool]);
    const result = await lintWebMCP(detection, {
      excludeRules: ['TQ-001'],
    });

    expect(result.findings.some((f) => f.ruleId === 'TQ-001')).toBe(false);
  });

  it('filters by category', async () => {
    const badTool: DiscoveredTool = {
      name: 'badToolName!',
      description: '',
      inputSchema: { type: 'object' },
      annotations: { readOnlyHint: true, destructiveHint: true },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([badTool]);
    const result = await lintWebMCP(detection, {
      categories: ['security'],
    });

    expect(result.findings.every((f) => f.category === 'security')).toBe(true);
  });

  it('filters by minSeverity', async () => {
    const badTool: DiscoveredTool = {
      name: 'camelCaseTool',
      description: 'Short desc', // warning
      inputSchema: { type: 'object' },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([badTool]);
    const result = await lintWebMCP(detection, {
      minSeverity: 'error',
    });

    expect(result.findings.every((f) => f.severity === 'error')).toBe(true);
  });

  it('applies severityOverrides', async () => {
    const badTool: DiscoveredTool = {
      name: 'invalid name!',
      description: 'A tool with a valid description for testing',
      inputSchema: { type: 'object' },
      source: 'imperative',
      discoveredAt: Date.now(),
    };

    const detection = createMockDetection([badTool]);
    const result = await lintWebMCP(detection, {
      includeRules: ['TQ-001'],
      severityOverrides: {
        'TQ-001': 'info',
      },
    });

    const tqFinding = result.findings.find((f) => f.ruleId === 'TQ-001');
    expect(tqFinding?.severity).toBe('info');
    expect(result.infoCount).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it('isolates errors if a custom rule throws an exception', async () => {
    const faultyRule: LintRule = {
      id: 'FAULTY-001',
      title: 'Faulty Rule',
      description: 'Always throws',
      category: 'best-practices',
      defaultSeverity: 'warning',
      penaltyPoints: 5,
      scope: 'page',
      validate: () => {
        throw new Error('Explosion in custom validator');
      },
    };

    const customRegistry = new RuleRegistry([faultyRule]);
    const linter = new WebMCPLinter(customRegistry);

    const result = await linter.lint(createMockDetection());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.ruleId).toBe('FAULTY-001');
    expect(result.findings[0]!.message).toContain('Explosion in custom validator');
  });
});
