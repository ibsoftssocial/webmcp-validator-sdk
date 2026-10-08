import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ScanTargetOptions, WebMCPDetectionResult, DiscoveredTool } from '../types/index.js';
import { evaluatePageWebMCP, normalizeDiscoveredTools } from './page-evaluator.js';
import { runMultiSourceDiscovery } from '../discovery/index.js';
import {
  resolveDeviceConfig,
  getStealthHeaders,
  injectStealthScripts,
  normalizeCookies,
  setupResourceInterception,
} from './hardening.js';

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
  private browserPromise: Promise<Browser> | null = null;
  private config: Required<ScannerConfig>;

  constructor(config: ScannerConfig = {}) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 15000,
      headless: config.headless ?? true,
      executablePath: config.executablePath ?? '',
      persistentBrowser: config.persistentBrowser ?? true,
      defaultHydrationWaitMs: config.defaultHydrationWaitMs ?? 3000,
    };
  }

  /**
   * Lazily initialize or return existing Chromium browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.browserPromise) {
      return this.browserPromise;
    }

    const launchOptions: any = {
      headless: this.config.headless,
    };

    if (this.config.executablePath) {
      launchOptions.executablePath = this.config.executablePath;
    }

    this.browserPromise = chromium.launch(launchOptions).then((b) => {
      this.browser = b;
      this.browserPromise = null;
      return b;
    }).catch((err) => {
      this.browserPromise = null;
      throw err;
    });

    return this.browserPromise;
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
    let httpStatus: number | undefined;
    let finalUrl = options.url;
    let redirectChain: string[] = [];

    try {
      const browser = await this.getBrowser();

      // Resolve device configuration (viewport, touch, scale factor, user agent)
      const deviceConfig = resolveDeviceConfig({
        isMobile: options.isMobile,
        viewport: options.viewport,
        userAgent: options.userAgent,
      });

      // Prepare anti-bot stealth client hints unless stealth is explicitly disabled
      const stealthEnabled = options.stealth !== false;
      const stealthHeaders = stealthEnabled ? getStealthHeaders(deviceConfig.isMobile) : {};
      const extraHTTPHeaders = {
        ...stealthHeaders,
        ...(options.headers || {}),
      };

      // Configure context with custom headers, device emulation, SSL bypass
      context = await browser.newContext({
        ignoreHTTPSErrors: options.ignoreHTTPSErrors ?? true,
        userAgent: deviceConfig.userAgent,
        viewport: deviceConfig.viewport,
        deviceScaleFactor: deviceConfig.deviceScaleFactor,
        hasTouch: deviceConfig.hasTouch,
        isMobile: deviceConfig.isMobile,
        extraHTTPHeaders,
      });

      // Inject custom session cookies if provided
      if (options.cookies) {
        const normalized = normalizeCookies(options.cookies, options.url);
        if (normalized.length > 0) {
          await context.addCookies(normalized as any);
        }
      }

      // Inject anti-bot stealth evasion before any page scripts execute
      if (stealthEnabled) {
        await context.addInitScript(injectStealthScripts);
      }

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

      // Setup resource interception to abort heavy media / fonts if configured
      if (options.blockMedia || (options.blockedResourceTypes && options.blockedResourceTypes.length > 0)) {
        await setupResourceInterception(page, {
          blockMedia: options.blockMedia,
          blockedResourceTypes: options.blockedResourceTypes,
        });
      }

      // Navigate to the target page and track HTTP response & redirects
      let responseTimeMs: number | undefined;
      let xRobotsTagBlocking = false;
      const navStart = Date.now();
      const response = await page.goto(options.url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });

      if (response) {
        responseTimeMs = Date.now() - navStart;
        httpStatus = response.status();
        finalUrl = page.url();

        try {
          const headers = response.headers();
          const xRobots = (headers['x-robots-tag'] || '').toLowerCase();
          if (xRobots.includes('noindex') || xRobots.includes('noai') || xRobots.includes('none')) {
            xRobotsTagBlocking = true;
          }
        } catch {}

        let req: any = response.request();
        const chain: string[] = [];
        while (req) {
          const redirectedFrom = req.redirectedFrom();
          if (redirectedFrom) {
            chain.unshift(redirectedFrom.url());
            req = redirectedFrom;
          } else {
            break;
          }
        }
        redirectChain = chain;

        if (httpStatus >= 400) {
          scanErrors.push(`Received HTTP ${httpStatus} (${response.statusText() || 'Error'}) from ${options.url}`);
        }
      }

      // Wait for page load state (deferred scripts & stylesheets downloaded)
      try {
        await page.waitForLoadState('load', { timeout: Math.min(timeoutMs, 6000) });
      } catch {
        // Load timeout is non-fatal
      }

      // Optional network idle wait
      if (options.waitForNetworkIdle) {
        try {
          await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 5000) });
        } catch {
          // Timeout waiting for network idle is non-fatal
        }
      }

      // Wait for SPA hydration: wait for registered tools in navigator or document modelContext, or known WebMCP bridges
      try {
        await page.waitForFunction(
          () => {
            const win = window as any;
            const navTools = win.navigator?.modelContext?.getRegisteredTools?.();
            const docTools = win.document?.modelContext?.getRegisteredTools?.();
            const total = (Array.isArray(navTools) ? navTools.length : 0) + (Array.isArray(docTools) ? docTools.length : 0);
            if (total > 0) return true;
            if (win.webmcpfyGravityFormsTools?.tools && Object.keys(win.webmcpfyGravityFormsTools.tools).length > 0) return true;
            if (win.webmcpTools && (Array.isArray(win.webmcpTools) ? win.webmcpTools.length > 0 : Object.keys(win.webmcpTools).length > 0)) return true;
            return false;
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
        tools = normalizeDiscoveredTools(evalResult.rawTools, finalUrl || options.url);
      }

      // Execute Multi-Source Discovery: Declarative tags, MCP Manifests, and Agent Directives
      const multiSource = await runMultiSourceDiscovery({
        pageUrl: finalUrl || options.url,
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
        responseTimeMs,
        hasNavigatorModelContext,
        hasDocumentModelContext: evalResult?.hasDocumentModelContext,
        imperativeDetected: multiSource.imperativeDetected,
        declarativeDetected: multiSource.declarativeDetected,
        hasLlmsTxt: multiSource.hasLlmsTxt,
        llmsTxtContent: multiSource.llmsTxtContent,
        tools: multiSource.tools,
        declarativeMetadata: multiSource.declarativeMetadata,
        manifestDetails: multiSource.manifestDetails,
        agentDirectives: multiSource.agentDirectives,
        httpStatus,
        finalUrl,
        redirectChain,
        hasHtmlForms: evalResult?.hasHtmlForms,
        hasToolNameAttribute: evalResult?.hasToolNameAttribute,
        hasToolDescriptionAttribute: evalResult?.hasToolDescriptionAttribute,
        hasToolActionAttribute: evalResult?.hasToolActionAttribute,
        hasChromeBuiltInAI: evalResult?.hasChromeBuiltInAI,
        hasAgentInvokedOrHumanInLoop: evalResult?.hasAgentInvokedOrHumanInLoop,
        metaRobotsBlocking: evalResult?.metaRobotsBlocking,
        xRobotsTagBlocking,
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
        httpStatus,
        finalUrl,
        redirectChain,
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
    this.browserPromise = null;
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
