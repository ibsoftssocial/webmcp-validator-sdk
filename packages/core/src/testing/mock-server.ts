import http, { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

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

  constructor(options: MockServerOptions = {}) {
    this.port = options.port ?? 0;
    this.host = options.host ?? '127.0.0.1';
    this.fixturesDir = options.fixturesDir ?? FIXTURES_DIR;
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

        case '/.well-known/mcp.json':
        case '/mcp/manifest.json':
          await this.serveFile(res, 'mcp-manifest.json', 'application/json; charset=utf-8');
          break;

        case '/robots.txt':
          await this.serveFile(res, 'robots.txt', 'text/plain; charset=utf-8');
          break;

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
