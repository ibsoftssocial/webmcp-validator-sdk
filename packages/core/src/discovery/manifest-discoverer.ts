import { DiscoveredTool, ManifestDiscoveryResult } from '../types/index.js';

export interface ManifestDiscovererOptions {
  /** Target page URL being audited */
  pageUrl: string;
  /** Manifest links discovered from HTML <link rel="model-context"> */
  linkedManifestUrls?: string[];
  /** Whether to probe host-level well-known endpoints (/.well-known/mcp.json) if not linked (default: true for root path, false for subpaths) */
  probeWellKnown?: boolean;
  /** Timeout for HTTP requests in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Custom fetch implementation (defaults to global fetch) */
  fetchFn?: typeof fetch;
}

/**
 * Probes and extracts WebMCP tools from hosted MCP manifests:
 * 1. Checks explicitly linked manifests from <link rel="model-context">
 * 2. Checks standard well-known location: /.well-known/mcp.json
 * 3. Checks standard alternative location: /mcp/manifest.json
 */
export async function discoverManifest(options: ManifestDiscovererOptions): Promise<ManifestDiscoveryResult> {
  const { pageUrl, linkedManifestUrls = [], timeoutMs = 5000 } = options;
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const errors: string[] = [];

  let origin = '';
  let pathname = '/';
  try {
    const parsed = new URL(pageUrl);
    origin = parsed.origin;
    pathname = parsed.pathname || '/';
  } catch {
    origin = pageUrl;
  }

  // Determine whether to probe host-level fallback endpoints
  const shouldProbeWellKnown =
    options.probeWellKnown !== undefined
      ? options.probeWellKnown
      : pathname === '/' || pathname === '' || pathname === '/index.html';

  // Construct priority list of candidate manifest URLs to probe
  const candidateUrls: string[] = [];

  // 1. Explicitly linked manifests take top priority
  for (const url of linkedManifestUrls) {
    if (url && !candidateUrls.includes(url)) {
      candidateUrls.push(url);
    }
  }

  // 2. Standard well-known endpoints as fallback (if permitted)
  if (shouldProbeWellKnown && origin && origin.startsWith('http')) {
    const wellKnown = new URL('/.well-known/mcp.json', origin).href;
    if (!candidateUrls.includes(wellKnown)) {
      candidateUrls.push(wellKnown);
    }

    const mcpManifest = new URL('/mcp/manifest.json', origin).href;
    if (!candidateUrls.includes(mcpManifest)) {
      candidateUrls.push(mcpManifest);
    }
  }

  // Probe candidates sequentially or stop on first valid manifest
  for (const candidateUrl of candidateUrls) {
    try {
      const response = await fetchFn(candidateUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'WebMCP-Validator/0.1.0 (+https://github.com/ibsoftssocial/webmcp-validator-sdk)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        continue;
      }

      const rawText = await response.text();
      const trimmed = rawText.trim();

      // Guard against SPA fallback HTML being returned as status 200
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        continue;
      }

      let parsedData: any;
      try {
        parsedData = JSON.parse(trimmed);
      } catch (jsonErr) {
        errors.push(`Manifest at ${candidateUrl} contained invalid JSON: ${(jsonErr as Error).message}`);
        continue;
      }

      if (!parsedData || typeof parsedData !== 'object') {
        continue;
      }

      // Extract tools from parsed manifest
      const rawTools = Array.isArray(parsedData.tools) ? parsedData.tools : [];
      const timestamp = Date.now();

      const tools: DiscoveredTool[] = rawTools
        .filter((t: any) => t && typeof t === 'object' && typeof t.name === 'string')
        .map((t: any) => {
          return {
            name: t.name,
            description: typeof t.description === 'string' ? t.description : '',
            inputSchema: t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : { type: 'object' },
            annotations: t.annotations && typeof t.annotations === 'object' ? t.annotations : undefined,
            metadata: t.metadata && typeof t.metadata === 'object' ? t.metadata : undefined,
            source: 'manifest' as const,
            rawSourceUrl: candidateUrl,
            discoveredAt: timestamp,
          };
        });

      return {
        hasManifest: true,
        manifestUrl: candidateUrl,
        manifestData: parsedData,
        tools,
        errors,
      };
    } catch (err: any) {
      // Network timeouts, DNS issues, or connection errors on candidate URLs
      // are non-fatal candidate probes unless it was an explicit manifest link
      if (linkedManifestUrls.includes(candidateUrl)) {
        errors.push(`Failed to fetch linked manifest at ${candidateUrl}: ${err.message || String(err)}`);
      }
    }
  }

  return {
    hasManifest: false,
    tools: [],
    errors,
  };
}
