import { DeclarativeMetadata, DiscoveredTool } from '../types/index.js';

export interface DeclarativeDiscovererOptions {
  pageUrl: string;
  inPageData?: {
    webmcpVersion?: string;
    manifestLinks: string[];
    helpLinks: string[];
    originTrialTokens: string[];
    declarativeTools?: DiscoveredTool[];
  };
  htmlSource?: string;
}

/**
 * Parses static HTML text to extract WebMCP declarative tags:
 * - <meta name="webmcp-version" content="...">
 * - <link rel="model-context" href="...">
 * - <link rel="help" href="..."> or <link rel="llms-txt" href="...">
 * - <meta http-equiv="origin-trial" content="...">
 * - Declarative forms/elements: <form toolname="..." ...>
 */
export function parseDeclarativeHtml(html: string, baseUrl: string): DeclarativeMetadata {
  const metaVersionMatch =
    html.match(/<meta\s+[^>]*name=["']webmcp-version["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']webmcp-version["']/i);
  const webmcpVersion = metaVersionMatch ? metaVersionMatch[1] : undefined;

  const manifestLinks: string[] = [];
  const manifestRegex1 = /<link\s+[^>]*rel=["']model-context["'][^>]*href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = manifestRegex1.exec(html)) !== null) {
    const val = match[1];
    if (val) {
      try {
        manifestLinks.push(new URL(val, baseUrl).href);
      } catch {
        manifestLinks.push(val);
      }
    }
  }

  const manifestRegex2 = /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']model-context["']/gi;
  while ((match = manifestRegex2.exec(html)) !== null) {
    const val = match[1];
    if (val) {
      try {
        const resolved = new URL(val, baseUrl).href;
        if (!manifestLinks.includes(resolved)) manifestLinks.push(resolved);
      } catch {
        if (!manifestLinks.includes(val)) manifestLinks.push(val);
      }
    }
  }

  const helpLinks: string[] = [];
  const helpRegex = /<link\s+[^>]*rel=["'](?:help|llms-txt)["'][^>]*href=["']([^"']+)["']/gi;
  while ((match = helpRegex.exec(html)) !== null) {
    const val = match[1];
    if (val) {
      try {
        helpLinks.push(new URL(val, baseUrl).href);
      } catch {
        helpLinks.push(val);
      }
    }
  }

  const originTrialTokens: string[] = [];
  const otRegex = /<meta\s+[^>]*http-equiv=["']origin-trial["'][^>]*content=["']([^"']+)["']/gi;
  while ((match = otRegex.exec(html)) !== null) {
    const val = match[1];
    if (val) {
      originTrialTokens.push(val);
    }
  }

  // Extract Declarative WebMCP Form Tools from HTML text (e.g. <form toolname="..." ...>)
  const declarativeTools: DiscoveredTool[] = [];
  const formRegex = /<form\s+([^>]*?(?:toolname|data-tool-name)=[^>]*?)>(.*?)<\/form>/gis;
  let formMatch: RegExpExecArray | null;
  while ((formMatch = formRegex.exec(html)) !== null) {
    const formAttrs = formMatch[1] || '';
    const formInner = formMatch[2] || '';

    const nameMatch = formAttrs.match(/(?:toolname|data-tool-name)=["']([^"']+)["']/i);
    if (!nameMatch || !nameMatch[1]) continue;
    const name = nameMatch[1];

    const descMatch = formAttrs.match(/(?:tooldescription|data-tool-description)=["']([^"']+)["']/i);
    const rawDesc = descMatch && descMatch[1] ? descMatch[1] : '';
    const description = rawDesc
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    let inputSchema: any = null;
    const schemaRefMatch = formAttrs.match(/(?:data-tool-schema-ref|tool-schema-ref)=["']#?([^"']+)["']/i);
    if (schemaRefMatch && schemaRefMatch[1]) {
      const scriptId = schemaRefMatch[1];
      const scriptRegex = new RegExp(`<script\\s+[^>]*id=["\']${scriptId}["\'][^>]*>([\\s\\S]*?)<\\/script>`, 'i');
      const scriptMatch = html.match(scriptRegex);
      if (scriptMatch && scriptMatch[1]) {
        try {
          inputSchema = JSON.parse(scriptMatch[1].trim());
        } catch {}
      }
    }

    if (!inputSchema || typeof inputSchema !== 'object') {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      const inputRegex = /<input\s+([^>]*?)>/gi;
      let inMatch: RegExpExecArray | null;
      while ((inMatch = inputRegex.exec(formInner)) !== null) {
        const inAttrs = inMatch[1] || '';
        const nameAttr = inAttrs.match(/name=["']([^"']+)["']/i);
        if (!nameAttr || !nameAttr[1]) continue;
        const inputName = nameAttr[1];
        if (inputName === 'csrf' || inputName === '_csrf') continue;

        const typeMatch = inAttrs.match(/type=["']([^"']+)["']/i);
        const type = (typeMatch && typeMatch[1] ? typeMatch[1] : 'text').toLowerCase();
        if (['submit', 'button', 'reset', 'image'].includes(type)) continue;

        const pDescMatch = inAttrs.match(/(?:toolparamdescription|data-tool-param-description|placeholder)=["']([^"']+)["']/i);
        const prop: any = {
          type: type === 'number' || type === 'range' ? 'number' : 'string',
        };
        if (pDescMatch && pDescMatch[1]) prop.description = pDescMatch[1];
        if (/required/i.test(inAttrs)) required.push(inputName);
        properties[inputName] = prop;
      }
      inputSchema = {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }

    const methodMatch = formAttrs.match(/method=["']([^"']+)["']/i);
    const method = (methodMatch && methodMatch[1] ? methodMatch[1] : 'GET').toUpperCase();
    const isReadOnly = method === 'GET' || /role=["']search["']/i.test(formAttrs);

    declarativeTools.push({
      name,
      description,
      inputSchema,
      annotations: {
        readOnlyHint: isReadOnly,
        consequentialHint: !isReadOnly && method === 'POST',
        confirmationHint: !isReadOnly && method === 'POST',
      },
      source: 'declarative',
      rawSourceUrl: baseUrl,
      discoveredAt: Date.now(),
    });
  }

  return {
    webmcpVersion,
    manifestLinks,
    helpLinks,
    originTrialTokens,
    declarativeTools,
  };
}

/**
 * Extracts and normalizes declarative metadata from in-page browser data or static HTML
 */
export function extractDeclarativeMetadata(options: DeclarativeDiscovererOptions): DeclarativeMetadata {
  const { pageUrl, inPageData, htmlSource } = options;

  if (inPageData) {
    return {
      webmcpVersion: inPageData.webmcpVersion,
      manifestLinks: inPageData.manifestLinks || [],
      helpLinks: inPageData.helpLinks || [],
      originTrialTokens: inPageData.originTrialTokens || [],
      declarativeTools: inPageData.declarativeTools || [],
    };
  }

  if (htmlSource) {
    return parseDeclarativeHtml(htmlSource, pageUrl);
  }

  return {
    manifestLinks: [],
    helpLinks: [],
    originTrialTokens: [],
    declarativeTools: [],
  };
}
