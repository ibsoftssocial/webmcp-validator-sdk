import { AgentDirectivesResult } from '../types/index.js';

export interface AgentDirectivesDiscovererOptions {
  /** Target page URL being audited */
  pageUrl: string;
  /** Discovered help or llms-txt link URLs from HTML */
  helpLinks?: string[];
  /** Whether to probe host-level fallback endpoints (/llms.txt, /robots.txt) if not linked (default: true for root path, false for subpaths) */
  probeWellKnown?: boolean;
  /** Timeout for HTTP requests in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Custom fetch implementation (defaults to global fetch) */
  fetchFn?: typeof fetch;
}

const MAX_DIRECTIVE_BYTES = 128 * 1024; // 128KB max text size

/**
 * Checks robots.txt content to determine if AI agent bots are generally permitted
 */
export function analyzeRobotsTxt(robotsTxt: string): { aiCrawlersAllowed: boolean } {
  const lines = robotsTxt.split(/\r?\n/);
  const aiBots = ['gptbot', 'claudebot', 'google-extended', 'anthropic-ai', 'perplexitybot'];
  let currentAgents: string[] = [];
  let isAiBlocked = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const lower = line.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      const agent = lower.replace('user-agent:', '').trim();
      currentAgents.push(agent);
    } else if (lower.startsWith('disallow:')) {
      const path = lower.replace('disallow:', '').trim();
      if (path === '/' || path === '/*') {
        const matchesAiBot = currentAgents.some(
          (agent) => agent === '*' || aiBots.some((bot) => agent.includes(bot))
        );
        if (matchesAiBot) {
          isAiBlocked = true;
        }
      }
    } else if (lower.startsWith('allow:')) {
      const path = lower.replace('allow:', '').trim();
      if (path === '/' || path === '/*') {
        isAiBlocked = false;
      }
    }
  }

  return { aiCrawlersAllowed: !isAiBlocked };
}

/**
 * Probes and extracts AI agent directives:
 * - /llms.txt and /llms-full.txt
 * - /robots.txt AI crawler policies
 */
export async function discoverAgentDirectives(
  options: AgentDirectivesDiscovererOptions
): Promise<AgentDirectivesResult> {
  const { pageUrl, helpLinks = [], timeoutMs = 5000 } = options;
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

  const shouldProbeWellKnown =
    options.probeWellKnown !== undefined
      ? options.probeWellKnown
      : pathname === '/' || pathname === '' || pathname === '/index.html';

  let hasLlmsTxt = false;
  let llmsTxtUrl: string | undefined;
  let llmsTxtContent: string | undefined;
  let hasLlmsFullTxt = false;
  let llmsFullTxtUrl: string | undefined;
  let hasRobotsTxt = false;
  let robotsTxtContent: string | undefined;
  let aiCrawlersAllowed: boolean | undefined;

  // 1. Probe candidate llms.txt URLs
  const llmsCandidates: string[] = [];
  for (const url of helpLinks) {
    if (url.includes('llms') && !llmsCandidates.includes(url)) {
      llmsCandidates.push(url);
    }
  }
  if (shouldProbeWellKnown && origin && origin.startsWith('http')) {
    const standardLlms = new URL('/llms.txt', origin).href;
    if (!llmsCandidates.includes(standardLlms)) {
      llmsCandidates.push(standardLlms);
    }
  }

  for (const candidate of llmsCandidates) {
    try {
      const res = await fetchFn(candidate, {
        headers: {
          'Accept': 'text/plain, text/markdown, */*',
          'User-Agent': 'WebMCP-Validator/0.1.0 (+https://github.com/ibsoftssocial/webmcp-validator-sdk)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const text = await res.text();
        const trimmed = text.trim();
        // Guard against HTML error pages returned with HTTP 200
        if (!trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
          hasLlmsTxt = true;
          llmsTxtUrl = candidate;
          llmsTxtContent = trimmed.slice(0, MAX_DIRECTIVE_BYTES);
          break;
        }
      }
    } catch (err: any) {
      if (helpLinks.includes(candidate)) {
        errors.push(`Failed to fetch linked llms.txt at ${candidate}: ${err.message || String(err)}`);
      }
    }
  }

  // 2. Probe llms-full.txt
  if (origin && origin.startsWith('http')) {
    const fullLlmsUrl = new URL('/llms-full.txt', origin).href;
    try {
      const res = await fetchFn(fullLlmsUrl, {
        headers: {
          'Accept': 'text/plain, text/markdown, */*',
          'User-Agent': 'WebMCP-Validator/0.1.0 (+https://github.com/ibsoftssocial/webmcp-validator-sdk)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const text = await res.text();
        const trimmed = text.trim();
        if (!trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
          hasLlmsFullTxt = true;
          llmsFullTxtUrl = fullLlmsUrl;
        }
      }
    } catch {}
  }

  // 3. Probe robots.txt
  if (origin && origin.startsWith('http')) {
    const robotsUrl = new URL('/robots.txt', origin).href;
    try {
      const res = await fetchFn(robotsUrl, {
        headers: {
          'Accept': 'text/plain, */*',
          'User-Agent': 'WebMCP-Validator/0.1.0 (+https://github.com/ibsoftssocial/webmcp-validator-sdk)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const text = await res.text();
        const trimmed = text.trim();
        if (!trimmed.startsWith('<!DOCTYPE') && !trimmed.startsWith('<html')) {
          hasRobotsTxt = true;
          robotsTxtContent = trimmed.slice(0, MAX_DIRECTIVE_BYTES);
          const analysis = analyzeRobotsTxt(trimmed);
          aiCrawlersAllowed = analysis.aiCrawlersAllowed;
        }
      }
    } catch {}
  }

  return {
    hasLlmsTxt,
    llmsTxtUrl,
    llmsTxtContent,
    hasLlmsFullTxt,
    llmsFullTxtUrl,
    hasRobotsTxt,
    robotsTxtContent,
    aiCrawlersAllowed,
    errors,
  };
}
