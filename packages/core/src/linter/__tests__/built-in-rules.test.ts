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
    description: 'Searches catalog by query term and returns products.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product search keyword' },
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
    it('passes for valid snake_case tool name', async () => {
      const tool = createMockTool({ name: 'search_flights_now' });
      const findings = await toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('warns on camelCase or uppercase and suggests snake_case', async () => {
      const tool = createMockTool({ name: 'searchFlights' });
      const findings = await toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
      expect(findings[0]!.suggestion).toContain('search_flights');
    });

    it('flags names exceeding 64 characters', async () => {
      const tool = createMockTool({ name: 'a'.repeat(65) });
      const findings = await toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
      expect(findings[0]!.message).toContain('exceeds the maximum length');
    });

    it('flags invalid characters such as spaces or symbols', async () => {
      const tool = createMockTool({ name: 'search flights!' });
      const findings = await toolNameFormatRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });
  });

  describe('TQ-002: tool-description-required', () => {
    it('passes for informative descriptions', async () => {
      const tool = createMockTool({ description: 'Look up customer account balance by account ID.' });
      const findings = await toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('flags empty descriptions as error', async () => {
      const tool = createMockTool({ description: '' });
      const findings = await toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });

    it('warns on placeholder descriptions', async () => {
      const tool = createMockTool({ description: 'placeholder' });
      const findings = await toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
      expect(findings[0]!.message).toContain('placeholder');
    });

    it('warns on brief descriptions under 10 chars', async () => {
      const tool = createMockTool({ description: 'Short' });
      const findings = await toolDescriptionRequiredRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
    });
  });

  describe('TQ-003: tool-parameters-described', () => {
    it('passes when all parameters have descriptions', async () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number' },
            limit: { type: 'number', description: 'Items per page' },
          },
        },
      });
      const findings = await toolParametersDescribedRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('warns when a parameter is missing a description', async () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Page number' },
            limit: { type: 'number' },
          },
        },
      });
      const findings = await toolParametersDescribedRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('"limit"');
    });
  });

  describe('BP-001: tool-input-schema-valid', () => {
    it('passes on valid input schema', async () => {
      const tool = createMockTool();
      const findings = await toolInputSchemaValidRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });

    it('flags non-object schema types', async () => {
      const tool = createMockTool({ inputSchema: { type: 'string' as any } });
      const findings = await toolInputSchemaValidRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });

    it('flags required fields not listed in properties', async () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
          required: ['foo', 'bar_ghost'],
        },
      });
      const findings = await toolInputSchemaValidRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('"bar_ghost"');
    });
  });

  describe('BP-002: tool-input-schema-empty', () => {
    it('emits info finding when input schema has zero properties', async () => {
      const tool = createMockTool({
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });
      const findings = await toolInputSchemaEmptyRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('info');
    });
  });

  describe('SEC-001: tool-safety-mutating-confirmation', () => {
    it('warns when destructive tool lacks confirmationHint', async () => {
      const tool = createMockTool({
        name: 'delete_user_account',
        annotations: {
          destructiveHint: true,
          confirmationHint: false,
        },
      });
      const findings = await toolSafetyMutatingConfirmationRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('warning');
      expect(findings[0]!.suggestion).toContain('confirmationHint');
    });

    it('passes when destructive tool declares confirmationHint: true', async () => {
      const tool = createMockTool({
        name: 'delete_user_account',
        annotations: {
          destructiveHint: true,
          confirmationHint: true,
        },
      });
      const findings = await toolSafetyMutatingConfirmationRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('SEC-002: tool-readonly-conflict', () => {
    it('flags conflicting readOnlyHint and destructiveHint', async () => {
      const tool = createMockTool({
        annotations: {
          readOnlyHint: true,
          destructiveHint: true,
        },
      });
      const findings = await toolReadOnlyConflictRule.validate({
        detection: createMockDetection(),
        tool,
        allTools: [tool],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('error');
    });
  });

  describe('IMP-001: webmcp-api-presence', () => {
    it('passes when modelContext or tools exist', async () => {
      const findings = await webmcpApiPresenceRule.validate({
        detection: createMockDetection({ hasNavigatorModelContext: true }),
        allTools: [],
      });
      expect(findings).toHaveLength(0);
    });

    it('errors when no WebMCP API is present', async () => {
      const findings = await webmcpApiPresenceRule.validate({
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
    it('flags duplicate tool names', async () => {
      const tool1 = createMockTool({ name: 'fetch_data' });
      const tool2 = createMockTool({ name: 'fetch_data' });
      const findings = await toolDuplicateNamesRule.validate({
        detection: createMockDetection(),
        allTools: [tool1, tool2],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.message).toContain('Duplicate tool name "fetch_data"');
    });

    it('passes when all names are distinct', async () => {
      const tool1 = createMockTool({ name: 'tool_a' });
      const tool2 = createMockTool({ name: 'tool_b' });
      const findings = await toolDuplicateNamesRule.validate({
        detection: createMockDetection(),
        allTools: [tool1, tool2],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('DISC-001: manifest-link-present', () => {
    it('suggests manifest link when missing', async () => {
      const findings = await manifestLinkPresentRule.validate({
        detection: createMockDetection({
          declarativeMetadata: { manifestLinks: [], helpLinks: [], originTrialTokens: [] },
          manifestDetails: { hasManifest: false, tools: [], errors: [] },
        }),
        allTools: [],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]!.severity).toBe('info');
    });

    it('passes when manifest is linked', async () => {
      const findings = await manifestLinkPresentRule.validate({
        detection: createMockDetection({
          declarativeMetadata: { manifestLinks: ['/mcp/manifest.json'], helpLinks: [], originTrialTokens: [] },
        }),
        allTools: [],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('DISC-002: agent-directives-present', () => {
    it('suggests llms.txt when missing', async () => {
      const findings = await agentDirectivesPresentRule.validate({
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

    it('warns when robots.txt restricts AI crawlers', async () => {
      const findings = await agentDirectivesPresentRule.validate({
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
