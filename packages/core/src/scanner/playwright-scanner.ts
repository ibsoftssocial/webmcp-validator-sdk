import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ScanTargetOptions, WebMCPDetectionResult, DiscoveredTool } from '../types/index.js';
import { evaluatePageWebMCP, normalizeDiscoveredTools } from './page-evaluator.js';
import { runMultiSourceDiscovery } from '../discovery/index.js';

export interface ScannerConfig {
  /** Default timeout in milliseconds for page navigation and evaluation (default: 15000) */
  defaultTimeoutMs?: number;
  /** Whether to run Chromium in headless mode (default: true) */
  headless?: boolean;
  /** Path to a custom Chrome/Chromium binary */
  executablePath?: string;
  /** Whether to keep the browser instance alive between scans for performance */
  persistentBrowser?: boolean;
  /** Default wait time in milliseconds for SPA hydration (default: 1000) */
  defaultHydrationWaitMs?: number;
}

export class PlaywrightScanner {
  private browser: Browser | null = null;
  private config: Required<ScannerConfig>;

  constructor(config: ScannerConfig = {}) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 15000,
      headless: config.headless ?? true,
      executablePath: config.executablePath ?? '',
      persistentBrowser: config.persistentBrowser ?? true,
      defaultHydrationWaitMs: config.defaultHydrationWaitMs ?? 1000,
    };
  }

  /**
   * Lazily initialize or return existing Chromium browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    const launchOptions: any = {
      headless: this.config.headless,
    };

    if (this.config.executablePath) {
      launchOptions.executablePath = this.config.executablePath;
    }

    this.browser = await chromium.launch(launchOptions);
    return this.browser;
  }

  /**
   * Scan a website URL to discover and extract WebMCP implementation details
   */
  async scan(target: string | ScanTargetOptions): Promise<WebMCPDetectionResult> {
    const options: ScanTargetOptions = typeof target === 'string' ? { url: target } : target;
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeoutMs;
    const hydrationWaitMs = options.hydrationWaitMs ?? this.config.defaultHydrationWaitMs;
    const scanErrors: string[] = [];

    let hasNavigatorModelContext = false;
    let tools: DiscoveredTool[] = [];
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();

      // Configure context with custom headers, userAgent, SSL bypass
      context = await browser.newContext({
        ignoreHTTPSErrors: options.ignoreHTTPSErrors ?? true,
        userAgent: options.userAgent,
        extraHTTPHeaders: options.headers,
        isMobile: options.isMobile ?? false,
      });

      // Inject WebMCP Agent Bridge so sites checking document.modelContext or navigator.modelContext can register tools
      await context.addInitScript(() => {
        const win = window as any;
        const globalTools = new Map();

        win.__webmcp_site_invoked_registration = false;
        win.__webmcp_bridge_injected = true;

        const bridge = {
          registerTool(tool: any) {
            win.__webmcp_site_invoked_registration = true;
            if (tool && tool.name) {
              globalTools.set(tool.name, tool);
            }
          },
          unregisterTool(name: string) {
            globalTools.delete(name);
          },
          getRegisteredTools() {
            return Array.from(globalTools.values());
          },
        };

        try {
          const doc = typeof document !== 'undefined' ? (document as any) : null;
          if (doc && !doc.modelContext) {
            Object.defineProperty(doc, 'modelContext', {
              value: bridge,
              writable: true,
              configurable: true,
            });
          }
        } catch {}

        try {
          const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
          if (nav && !nav.modelContext) {
            Object.defineProperty(nav, 'modelContext', {
              value: bridge,
              writable: true,
              configurable: true,
            });
          }
        } catch {}
      });

      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // Navigate to the target page
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      // Wait for SPA hydration: wait for registered tools in navigator or document modelContext
      try {
        await page.waitForFunction(
          () => {
            const win = window as any;
            const navTools = win.navigator?.modelContext?.getRegisteredTools?.();
            const docTools = win.document?.modelContext?.getRegisteredTools?.();
            const total = (Array.isArray(navTools) ? navTools.length : 0) + (Array.isArray(docTools) ? docTools.length : 0);
            return total > 0;
          },
          undefined,
          { timeout: hydrationWaitMs }
        );
      } catch {
        // Hydration timeout is normal for non-WebMCP or static pages; continue to evaluate
      }

      // Safely evaluate WebMCP inside the browser context
      const evalResult = await page.evaluate(evaluatePageWebMCP);

      hasNavigatorModelContext = evalResult.hasNavigatorModelContext;
      if (evalResult.rawTools.length > 0) {
        tools = normalizeDiscoveredTools(evalResult.rawTools, options.url);
      }

      // Execute Multi-Source Discovery: Declarative tags, MCP Manifests, and Agent Directives
      const multiSource = await runMultiSourceDiscovery({
        pageUrl: options.url,
        inPageDeclarative: evalResult?.declarative,
        imperativeTools: tools,
        probeWellKnown: options.probeWellKnown,
        timeoutMs: Math.min(timeoutMs, 5000),
      });

      tools = multiSource.tools;
      if (multiSource.errors.length > 0) {
        scanErrors.push(...multiSource.errors);
      }

      return {
        url: options.url,
        scannedAt: startTime,
        durationMs: Date.now() - startTime,
        hasNavigatorModelContext,
        imperativeDetected: multiSource.imperativeDetected,
        declarativeDetected: multiSource.declarativeDetected,
        hasLlmsTxt: multiSource.hasLlmsTxt,
        llmsTxtContent: multiSource.llmsTxtContent,
        tools: multiSource.tools,
        declarativeMetadata: multiSource.declarativeMetadata,
        manifestDetails: multiSource.manifestDetails,
        agentDirectives: multiSource.agentDirectives,
        scanErrors,
      };
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      scanErrors.push(`Scanner error on ${options.url}: ${errorMessage}`);

      return {
        url: options.url,
        scannedAt: startTime,
        durationMs: Date.now() - startTime,
        hasNavigatorModelContext: false,
        imperativeDetected: false,
        declarativeDetected: false,
        hasLlmsTxt: false,
        tools: [],
        scanErrors,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      if (context) {
        await context.close().catch(() => {});
      }
      if (!this.config.persistentBrowser && this.browser) {
        await this.close();
      }
    }
  }

  /**
   * Close the underlying browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

/**
 * Convenience function to scan a single URL using a one-off scanner instance
 */
export async function scanUrl(target: string | ScanTargetOptions, config?: ScannerConfig): Promise<WebMCPDetectionResult> {
  const scanner = new PlaywrightScanner({ ...config, persistentBrowser: false });
  try {
    return await scanner.scan(target);
  } finally {
    await scanner.close();
  }
}
