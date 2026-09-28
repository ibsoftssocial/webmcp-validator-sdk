import { describe, it, expect } from 'vitest';
import {
  ToolDefinitionSchema,
  ToolAnnotationsSchema,
  FindingCategorySchema,
  WebMCPReadinessReportSchema,
  CATEGORY_WEIGHTS,
  TOOL_NAME_REGEX,
} from '../../index.js';

describe('WebMCP Core Types & Schemas', () => {
  it('validates a valid ToolDefinition', () => {
    const validTool = {
      name: 'search_products',
      description: 'Search catalog by keyword and category',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' },
          limit: { type: 'number', default: 10 },
        },
        required: ['query'],
      },
      annotations: {
        readOnlyHint: true,
      },
    };

    const parsed = ToolDefinitionSchema.safeParse(validTool);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid tool name', () => {
    const invalidTool = {
      name: 'INVALID NAME WITH SPACES',
      description: 'Test description',
      inputSchema: {
        type: 'object',
      },
    };

    expect(TOOL_NAME_REGEX.test(invalidTool.name)).toBe(false);
  });

  it('validates tool annotations', () => {
    const annotations = {
      destructiveHint: true,
      confirmationHint: true,
      title: 'Delete user account',
    };

    const parsed = ToolAnnotationsSchema.safeParse(annotations);
    expect(parsed.success).toBe(true);
  });

  it('validates category weights sum to 100', () => {
    const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(totalWeight).toBe(100);
  });

  it('validates a full WebMCPReadinessReport schema structure', () => {
    const report = {
      url: 'https://example.com',
      timestamp: Date.now(),
      overallScore: 87,
      grade: 'B',
      passed: true,
      categories: {
        'implementation': {
          category: 'implementation',
          score: 90,
          weight: 30,
          weightedScore: 27,
          findingsCount: { errors: 0, warnings: 1, info: 0 },
        },
        'tool-quality': {
          category: 'tool-quality',
          score: 85,
          weight: 25,
          weightedScore: 21.25,
          findingsCount: { errors: 0, warnings: 2, info: 0 },
        },
        'best-practices': {
          category: 'best-practices',
          score: 95,
          weight: 20,
          weightedScore: 19,
          findingsCount: { errors: 0, warnings: 0, info: 1 },
        },
        'security': {
          category: 'security',
          score: 80,
          weight: 15,
          weightedScore: 12,
          findingsCount: { errors: 0, warnings: 1, info: 0 },
        },
        'discoverability': {
          category: 'discoverability',
          score: 80,
          weight: 10,
          weightedScore: 8,
          findingsCount: { errors: 0, warnings: 1, info: 0 },
        },
      },
      tools: [
        {
          name: 'get_status',
          description: 'Get service status',
          inputSchema: { type: 'object' },
          source: 'imperative',
          discoveredAt: Date.now(),
        },
      ],
      toolCount: 1,
      findings: [
        {
          ruleId: 'TQ-001',
          title: 'Missing description',
          message: 'Parameter has no description',
          severity: 'warning',
          category: 'tool-quality',
        },
      ],
      summary: {
        totalFindings: 1,
        errorCount: 0,
        warningCount: 1,
        infoCount: 0,
        hasNavigatorModelContext: true,
        hasLlmsTxt: true,
      },
    };

    const parsed = WebMCPReadinessReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
  });
});
