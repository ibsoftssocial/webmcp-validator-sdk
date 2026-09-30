import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockServer, startMockServer } from '../mock-server.js';

describe('WebMCP Mock Server (Day 2 Test Harness)', () => {
  let server: MockServer;

  beforeAll(async () => {
    // Start on a dynamic OS-assigned port
    server = await startMockServer({ port: 0 });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('binds to a valid dynamic port and reports running state', () => {
    expect(server.isRunning).toBe(true);
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('serves perfect-webmcp.html with text/html and registered tools', async () => {
    const res = await fetch(server.getUrl('/perfect'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('Acme Store — Perfect WebMCP Implementation');
    expect(html).toContain('search_catalog');
    expect(html).toContain('add_to_cart');
    expect(html).toContain('checkout_order');
    expect(html).toContain('navigator.modelContext');
  });

  it('serves malformed-webmcp.html containing intentional linter violations', async () => {
    const res = await fetch(server.getUrl('/malformed'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('Bad Tool Name!');
    expect(html).toContain('broken_params');
    expect(html).toContain('delete_all_user_data');
  });

  it('serves declarative-webmcp.html with declarative meta and link tags', async () => {
    const res = await fetch(server.getUrl('/declarative'));
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('<meta name="webmcp-version" content="1.0">');
    expect(html).toContain('<link rel="model-context" type="application/json" href="/mcp/manifest.json">');
  });

  it('serves legacy-site.html with zero WebMCP indicators', async () => {
    const res = await fetch(server.getUrl('/legacy'));
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('Legacy Classic Website');
    expect(html).not.toContain('navigator.modelContext');
    expect(html).not.toContain('model-context');
  });

  it('serves delayed-spa.html with hydration status elements', async () => {
    const res = await fetch(server.getUrl('/delayed'));
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('Delayed SPA Hydration Demo');
    expect(html).toContain('spa_search');
  });

  it('serves llms.txt as plain text markdown', async () => {
    const res = await fetch(server.getUrl('/llms.txt'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');

    const text = await res.text();
    expect(text).toContain('# Acme Store — WebMCP Agent Information');
    expect(text).toContain('search_catalog');
  });

  it('serves .well-known/mcp.json as valid JSON manifest', async () => {
    const res = await fetch(server.getUrl('/.well-known/mcp.json'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data.name).toBe('Acme Store WebMCP Declarative Service');
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools[0].name).toBe('search_catalog');
  });

  it('returns 404 for unmapped routes', async () => {
    const res = await fetch(server.getUrl('/non-existent-page'));
    expect(res.status).toBe(404);
  });
});
