import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockServer, startMockServer } from '../../testing/mock-server.js';
import { PlaywrightScanner } from '../playwright-scanner.js';

describe('Scanner Hardening & Network Edge Cases (Day 5)', () => {
  let server: MockServer;
  let scanner: PlaywrightScanner;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
    scanner = new PlaywrightScanner({
      headless: true,
      persistentBrowser: true,
      defaultTimeoutMs: 10000,
    });
  });

  afterAll(async () => {
    await scanner.close();
    await server.stop();
  });

  it('evades anti-bot bot-detection scripts (navigator.webdriver and window.chrome)', async () => {
    const url = server.getUrl('/stealth-check');
    const result = await scanner.scan({
      url,
      stealth: true,
    });

    expect(result.httpStatus).toBe(200);
    expect(result.imperativeDetected).toBe(true);
    expect(result.tools.some((t) => t.name === 'stealth_verified_tool')).toBe(true);
  });

  it('emulates mobile device viewport and user-agent when isMobile is true', async () => {
    const url = server.getUrl('/responsive');
    const result = await scanner.scan({
      url,
      isMobile: true,
    });

    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t) => t.name === 'mobile_quick_tool')).toBe(true);
    expect(result.tools.some((t) => t.name === 'desktop_full_tool')).toBe(false);
  });

  it('defaults to desktop viewport when isMobile is false or omitted', async () => {
    const url = server.getUrl('/responsive');
    const result = await scanner.scan({
      url,
      isMobile: false,
    });

    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t) => t.name === 'desktop_full_tool')).toBe(true);
    expect(result.tools.some((t) => t.name === 'mobile_quick_tool')).toBe(false);
  });

  it('enforces authentication with 401 when cookies or auth headers are missing', async () => {
    const url = server.getUrl('/protected');
    const result = await scanner.scan({
      url,
    });

    expect(result.httpStatus).toBe(401);
    expect(result.tools.length).toBe(0);
    expect(result.scanErrors.some((e) => e.includes('Received HTTP 401'))).toBe(true);
  });

  it('successfully scans protected endpoints when cookie string is provided', async () => {
    const url = server.getUrl('/protected');
    const result = await scanner.scan({
      url,
      cookies: 'auth_token=secret_pass; user_tier=admin',
    });

    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t) => t.name === 'protected_admin_tool')).toBe(true);
  });

  it('successfully scans protected endpoints when structured cookie array is provided', async () => {
    const url = server.getUrl('/protected');
    const result = await scanner.scan({
      url,
      cookies: [{ name: 'auth_token', value: 'secret_pass' }],
    });

    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t) => t.name === 'protected_admin_tool')).toBe(true);
  });

  it('successfully scans protected endpoints when custom HTTP Authorization header is provided', async () => {
    const url = server.getUrl('/protected');
    const result = await scanner.scan({
      url,
      headers: {
        Authorization: 'Bearer secret_pass',
      },
    });

    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t) => t.name === 'protected_admin_tool')).toBe(true);
  });

  it('follows HTTP 302 redirects, captures redirectChain, and resolves finalUrl', async () => {
    const url = server.getUrl('/redirect');
    const result = await scanner.scan({
      url,
    });

    expect(result.httpStatus).toBe(200);
    expect(result.finalUrl).toContain('/perfect');
    expect(result.redirectChain).toBeDefined();
    expect(result.redirectChain?.length).toBeGreaterThanOrEqual(1);
    expect(result.redirectChain?.[0]).toContain('/redirect');
    // Tools from the redirected destination /perfect should be discovered (3 imperative + 1 manifest)
    expect(result.tools.length).toBe(4);
    expect(result.tools.some((t) => t.name === 'search_catalog')).toBe(true);
  });

  it('intercepts and aborts heavy media resources when blockMedia is enabled', async () => {
    server.resetCounters();
    const url = server.getUrl('/media-page');

    const result = await scanner.scan({
      url,
      blockMedia: true,
    });

    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t) => t.name === 'media_test_tool')).toBe(true);
    // The server should receive 0 requests for /dummy-image.jpg because Playwright aborted it
    expect(server.mediaRequestsCount).toBe(0);
  });

  it('captures HTTP 404 status and logs diagnostic error without crashing', async () => {
    const url = server.getUrl('/non-existent-page-404');
    const result = await scanner.scan({
      url,
    });

    expect(result.httpStatus).toBe(404);
    expect(result.scanErrors.some((e) => e.includes('Received HTTP 404'))).toBe(true);
  });
});
