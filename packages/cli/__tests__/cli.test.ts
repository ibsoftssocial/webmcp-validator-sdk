import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
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

  it('renders pretty terminal output with WebMCP AI Readiness Score banner and category table', async () => {
    const url = server.getUrl('/perfect');
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'scan', url]);

    expect(stdout).toContain('WebMCP AI Readiness Score:');
    expect(stdout).toContain('Overall Score:');
    expect(stdout).toContain('Pass Threshold:');
    expect(stdout).toContain('Category');
    expect(stdout).toContain('Raw Score');
    expect(stdout).toContain('Weighted');
  });

  it('attaches readiness report to JSON output with overallScore and categories', async () => {
    const url = server.getUrl('/perfect');
    const { stdout } = await execFileAsync('node', [CLI_PATH, 'scan', url, '--format', 'json']);

    const res = JSON.parse(stdout);
    expect(res.readiness).toBeDefined();
    expect(res.readiness.overallScore).toBeGreaterThanOrEqual(90);
    expect(res.readiness.grade).toBe('A');
    expect(res.readiness.passed).toBe(true);
    expect(res.readiness.categories.implementation).toBeDefined();
    expect(res.readiness.categories['tool-quality']).toBeDefined();
  });

  it('enforces --fail-under flag: succeeds when threshold met, exits 1 when score is below threshold', async () => {
    const perfectUrl = server.getUrl('/perfect');
    // Passes threshold 80
    const passResult = await execFileAsync('node', [
      CLI_PATH,
      'scan',
      perfectUrl,
      '--fail-under',
      '80',
      '--format',
      'json',
    ]);
    expect(passResult.stdout).toBeDefined();

    // Fails impossible threshold 100 on /malformed
    const malformedUrl = server.getUrl('/malformed');
    let failed = false;
    try {
      await execFileAsync('node', [
        CLI_PATH,
        'scan',
        malformedUrl,
        '--fail-under',
        '95',
        '--format',
        'json',
      ]);
    } catch (err: any) {
      failed = true;
      expect(err.code).toBe(1);
    }
    expect(failed).toBe(true);
  });

  describe('Day 8 Multi-Format Reporter & File Export (-o, --format)', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webmcp-cli-report-test-'));
    });

    afterAll(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('outputs valid Markdown report with --format markdown', async () => {
      const url = server.getUrl('/perfect');
      const { stdout } = await execFileAsync('node', [
        CLI_PATH,
        'scan',
        url,
        '--format',
        'markdown',
      ]);

      expect(stdout).toContain('# WebMCP AI Readiness Audit Report');
      expect(stdout).toContain('## Executive Summary');
      expect(stdout).toContain('## Category Breakdown');
      expect(stdout).toContain('## Discovered Tools');
      expect(stdout).toContain('### Tool Schemas');
    });

    it('outputs valid self-contained HTML report with --format html', async () => {
      const url = server.getUrl('/perfect');
      const { stdout } = await execFileAsync('node', [
        CLI_PATH,
        'scan',
        url,
        '--format',
        'html',
      ]);

      expect(stdout).toContain('<!DOCTYPE html>');
      expect(stdout).toContain('<html lang="en">');
      expect(stdout).toContain('<style>');
      expect(stdout).toContain('<svg class="gauge-svg"');
      expect(stdout).toContain('Discovered Tools');
      expect(stdout).toContain('</html>');
    });

    it('saves HTML report to disk with -o flag and logs confirmation message in terminal', async () => {
      const url = server.getUrl('/perfect');
      const outPath = path.join(tempDir, 'audit-report.html');

      const { stdout } = await execFileAsync('node', [
        CLI_PATH,
        'scan',
        url,
        '-o',
        outPath,
      ]);

      expect(stdout).toContain('WebMCP AI Readiness Score:');
      expect(stdout).toContain('✔ Audit report saved to');
      expect(stdout).toContain(outPath);

      const exists = await fs.stat(outPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const htmlContent = await fs.readFile(outPath, 'utf8');
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('Discovered Tools');
    });

    it('saves Markdown report to disk when -o file has .md extension', async () => {
      const url = server.getUrl('/perfect');
      const outPath = path.join(tempDir, 'reports', 'audit.md');

      await execFileAsync('node', [CLI_PATH, 'scan', url, '-o', outPath]);

      const exists = await fs.stat(outPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const mdContent = await fs.readFile(outPath, 'utf8');
      expect(mdContent).toContain('# WebMCP AI Readiness Audit Report');
      expect(mdContent).toContain('## Category Breakdown');
    });

    it('saves JSON report to disk when -o file has .json extension', async () => {
      const url = server.getUrl('/perfect');
      const outPath = path.join(tempDir, 'audit.json');

      await execFileAsync('node', [CLI_PATH, 'scan', url, '-o', outPath]);

      const exists = await fs.stat(outPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const jsonContent = await fs.readFile(outPath, 'utf8');
      const parsed = JSON.parse(jsonContent);
      expect(parsed.overallScore).toBeGreaterThanOrEqual(90);
      expect(parsed.grade).toBe('A');
    });
  });
});

