import {
  DiscoveredTool,
  DeclarativeMetadata,
  ManifestDiscoveryResult,
  AgentDirectivesResult,
} from '../types/index.js';
import { extractDeclarativeMetadata } from './declarative-discoverer.js';
import { discoverManifest } from './manifest-discoverer.js';
import { discoverAgentDirectives } from './agent-directives-discoverer.js';

export interface MultiSourceDiscoveryOptions {
  /** Target page URL */
  pageUrl: string;
  /** In-page evaluation data extracted from browser */
  inPageDeclarative?: {
    webmcpVersion?: string;
    manifestLinks: string[];
    helpLinks: string[];
    originTrialTokens: string[];
  };
  /** Imperative tools already extracted from browser page */
  imperativeTools?: DiscoveredTool[];
  /** Optional static HTML source if browser was not used */
  htmlSource?: string;
  /** Whether to probe host-level fallback endpoints if not linked in HTML (default: true for root path, false for subpaths) */
  probeWellKnown?: boolean;
  /** Timeout for background HTTP probes in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Custom fetch function */
  fetchFn?: typeof fetch;
}

export interface MultiSourceDiscoveryResult {
  /** Combined list of all unique discovered tools from all sources */
  tools: DiscoveredTool[];
  /** Whether imperative tools were registered in browser */
  imperativeDetected: boolean;
  /** Whether declarative WebMCP markup was detected (<meta>, <link>, or manifest) */
  declarativeDetected: boolean;
  /** Whether /llms.txt was detected */
  hasLlmsTxt: boolean;
  /** Content of /llms.txt if found */
  llmsTxtContent?: string;
  /** Extracted declarative HTML metadata */
  declarativeMetadata: DeclarativeMetadata;
  /** Manifest discovery details */
  manifestDetails: ManifestDiscoveryResult;
  /** Agent directives details */
  agentDirectives: AgentDirectivesResult;
  /** Aggregated discovery errors */
  errors: string[];
}

/**
 * Orchestrates multi-source WebMCP discovery:
 * 1. Declarative HTML markup (<meta name="webmcp-version">, <link rel="model-context">, <link rel="help">)
 * 2. Hosted MCP Manifests (explicitly linked or standard /.well-known/mcp.json)
 * 3. AI Agent Directives (/llms.txt, /llms-full.txt, /robots.txt)
 * 4. Deduplicates and unifies all discovered tools across imperative and declarative sources
 */
export async function runMultiSourceDiscovery(
  options: MultiSourceDiscoveryOptions
): Promise<MultiSourceDiscoveryResult> {
  const {
    pageUrl,
    inPageDeclarative,
    imperativeTools = [],
    htmlSource,
    probeWellKnown,
    timeoutMs = 5000,
    fetchFn,
  } = options;

  const errors: string[] = [];

  // 1. Extract Declarative Metadata
  const declarativeMetadata = extractDeclarativeMetadata({
    pageUrl,
    inPageData: inPageDeclarative,
    htmlSource,
  });

  // 2. Concurrently probe Manifests and Agent Directives
  const [manifestResult, directivesResult] = await Promise.all([
    discoverManifest({
      pageUrl,
      linkedManifestUrls: declarativeMetadata.manifestLinks,
      probeWellKnown,
      timeoutMs,
      fetchFn,
    }),
    discoverAgentDirectives({
      pageUrl,
      helpLinks: declarativeMetadata.helpLinks,
      probeWellKnown,
      timeoutMs,
      fetchFn,
    }),
  ]);

  if (manifestResult.errors.length > 0) {
    errors.push(...manifestResult.errors);
  }
  if (directivesResult.errors.length > 0) {
    errors.push(...directivesResult.errors);
  }

  // 3. Deduplicate and merge discovered tools
  // Imperative tools take priority for identical names, but all unique tools are preserved
  const mergedTools: DiscoveredTool[] = [...imperativeTools];
  const seenToolNames = new Set(imperativeTools.map((t) => t.name.toLowerCase()));

  for (const manifestTool of manifestResult.tools) {
    if (!seenToolNames.has(manifestTool.name.toLowerCase())) {
      mergedTools.push(manifestTool);
      seenToolNames.add(manifestTool.name.toLowerCase());
    }
  }

  const imperativeDetected = imperativeTools.length > 0;
  const declarativeDetected =
    !!declarativeMetadata.webmcpVersion ||
    declarativeMetadata.manifestLinks.length > 0 ||
    manifestResult.hasManifest;

  return {
    tools: mergedTools,
    imperativeDetected,
    declarativeDetected,
    hasLlmsTxt: directivesResult.hasLlmsTxt,
    llmsTxtContent: directivesResult.llmsTxtContent,
    declarativeMetadata,
    manifestDetails: manifestResult,
    agentDirectives: directivesResult,
    errors,
  };
}
