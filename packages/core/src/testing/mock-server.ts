import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveDefaultFixturesDir(): string {
  const candidates = [
    path.join(__dirname, 'fixtures'),
    path.resolve(__dirname, '../src/testing/fixtures'),
    path.resolve(__dirname, '../../core/src/testing/fixtures'),
    path.resolve(__dirname, '../../../packages/core/src/testing/fixtures'),
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(__dirname, 'fixtures');
}

const FIXTURES_DIR = resolveDefaultFixturesDir();

export interface MockServerOptions {
  /** Port to listen on (default: 0 for dynamic random OS port) */
  port?: number;
  /** Host to bind to (default: '127.0.0.1') */
  host?: string;
  /** Custom directory containing HTML/JSON fixtures */
  fixturesDir?: string;
}

export interface MockServerInfo {
  port: number;
  host: string;
  url: string;
}

export class MockServer {
  private server: http.Server | null = null;
  private port: number = 0;
  private host: string = '127.0.0.1';
  private fixturesDir: string;
  private _isRunning: boolean = false;
  public mediaRequestsCount: number = 0;

  constructor(options: MockServerOptions = {}) {
    this.port = options.port ?? 0;
    this.host = options.host ?? '127.0.0.1';
    this.fixturesDir = options.fixturesDir ?? FIXTURES_DIR;
  }

  /**
   * Reset tracking counters
   */
  resetCounters(): void {
    this.mediaRequestsCount = 0;
  }

  /**
   * Whether the server is currently listening
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Root URL of the server (e.g., http://127.0.0.1:45678)
   */
  get url(): string {
    if (!this._isRunning) {
      throw new Error('MockServer is not running. Call start() first.');
    }
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Helper to construct full URL for a specific route
   */
  getUrl(routePath: string = ''): string {
    const cleanPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return `${this.url}${cleanPath}`;
  }

  /**
   * Start listening for requests
   */
  async start(): Promise<MockServerInfo> {
    if (this._isRunning) {
      return { port: this.port, host: this.host, url: this.url };
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          this.host = address.address === '::' ? '127.0.0.1' : address.address;
          this._isRunning = true;
          resolve({
            port: this.port,
            host: this.host,
            url: `http://${this.host}:${this.port}`,
          });
        } else {
          reject(new Error('Failed to obtain server address'));
        }
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.server || !this._isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        this._isRunning = false;
        this.server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Internal request router
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    try {
      switch (pathname) {
        case '/':
        case '/perfect':
          await this.serveFile(res, 'perfect-webmcp.html', 'text/html; charset=utf-8');
          break;

        case '/malformed':
          await this.serveFile(res, 'malformed-webmcp.html', 'text/html; charset=utf-8');
          break;

        case '/declarative':
          await this.serveFile(res, 'declarative-webmcp.html', 'text/html; charset=utf-8');
          break;

        case '/legacy':
          await this.serveFile(res, 'legacy-site.html', 'text/html; charset=utf-8');
          break;

        case '/delayed':
          await this.serveFile(res, 'delayed-spa.html', 'text/html; charset=utf-8');
          break;

        case '/llms.txt':
        case '/llms-full.txt':
          await this.serveFile(res, 'llms.txt', 'text/plain; charset=utf-8');
          break;

        case '/.well-known/webmcp':
        case '/.well-known/webmcp.json':
        case '/.well-known/mcp.json':
        case '/mcp/manifest.json':
          await this.serveFile(res, 'mcp-manifest.json', 'application/json; charset=utf-8');
          break;

        case '/sitemap.xml':
          res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
          res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${this.url}/perfect</loc></url><url><loc>${this.url}/declarative</loc></url></urlset>`);
          break;

        case '/robots.txt':
          await this.serveFile(res, 'robots.txt', 'text/plain; charset=utf-8');
          break;

        case '/protected': {
          const cookieHeader = req.headers.cookie || '';
          const authHeader = req.headers.authorization || '';
          const isAuthorized =
            cookieHeader.includes('auth_token=secret_pass') ||
            authHeader.includes('Bearer secret_pass');

          if (isAuthorized) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<!DOCTYPE html>
<html>
<head><title>Protected Admin Portal</title></head>
<body>
  <h1>Protected Area</h1>
  <script>
    if (navigator.modelContext) {
      navigator.modelContext.registerTool({
        name: 'protected_admin_tool',
        description: 'Authorized administrative operation',
        inputSchema: { type: 'object', properties: { action: { type: 'string' } } }
      });
    }
  </script>
</body>
</html>`);
          } else {
            res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('401 Unauthorized: Authentication required');
          }
          break;
        }

        case '/responsive': {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html>
<head><title>Responsive Portal</title></head>
<body>
  <h1>Responsive Device</h1>
  <script>
    const isMobile = window.innerWidth <= 500 || navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('iPhone');
    if (navigator.modelContext) {
      if (isMobile) {
        navigator.modelContext.registerTool({
          name: 'mobile_quick_tool',
          description: 'Mobile optimized tool registration',
          inputSchema: { type: 'object' }
        });
      } else {
        navigator.modelContext.registerTool({
          name: 'desktop_full_tool',
          description: 'Desktop full tool registration',
          inputSchema: { type: 'object' }
        });
      }
    }
  </script>
</body>
</html>`);
          break;
        }

        case '/redirect': {
          res.writeHead(302, { Location: '/perfect' });
          res.end();
          break;
        }

        case '/stealth-check': {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html>
<head><title>Stealth Inspection</title></head>
<body>
  <h1>Stealth Status</h1>
  <script>
    const isWebdriverUndefined = navigator.webdriver === undefined;
    const hasChrome = typeof window.chrome === 'object' && !!window.chrome.runtime;
    if (navigator.modelContext && isWebdriverUndefined && hasChrome) {
      navigator.modelContext.registerTool({
        name: 'stealth_verified_tool',
        description: 'Anti-bot stealth emulation verified',
        inputSchema: { type: 'object' }
      });
    }
  </script>
</body>
</html>`);
          break;
        }

        case '/media-page': {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html>
<head><title>Media Page</title></head>
<body>
  <h1>Media Page</h1>
  <img src="/dummy-image.jpg" alt="Dummy" />
  <script>
    if (navigator.modelContext) {
      navigator.modelContext.registerTool({
        name: 'media_test_tool',
        description: 'Tool registered on media page',
        inputSchema: { type: 'object' }
      });
    }
  </script>
</body>
</html>`);
          break;
        }

        case '/dummy-image.jpg': {
          this.mediaRequestsCount++;
          // Minimal 1x1 transparent GIF
          const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
          res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
          });
          res.end(pixel);
          break;
        }

        default:
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`404 Not Found: ${pathname}`);
          break;
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Internal Server Error: ${(err as Error).message}`);
    }
  }

  private async serveFile(res: ServerResponse, filename: string, contentType: string): Promise<void> {
    const filePath = path.join(this.fixturesDir, filename);
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(content),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(content);
  }
}

/**
 * Convenience helper to start a mock server with default options
 */
export async function startMockServer(options?: MockServerOptions): Promise<MockServer> {
  const server = new MockServer(options);
  await server.start();
  return server;
}
