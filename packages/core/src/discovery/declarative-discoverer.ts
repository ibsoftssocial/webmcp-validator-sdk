import { DeclarativeMetadata } from '../types/index.js';

export interface DeclarativeDiscovererOptions {
  pageUrl: string;
  inPageData?: {
    webmcpVersion?: string;
    manifestLinks: string[];
    helpLinks: string[];
    originTrialTokens: string[];
  };
  htmlSource?: string;
}

/**
 * Parses static HTML text to extract WebMCP declarative tags:
 * - <meta name="webmcp-version" content="...">
 * - <link rel="model-context" href="...">
 * - <link rel="help" href="..."> or <link rel="llms-txt" href="...">
 * - <meta http-equiv="origin-trial" content="...">
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

  return {
    webmcpVersion,
    manifestLinks,
    helpLinks,
    originTrialTokens,
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
    };
  }

  if (htmlSource) {
    return parseDeclarativeHtml(htmlSource, pageUrl);
  }

  return {
    manifestLinks: [],
    helpLinks: [],
    originTrialTokens: [],
  };
}
