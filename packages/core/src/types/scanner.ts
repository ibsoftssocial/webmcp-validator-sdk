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

export interface ScanTargetOptions {
  /** Target URL to scan (e.g. https://example.com or http://localhost:3000) */
  url: string;
  /** Max time to wait for page load & tool registrations in milliseconds */
  timeoutMs?: number;
  /** Custom HTTP headers (e.g. Authorization or Cookies) */
  headers?: Record<string, string>;
  /** Custom user agent string */
  userAgent?: string;
  /** Emulate mobile device */
  isMobile?: boolean;
  /** Custom path to system Chrome executable */
  executablePath?: string;
  /** Run headless or headed browser */
  headless?: boolean;
  /** Ignore SSL errors (useful for localhost self-signed certs) */
  ignoreHTTPSErrors?: boolean;
  /** Extra wait time after page load for SPA hydration (in ms) */
  hydrationWaitMs?: number;
}

export interface WebMCPDetectionResult {
  /** Target URL scanned */
  url: string;
  /** Timestamp when the scan executed */
  scannedAt: number;
  /** Total scan duration in milliseconds */
  durationMs: number;
  /** Whether window.navigator.modelContext exists */
  hasNavigatorModelContext: boolean;
  /** Whether imperative tool registrations were detected */
  imperativeDetected: boolean;
  /** Whether declarative WebMCP markup was detected */
  declarativeDetected: boolean;
  /** Whether /llms.txt was found */
  hasLlmsTxt: boolean;
  /** Content of llms.txt if found */
  llmsTxtContent?: string;
  /** List of all tools discovered on the page */
  tools: DiscoveredTool[];
  /** Errors encountered during scanning */
  scanErrors: string[];
}
