import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PlaywrightScanner, scanUrl } from '../playwright-scanner.js';
import { MockServer, startMockServer } from '../../testing/mock-server.js';

describe('PlaywrightScanner (Day 3 Core Scanner Engine)', () => {
  let server: MockServer;
  let scanner: PlaywrightScanner;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
    scanner = new PlaywrightScanner({ headless: true, persistentBrowser: true });
  });

  afterAll(async () => {
    await scanner.close();
    await server.stop();
  });

  it('scans /perfect and extracts all 3 valid WebMCP tools with schemas', async () => {
    const result = await scanner.scan(server.getUrl('/perfect'));

    expect(result.url).toBe(server.getUrl('/perfect'));
    expect(result.hasNavigatorModelContext).toBe(true);
    expect(result.imperativeDetected).toBe(true);
    expect(result.tools).toHaveLength(3);
    expect(result.scanErrors).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThan(0);

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain('search_catalog');
    expect(toolNames).toContain('add_to_cart');
    expect(toolNames).toContain('checkout_order');

    // Deep check tool details
    const searchTool = result.tools.find((t) => t.name === 'search_catalog')!;
    expect(searchTool.description).toContain('Search store catalog');
    expect(searchTool.inputSchema.type).toBe('object');
    expect(searchTool.inputSchema.required).toContain('query');
    expect(searchTool.annotations?.readOnlyHint).toBe(true);

    const checkoutTool = result.tools.find((t) => t.name === 'checkout_order')!;
    expect(checkoutTool.annotations?.destructiveHint).toBe(true);
    expect(checkoutTool.annotations?.confirmationHint).toBe(true);
  });

  it('scans /delayed and waits for SPA hydration to detect async tool', async () => {
    const result = await scanner.scan({
      url: server.getUrl('/delayed'),
      hydrationWaitMs: 1500,
    });

    expect(result.hasNavigatorModelContext).toBe(true);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]?.name).toBe('spa_search');
    expect(result.tools[0]?.annotations?.readOnlyHint).toBe(true);
  });

  it('scans /legacy and detects zero WebMCP tools gracefully', async () => {
    const result = await scanner.scan(server.getUrl('/legacy'));

    expect(result.hasNavigatorModelContext).toBe(false);
    expect(result.imperativeDetected).toBe(false);
    expect(result.tools).toHaveLength(0);
    expect(result.scanErrors).toHaveLength(0);
  });

  it('scans /malformed and extracts flawed tools without crashing', async () => {
    const result = await scanner.scan(server.getUrl('/malformed'));

    expect(result.hasNavigatorModelContext).toBe(true);
    expect(result.tools.length).toBeGreaterThanOrEqual(4);

    const names = result.tools.map((t) => t.name);
    expect(names).toContain('Bad Tool Name!');
    expect(names).toContain('broken_params');
  });

  it('handles unreachable network endpoints gracefully without throwing', async () => {
    // Port 1 is reserved and typically unreachable
    const result = await scanUrl('http://127.0.0.1:1/non-existent', {
      defaultTimeoutMs: 2000,
    });

    expect(result.tools).toHaveLength(0);
    expect(result.hasNavigatorModelContext).toBe(false);
    expect(result.scanErrors.length).toBeGreaterThan(0);
    expect(result.scanErrors[0]).toContain('Scanner error');
  });
});
