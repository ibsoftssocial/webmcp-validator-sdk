import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ScanTargetOptions, WebMCPDetectionResult, DiscoveredTool } from '../types/index.js';
import { evaluatePageWebMCP, normalizeDiscoveredTools } from './page-evaluator.js';

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

      page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);

      // Navigate to the target page
      await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      // Wait for SPA hydration: wait for navigator.modelContext and registered tools
      try {
        await page.waitForFunction(
          () => {
            const nav = window.navigator as any;
            if (typeof nav === 'undefined' || !('modelContext' in nav) || !nav.modelContext) {
              return false;
            }
            try {
              const tools = nav.modelContext.getRegisteredTools?.();
              return Array.isArray(tools) && tools.length > 0;
            } catch {
              return true;
            }
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
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      scanErrors.push(`Scanner error on ${options.url}: ${errorMessage}`);
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

    const durationMs = Date.now() - startTime;

    return {
      url: options.url,
      scannedAt: startTime,
      durationMs,
      hasNavigatorModelContext,
      imperativeDetected: tools.length > 0,
      declarativeDetected: false, // Day 4 will implement declarative tag discovery
      hasLlmsTxt: false,          // Day 4 will implement llms.txt discovery
      tools,
      scanErrors,
    };
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
