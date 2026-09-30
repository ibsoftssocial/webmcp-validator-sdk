import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { MockServer, startMockServer } from '../mock-server.js';

describe('WebMCP Browser Smoke Test (Playwright + Fixtures)', () => {
  let server: MockServer;
  let browser: Browser;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) await server.stop();
  });

  it('evaluates registered tools in real Chromium on /perfect', async () => {
    const page = await browser.newPage();
    await page.goto(server.getUrl('/perfect'));

    // Check that navigator.modelContext exists and tools are registered
    const tools = await page.evaluate(() => {
      if (!window.navigator || !('modelContext' in window.navigator)) {
        return [];
      }
      return (window.navigator as any).modelContext.getRegisteredTools();
    });

    expect(tools).toHaveLength(3);
    expect(tools.map((t: any) => t.name)).toEqual([
      'search_catalog',
      'add_to_cart',
      'checkout_order',
    ]);

    // Validate annotations
    const checkoutTool = tools.find((t: any) => t.name === 'checkout_order');
    expect(checkoutTool.annotations.destructiveHint).toBe(true);
    expect(checkoutTool.annotations.confirmationHint).toBe(true);

    await page.close();
  });

  it('waits for delayed SPA tool registration on /delayed', async () => {
    const page = await browser.newPage();
    await page.goto(server.getUrl('/delayed'));

    // Initially, tool might not be registered yet
    // Wait for the tool to register via waitForFunction
    await page.waitForFunction(() => {
      const mc = (window.navigator as any).modelContext;
      return mc && mc.getRegisteredTools().length > 0;
    }, { timeout: 3000 });

    const tools = await page.evaluate(() => {
      return (window.navigator as any).modelContext.getRegisteredTools();
    });

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('spa_search');

    await page.close();
  });

  it('detects zero tools on /legacy', async () => {
    const page = await browser.newPage();
    await page.goto(server.getUrl('/legacy'));

    const hasWebMCP = await page.evaluate(() => {
      return typeof window.navigator !== 'undefined' && 'modelContext' in window.navigator;
    });

    expect(hasWebMCP).toBe(false);
    await page.close();
  });
});
