import { z } from 'zod';
import { ToolDefinitionSchema } from './tool.js';

export const DiscoverySourceSchema = z.enum([
  'imperative',    // navigator.modelContext.registerTool()
  'declarative',   // <meta> or <link rel="model-context"> tags
  'manifest',      // /.well-known/mcp.json or /mcp
  'llms-txt',      // /llms.txt or /llms-full.txt
]);

export type DiscoverySource = z.infer<typeof DiscoverySourceSchema>;

export const DiscoveredToolSchema = ToolDefinitionSchema.extend({
  source: DiscoverySourceSchema,
  rawSourceUrl: z.string().optional(),
  discoveredAt: z.number(),
});

export type DiscoveredTool = z.infer<typeof DiscoveredToolSchema>;

export interface CookieOption {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ViewportOption {
  width: number;
  height: number;
}

export interface ScanTargetOptions {
  /** Target URL to scan (e.g. https://example.com or http://localhost:3000) */
  url: string;
  /** Max time to wait for page load & tool registrations in milliseconds */
  timeoutMs?: number;
  /** Custom HTTP headers (e.g. Authorization or Cookies) */
  headers?: Record<string, string>;
  /** Custom user agent string */
  userAgent?: string;
  /** Emulate mobile device viewport and user-agent */
  isMobile?: boolean;
  /** Custom viewport dimensions (default: 1920x1080 for desktop, 390x844 for mobile) */
  viewport?: ViewportOption;
  /** Custom session cookies to inject */
  cookies?: CookieOption[] | string;
  /** Whether to enable anti-bot stealth emulation (default: true) */
  stealth?: boolean;
  /** Whether to abort heavy media (images, videos, fonts) to accelerate scans (default: false) */
  blockMedia?: boolean;
  /** Specific resource types to abort (e.g. ['image', 'media', 'font', 'stylesheet']) */
  blockedResourceTypes?: ('image' | 'media' | 'font' | 'stylesheet' | 'other')[];
  /** Wait for network to be idle before completing evaluation */
  waitForNetworkIdle?: boolean;
  /** Custom path to system Chrome executable */
  executablePath?: string;
  /** Run headless or headed browser */
  headless?: boolean;
  /** Ignore SSL errors (useful for localhost self-signed certs) */
  ignoreHTTPSErrors?: boolean;
  /** Extra wait time after page load for SPA hydration (in ms) */
  hydrationWaitMs?: number;
  /** Whether to probe host-level well-known endpoints (/.well-known/mcp.json, /llms.txt) if not linked in HTML (default: true for root path, false for subpaths) */
  probeWellKnown?: boolean;
}

export interface DeclarativeMetadata {
  /** Value of <meta name="webmcp-version"> if present */
  webmcpVersion?: string;
  /** URLs extracted from <link rel="model-context"> tags */
  manifestLinks: string[];
  /** URLs extracted from <link rel="help"> or <link rel="llms-txt"> tags */
  helpLinks: string[];
  /** Origin trial tokens extracted from <meta http-equiv="origin-trial"> */
  originTrialTokens: string[];
  /** Declarative tools declared via HTML markup (<form toolname="...">) */
  declarativeTools?: DiscoveredTool[];
}

export interface ManifestDiscoveryResult {
  /** Whether a valid MCP manifest JSON was discovered and parsed */
  hasManifest: boolean;
  /** URL where the manifest was successfully loaded from */
  manifestUrl?: string;
  /** Parsed manifest object */
  manifestData?: any;
  /** Whether the manifest was found at /.well-known/webmcp or /.well-known/webmcp.json */
  hasWellKnownWebmcp?: boolean;
  /** Whether the manifest content was parsed as valid JSON */
  isValidJson?: boolean;
  /** Tools extracted from the manifest */
  tools: DiscoveredTool[];
  /** Non-fatal errors encountered during manifest probing/parsing */
  errors: string[];
}

export interface AgentDirectivesResult {
  /** Whether /llms.txt was found and accessible */
  hasLlmsTxt: boolean;
  /** Resolved URL for llms.txt */
  llmsTxtUrl?: string;
  /** Text content of /llms.txt */
  llmsTxtContent?: string;
  /** Whether /llms-full.txt was found */
  hasLlmsFullTxt: boolean;
  /** Resolved URL for llms-full.txt */
  llmsFullTxtUrl?: string;
  /** Whether /robots.txt exists */
  hasRobotsTxt: boolean;
  /** Raw content of /robots.txt */
  robotsTxtContent?: string;
  /** Whether common AI crawler user-agents are permitted */
  aiCrawlersAllowed?: boolean;
  /** Whether /sitemap.xml or sitemap index is present */
  hasSitemapXml?: boolean;
  /** Resolved sitemap URL */
  sitemapUrl?: string;
  /** Non-fatal errors encountered during agent directives probing */
  errors: string[];
}

export interface WebMCPDetectionResult {
  /** Target URL scanned */
  url: string;
  /** Timestamp when the scan executed */
  scannedAt: number;
  /** Total scan duration in milliseconds */
  durationMs: number;
  /** Initial server response time in milliseconds */
  responseTimeMs?: number;
  /** Whether window.navigator.modelContext exists */
  hasNavigatorModelContext: boolean;
  /** Whether window.document.modelContext exists */
  hasDocumentModelContext?: boolean;
  /** Whether imperative tool registrations were detected */
  imperativeDetected: boolean;
  /** Whether declarative WebMCP markup was detected */
  declarativeDetected: boolean;
  /** Whether /llms.txt was found */
  hasLlmsTxt: boolean;
  /** Content of llms.txt if found */
  llmsTxtContent?: string;
  /** List of all tools discovered on the page (imperative and manifest) */
  tools: DiscoveredTool[];
  /** Declarative HTML discovery details (<meta>, <link>) */
  declarativeMetadata?: DeclarativeMetadata;
  /** Manifest discovery details (/.well-known/mcp.json, etc.) */
  manifestDetails?: ManifestDiscoveryResult;
  /** Agent directives details (llms.txt, robots.txt) */
  agentDirectives?: AgentDirectivesResult;
  /** HTTP response status code (e.g. 200, 301, 401, 403, 404) */
  httpStatus?: number;
  /** Final URL after all browser redirects */
  finalUrl?: string;
  /** Redirect URLs traversed during navigation */
  redirectChain?: string[];
  /** Whether HTML <form> elements exist on the page */
  hasHtmlForms?: boolean;
  /** Whether toolname / data-tool-name attribute is declared on markup */
  hasToolNameAttribute?: boolean;
  /** Whether tooldescription / data-tool-description attribute is declared */
  hasToolDescriptionAttribute?: boolean;
  /** Whether toolaction / data-tool-action / action attribute is declared */
  hasToolActionAttribute?: boolean;
  /** Whether Chrome Built-in AI (Prompt API / Gemini Nano) was detected */
  hasChromeBuiltInAI?: boolean;
  /** Whether agentInvoked handler or human-in-the-loop confirmation is supported */
  hasAgentInvokedOrHumanInLoop?: boolean;
  /** Whether Meta Robots tag contains restrictive noai / noindex directives */
  metaRobotsBlocking?: boolean;
  /** Whether X-Robots-Tag HTTP header contains restrictive noai / noindex directives */
  xRobotsTagBlocking?: boolean;
  /** Errors encountered during scanning */
  scanErrors: string[];
}
