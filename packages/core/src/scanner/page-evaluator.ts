import { DiscoveredTool } from '../types/index.js';

export interface PageEvaluationData {
  hasNavigatorModelContext: boolean;
  rawTools: any[];
}

/**
 * Script evaluated inside the browser page context to inspect navigator.modelContext
 * and extract all registered WebMCP tools safely.
 */
export function evaluatePageWebMCP(): PageEvaluationData {
  const win = window as any;
  const nav = win.navigator;

  const hasNavigatorModelContext = typeof nav !== 'undefined' && 'modelContext' in nav && !!nav.modelContext;

  if (!hasNavigatorModelContext) {
    return {
      hasNavigatorModelContext: false,
      rawTools: [],
    };
  }

  let toolsList: any[] = [];

  try {
    if (typeof nav.modelContext.getRegisteredTools === 'function') {
      const registered = nav.modelContext.getRegisteredTools();
      if (Array.isArray(registered)) {
        toolsList = registered;
      }
    }
  } catch (err) {
    // If calling getRegisteredTools throws, preserve flag but return empty list
  }

  // Safely serialize tool objects to avoid non-serializable properties (e.g. functions, circular DOM nodes)
  const sanitizedTools = toolsList.map((tool) => {
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

  return {
    hasNavigatorModelContext: true,
    rawTools: sanitizedTools,
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
