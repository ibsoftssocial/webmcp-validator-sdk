import { describe, it, expect } from 'vitest';
import {
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
} from '../rules/index.js';
import { DiscoveredTool, WebMCPDetectionResult } from '../../types/index.js';

function createMockDetection(overrides: Partial<WebMCPDetectionResult> = {}): WebMCPDetectionResult {
  return {
    url: 'https://example.com',
    scannedAt: Date.now(),
    durationMs: 100,
    hasNavigatorModelContext: true,
    imperativeDetected: true,
    declarativeDetected: false,
    hasLlmsTxt: true,
    tools: [],
    scanErrors: [],
    ...overrides,
  };
}

function createMockTool(overrides: Partial<DiscoveredTool> = {}): DiscoveredTool {
  return {
    name: 'search_catalog',
    description: 'Search catalog by keyword and category filters',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term query' },
      },
      required: ['query'],
    },
    annotations: {
      readOnlyHint: true,
    },
    source: 'imperative',
    discoveredAt: Date.now(),
    ...overrides,
  };
}

describe('Built-in WebMCP Lint Rules (Day 6)', () => {
  describe('TQ-001: tool-name-format', () => {
    it('passes for valid snake_case tool name', () => {
      const tool = createMockTool({ name: 'search_flights_now' });
      const findings = toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('warns on camelCase or uppercase and suggests snake_case', () => {
      const tool = createMockTool({ name: 'searchFlights' });
      const findings = toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
      expect(findings[0]!.suggestion).toContain('search_flights');
    });

    it('flags names exceeding 64 characters', () => {
      const tool = createMockTool({ name: 'a'.repeat(65) });
      const findings = toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
      expect(findings[0]!.message).toContain('exceeds the maximum length');
    });

    it('flags invalid characters such as spaces or symbols', () => {
      const tool = createMockTool({ name: 'search flights!' });
      const findings = toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });
  });

  describe('TQ-002: tool-description-required', () => {
    it('passes for informative descriptions', () => {
      const tool = createMockTool({ description: 'Look up customer account balance by account ID.' });
      const findings = toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('flags empty descriptions as error', () => {
      const tool = createMockTool({ description: '' });
      const findings = toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });

    it('warns on placeholder descriptions', () => {
      const tool = createMockTool({ description: 'placeholder' });
      const findings = toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
      expect(findings[0]!.message).toContain('placeholder');
    });

    it('warns on brief descriptions under 10 chars', () => {
      const tool = createMockTool({ description: 'Short' });
      const findings = toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
    });
  });

  describe('TQ-003: tool-parameters-described', () => {
    it('passes when all parameters have descriptions', () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number' },
            limit: { type: 'number', description: 'Items per page' },
          },
        },
      });
      const findings = toolParametersDescribedRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('warns when a parameter is missing a description', () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number' },
            limit: { type: 'number' },
          },
        },
      });
      const findings = toolParametersDescribedRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('"limit"');
    });
  });

  describe('BP-001: tool-input-schema-valid', () => {
    it('passes on valid input schema', () => {
      const tool = createMockTool();
      const findings = toolInputSchemaValidRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('flags non-object schema types', () => {
      const tool = createMockTool({ inputSchema: { type: 'string' as any } });
      const findings = toolInputSchemaValidRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });

    it('flags required fields not listed in properties', () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
          required: ['foo', 'bar_ghost'],
        },
      });
      const findings = toolInputSchemaValidRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('"bar_ghost"');
    });
  });

  describe('BP-002: tool-input-schema-empty', () => {
    it('emits info finding when input schema has zero properties', () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
      const findings = toolInputSchemaEmptyRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('info');
    });
  });

  describe('SEC-001: tool-safety-mutating-confirmation', () => {
    it('warns when destructive tool lacks confirmationHint', () => {
      const tool = createMockTool({
        name: 'delete_user_account',
        annotations: {
          destructiveHint: true,
          confirmationHint: false,
        },
      });
      const findings = toolSafetyMutatingConfirmationRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
      expect(findings[0]!.suggestion).toContain('confirmationHint');
    });

    it('passes when destructive tool declares confirmationHint: true', () => {
      const tool = createMockTool({
        name: 'delete_user_account',
        annotations: {
          destructiveHint: true,
          confirmationHint: true,
        },
      });
      const findings = toolSafetyMutatingConfirmationRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('SEC-002: tool-readonly-conflict', () => {
    it('flags conflicting readOnlyHint and destructiveHint', () => {
      const tool = createMockTool({
        annotations: {
          readOnlyHint: true,
          destructiveHint: true,
        },
      });
      const findings = toolReadOnlyConflictRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });
  });

  describe('IMP-001: webmcp-api-presence', () => {
    it('passes when modelContext or tools exist', () => {
      const findings = webmcpApiPresenceRule.validate({
        detection: createMockDetection({ hasNavigatorModelContext: true }),
        allTools: [],
      });
      expect(findings).toHaveLength(0);
    });

    it('errors when no WebMCP API is present', () => {
      const findings = webmcpApiPresenceRule.validate({
        detection: createMockDetection({
          hasNavigatorModelContext: false,
          imperativeDetected: false,
          declarativeDetected: false,
          tools: [],
        }),
        allTools: [],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });
  });

  describe('IMP-002: tool-duplicate-names', () => {
    it('flags duplicate tool names', () => {
      const tool1 = createMockTool({ name: 'fetch_data' });
      const tool2 = createMockTool({ name: 'fetch_data' });
      const findings = toolDuplicateNamesRule.validate({
        detection: createMockDetection(),
        allTools: [tool1, tool2],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('Duplicate tool name "fetch_data"');
    });

    it('passes when all names are distinct', () => {
      const tool1 = createMockTool({ name: 'tool_a' });
      const tool2 = createMockTool({ name: 'tool_b' });
      const findings = toolDuplicateNamesRule.validate({
        detection: createMockDetection(),
        allTools: [tool1, tool2],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('DISC-001: manifest-link-present', () => {
    it('suggests manifest link when missing', () => {
      const findings = manifestLinkPresentRule.validate({
        detection: createMockDetection({
          declarativeMetadata: { manifestLinks: [], helpLinks: [], originTrialTokens: [] },
          manifestDetails: { hasManifest: false, tools: [], errors: [] },
        }),
        allTools: [],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('info');
    });

    it('passes when manifest is linked', () => {
      const findings = manifestLinkPresentRule.validate({
        detection: createMockDetection({
          declarativeMetadata: { manifestLinks: ['/mcp/manifest.json'], helpLinks: [], originTrialTokens: [] },
        }),
        allTools: [],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('DISC-002: agent-directives-present', () => {
    it('suggests llms.txt when missing', () => {
      const findings = agentDirectivesPresentRule.validate({
        detection: createMockDetection({
          hasLlmsTxt: false,
          agentDirectives: {
            hasLlmsTxt: false,
            hasLlmsFullTxt: false,
            hasRobotsTxt: true,
            aiCrawlersAllowed: true,
            errors: [],
          },
        }),
        allTools: [],
      });
      expect(findings.some((f) => f.message.includes('/llms.txt'))).toBe(true);
    });

    it('warns when robots.txt restricts AI crawlers', () => {
      const findings = agentDirectivesPresentRule.validate({
        detection: createMockDetection({
          hasLlmsTxt: true,
          agentDirectives: {
            hasLlmsTxt: true,
            hasLlmsFullTxt: false,
            hasRobotsTxt: true,
            aiCrawlersAllowed: false,
            errors: [],
          },
        }),
        allTools: [],
      });
      expect(findings.some((f) => f.message.includes('robots.txt'))).toBe(true);
      expect(findings.find((f) => f.message.includes('robots.txt'))?.severity).toBe('warning');
    });
  });
});
