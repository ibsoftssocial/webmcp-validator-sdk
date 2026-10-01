import { DiscoveredTool } from '../types/index.js';

export interface PageEvaluationData {
  hasNavigatorModelContext: boolean;
  hasDocumentModelContext: boolean;
  hasOriginTrial: boolean;
  rawTools: any[];
  declarative: {
    webmcpVersion?: string;
    manifestLinks: string[];
    helpLinks: string[];
    originTrialTokens: string[];
  };
}

/**
 * Script evaluated inside the browser page context to inspect modelContext
 * (supporting both navigator.modelContext and document.modelContext),
 * extract all registered WebMCP tools, and parse declarative WebMCP tags safely.
 */
export function evaluatePageWebMCP(): PageEvaluationData {
  const win = window as any;
  const nav = win.navigator;
  const doc = win.document;
  const baseUri = doc?.baseURI || win?.location?.href || '';

  const hasNativeNav = typeof nav !== 'undefined' && 'modelContext' in nav && !!nav.modelContext;
  const hasNativeDoc = typeof doc !== 'undefined' && 'modelContext' in doc && !!doc.modelContext;

  // Extract declarative WebMCP metadata (<meta name="webmcp-version">)
  let webmcpVersion: string | undefined;
  try {
    const versionMeta = doc?.querySelector('meta[name="webmcp-version"]');
    if (versionMeta) {
      webmcpVersion = versionMeta.getAttribute('content') || undefined;
    }
  } catch {}

  // Extract declarative manifest links (<link rel="model-context">)
  const manifestLinks: string[] = [];
  try {
    const linkTags = doc ? doc.querySelectorAll('link[rel="model-context"]') : [];
    for (const link of linkTags) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          manifestLinks.push(new URL(href, baseUri).href);
        } catch {
          manifestLinks.push(href);
        }
      }
    }
  } catch {}

  // Extract help & llms.txt links (<link rel="help">, <link rel="llms-txt">)
  const helpLinks: string[] = [];
  try {
    const helpTags = doc ? doc.querySelectorAll('link[rel="help"], link[rel="llms-txt"]') : [];
    for (const link of helpTags) {
      const href = link.getAttribute('href');
      if (href) {
        try {
          helpLinks.push(new URL(href, baseUri).href);
        } catch {
          helpLinks.push(href);
        }
      }
    }
  } catch {}

  // Check for WebMCP origin trial meta tags
  const originTrialTokens: string[] = [];
  let hasOriginTrial = false;
  try {
    const metaTags = doc ? doc.querySelectorAll('meta[http-equiv="origin-trial"]') : [];
    for (const tag of metaTags) {
      const content = tag.getAttribute('content') || '';
      if (content.length > 0) {
        hasOriginTrial = true;
        originTrialTokens.push(content);
      }
    }
  } catch {}

  const toolsMap = new Map<string, any>();

  // Extract from navigator.modelContext
  try {
    if (nav?.modelContext?.getRegisteredTools) {
      const registered = nav.modelContext.getRegisteredTools();
      if (Array.isArray(registered)) {
        for (const t of registered) {
          if (t && t.name) toolsMap.set(t.name, t);
        }
      }
    }
  } catch {}

  // Extract from document.modelContext (Chrome Origin Trial standard)
  try {
    if (doc?.modelContext?.getRegisteredTools) {
      const registered = doc.modelContext.getRegisteredTools();
      if (Array.isArray(registered)) {
        for (const t of registered) {
          if (t && t.name && !toolsMap.has(t.name)) {
            toolsMap.set(t.name, t);
          }
        }
      }
    }
  } catch {}

  const rawToolsList = Array.from(toolsMap.values());

  // Safely serialize tool objects to avoid non-serializable properties (e.g. functions, circular DOM nodes)
  const sanitizedTools = rawToolsList.map((tool) => {
    if (!tool || typeof tool !== 'object') {
      return null;
    }

    return {
      name: typeof tool.name === 'string' ? tool.name : '',
      description: typeof tool.description === 'string' ? tool.description : '',
      inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object' },
      annotations: tool.annotations && typeof tool.annotations === 'object' ? tool.annotations : undefined,
      metadata: tool.metadata && typeof tool.metadata === 'object' ? tool.metadata : undefined,
    };
  }).filter(Boolean);

  const siteActivelyRegistered = !!win.__webmcp_site_invoked_registration || sanitizedTools.length > 0;
  const isBridgeInjected = !!win.__webmcp_bridge_injected;
  const siteProvidedNativeContext = (hasNativeNav || hasNativeDoc) && !isBridgeInjected;
  const hasImperativeModelContext = siteActivelyRegistered || siteProvidedNativeContext || hasOriginTrial;

  return {
    hasNavigatorModelContext: hasImperativeModelContext,
    hasDocumentModelContext: hasNativeDoc,
    hasOriginTrial,
    rawTools: siteActivelyRegistered ? sanitizedTools : [],
    declarative: {
      webmcpVersion,
      manifestLinks,
      helpLinks,
      originTrialTokens,
    },
  };
}

/**
 * Normalizes raw extracted tools into canonical DiscoveredTool structures
 */
export function normalizeDiscoveredTools(rawTools: any[], pageUrl: string): DiscoveredTool[] {
  const timestamp = Date.now();

  return rawTools.map((raw) => {
    return {
      name: raw.name || 'unnamed_tool',
      description: raw.description || '',
      inputSchema: raw.inputSchema && typeof raw.inputSchema === 'object' ? raw.inputSchema : { type: 'object' },
      annotations: raw.annotations,
      metadata: raw.metadata,
      source: 'imperative',
      rawSourceUrl: pageUrl,
      discoveredAt: timestamp,
    };
  });
}
