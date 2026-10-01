import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockServer, startMockServer } from '@webmcp-validator/core';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../dist/index.js');

describe('CLI Integration Tests (Day 5 Flags & Diagnostics)', () => {
  let server: MockServer;

  beforeAll(async () => {
    server = await startMockServer({ port: 0 });
  });

  afterAll(async () => {
    await server.stop();
  });

  it('scans a target website and outputs valid JSON with --format json', async () => {
    const url = server.getUrl('/perfect');
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'scan', url, '--format', 'json']);

    const result = JSON.parse(stdout);
    expect(result.url).toBe(url);
    expect(result.httpStatus).toBe(200);
    expect(result.hasNavigatorModelContext).toBe(true);
    expect(result.tools.length).toBeGreaterThanOrEqual(3);
  });

  it('emulates mobile device and discovers mobile tools with --mobile', async () => {
    const url = server.getUrl('/responsive');
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'scan', url, '--mobile', '--format', 'json']);

    const result = JSON.parse(stdout);
    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t: any) => t.name === 'mobile_quick_tool')).toBe(true);
    expect(result.tools.some((t: any) => t.name === 'desktop_full_tool')).toBe(false);
  });

  it('authenticates with protected endpoints using --cookie', async () => {
    const url = server.getUrl('/protected');
    const { stdout } = await execFileAsync('node', [
      CLI_PATH,
      'scan',
      url,
      '--cookie',
      'auth_token=secret_pass',
      '--format',
      'json',
    ]);

    const result = JSON.parse(stdout);
    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t: any) => t.name === 'protected_admin_tool')).toBe(true);
  });

  it('authenticates with protected endpoints using custom header -H', async () => {
    const url = server.getUrl('/protected');
    const { stdout } = await execFileAsync('node', [
      CLI_PATH,
      'scan',
      url,
      '-H',
      'Authorization: Bearer secret_pass',
      '--format',
      'json',
    ]);

    const result = JSON.parse(stdout);
    expect(result.httpStatus).toBe(200);
    expect(result.tools.some((t: any) => t.name === 'protected_admin_tool')).toBe(true);
  });

  it('tracks redirect chain and resolves final destination with /redirect', async () => {
    const url = server.getUrl('/redirect');
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'scan', url, '--format', 'json']);

    const result = JSON.parse(stdout);
    expect(result.httpStatus).toBe(200);
    expect(result.finalUrl).toContain('/perfect');
    expect(result.redirectChain?.length).toBeGreaterThanOrEqual(1);
    expect(result.redirectChain?.[0]).toContain('/redirect');
  });

  it('renders pretty terminal output with HTTP status and redirect chain', async () => {
    const url = server.getUrl('/redirect');
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'scan', url]);

    expect(stdout).toContain('WebMCP Discovery Results:');
    expect(stdout).toContain('HTTP Status:');
    expect(stdout).toContain('Redirect Chain:');
    expect(stdout).toContain('Discovered Tools:');
    expect(stdout).toContain('Linter Audit Findings:');
  });

  it('attaches lint results to JSON output and respects --no-lint flag', async () => {
    const url = server.getUrl('/perfect');

    // Default: includes lint
    const { stdout: withLint } = await execFileAsync('node', [CLI_PATH, 'scan', url, '--format', 'json']);
    const resWithLint = JSON.parse(withLint);
    expect(resWithLint.lint).toBeDefined();
    expect(resWithLint.lint.rulesExecuted).toBeGreaterThan(0);

    // --no-lint: omits lint
    const { stdout: withoutLint } = await execFileAsync('node', [
      CLI_PATH,
      'scan',
      url,
      '--no-lint',
      '--format',
      'json',
    ]);
    const resWithoutLint = JSON.parse(withoutLint);
    expect(resWithoutLint.lint).toBeUndefined();
  });
});
