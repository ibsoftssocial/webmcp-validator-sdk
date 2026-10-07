import { DiscoveredTool } from '../types/index.js';

export interface PageEvaluationData {
  hasNavigatorModelContext: boolean;
  hasDocumentModelContext: boolean;
  hasOriginTrial: boolean;
  hasHtmlForms: boolean;
  hasToolNameAttribute: boolean;
  hasToolDescriptionAttribute: boolean;
  hasToolActionAttribute: boolean;
  hasChromeBuiltInAI: boolean;
  hasAgentInvokedOrHumanInLoop: boolean;
  metaRobotsBlocking: boolean;
  rawTools: any[];
  declarative: {
    webmcpVersion?: string;
    manifestLinks: string[];
    helpLinks: string[];
    originTrialTokens: string[];
    declarativeTools: any[];
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

  // Extract Declarative WebMCP Form Markup (e.g. <form toolname="..." ...>)
  const declarativeTools: any[] = [];
  try {
    const formEls = doc ? doc.querySelectorAll('form[toolname], form[data-tool-name], [toolname], [data-tool-name]') : [];
    for (const el of formEls) {
      const name = el.getAttribute('toolname') || el.getAttribute('data-tool-name');
      if (!name) continue;

      let rawDesc = el.getAttribute('tooldescription') || el.getAttribute('data-tool-description') || el.getAttribute('aria-label') || '';
      const description = rawDesc
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      let inputSchema: any = null;

      // 1. Check data-tool-schema-ref or tool-schema-ref (e.g. "#prepare-memorial-search-schema")
      const schemaRef = el.getAttribute('data-tool-schema-ref') || el.getAttribute('tool-schema-ref');
      if (schemaRef && schemaRef.startsWith('#')) {
        const scriptId = schemaRef.slice(1);
        const scriptEl = doc.getElementById(scriptId);
        if (scriptEl && scriptEl.textContent) {
          try {
            inputSchema = JSON.parse(scriptEl.textContent.trim());
          } catch {}
        }
      }

      // 2. If no script reference, infer schema from child form inputs
      if (!inputSchema || typeof inputSchema !== 'object') {
        const properties: Record<string, any> = {};
        const required: string[] = [];
        const inputs = el.querySelectorAll('input, select, textarea');

        for (const input of inputs) {
          const inputName = input.getAttribute('name');
          if (!inputName || inputName === 'csrf' || inputName === '_csrf') continue;

          const type = (input.getAttribute('type') || 'text').toLowerCase();
          if (type === 'submit' || type === 'button' || type === 'reset' || type === 'image') continue;

          const paramDesc = input.getAttribute('toolparamdescription') || input.getAttribute('data-tool-param-description') || input.getAttribute('placeholder') || '';
          const prop: any = {
            type: type === 'number' || type === 'range' ? 'number' : 'string',
          };
          if (paramDesc) prop.description = paramDesc;
          if (input.hasAttribute('minlength')) {
            const min = parseInt(input.getAttribute('minlength'), 10);
            if (!isNaN(min)) prop.minLength = min;
          }
          if (input.hasAttribute('maxlength')) {
            const max = parseInt(input.getAttribute('maxlength'), 10);
            if (!isNaN(max)) prop.maxLength = max;
          }
          if (input.hasAttribute('pattern')) prop.pattern = input.getAttribute('pattern');

          if (input.tagName && input.tagName.toLowerCase() === 'select') {
            const options = Array.from(input.querySelectorAll('option')).map((o: any) => o.value || o.textContent).filter(Boolean);
            if (options.length > 0) prop.enum = options;
          }

          properties[inputName] = prop;
          if (input.hasAttribute('required')) {
            required.push(inputName);
          }
        }

        inputSchema = {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        };
      }

      const method = (el.getAttribute('method') || 'GET').toUpperCase();
      const isReadOnly = method === 'GET' || el.getAttribute('role') === 'search';

      declarativeTools.push({
        name,
        description,
        inputSchema,
        annotations: {
          readOnlyHint: isReadOnly,
          confirmationHint: !isReadOnly && method === 'POST',
        },
        source: 'declarative',
        rawSourceUrl: baseUri,
        discoveredAt: Date.now(),
      });
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

  // Extract from known WebMCP client bridges and fallbacks (e.g. window.webmcpfyGravityFormsTools, window.webmcpTools, window.__webmcpTools)
  try {
    const fallbackBridges = [
      win.webmcpfyGravityFormsTools?.tools,
      win.webmcpTools,
      win.__webmcpTools,
    ];
    for (const b of fallbackBridges) {
      if (b && typeof b === 'object') {
        const entries = Array.isArray(b) ? b.map((t: any) => [t?.name, t]) : Object.entries(b);
        for (const [name, toolObj] of entries as [string, any][]) {
          if (name && !toolsMap.has(name) && toolObj) {
            toolsMap.set(name, {
              name,
              description: toolObj.description || '',
              inputSchema: toolObj.inputSchema && typeof toolObj.inputSchema === 'object' ? toolObj.inputSchema : { type: 'object' },
              annotations: toolObj.annotations,
            });
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
  const hasHtmlForms = !!(doc && doc.querySelectorAll('form').length > 0);
  const hasToolNameAttribute = !!(doc && doc.querySelector('[toolname], [data-tool-name]'));
  const hasToolDescriptionAttribute = !!(doc && doc.querySelector('[tooldescription], [data-tool-description]'));
  const hasToolActionAttribute = !!(doc && doc.querySelector('[toolaction], [data-tool-action], form[action]'));

  let hasChromeBuiltInAI = false;
  try {
    const hasAIObject = !!(
      (win.ai &&
        (win.ai.languageModel || win.ai.assistant || win.ai.summarizer || win.ai.writer || win.ai.rewriter || win.ai.translator || typeof win.ai === 'object')) ||
      win.webmcpAI ||
      win.__webmcpAI
    );
    let hasScriptMention = false;
    try {
      const scripts = doc ? Array.from(doc.querySelectorAll('script')).map((s: any) => s.textContent || '').join(' ') : '';
      hasScriptMention = /(?:window\.)?ai\.(?:languageModel|assistant|summarizer|writer|rewriter|translator)|LanguageModel\.(?:create|capabilities|availability)|['"]LanguageModel['"]\s+in\s+(?:self|window)|Chrome\s+(?:Prompt\s+API|Built-in\s+AI)|prompt-api/i.test(scripts);
    } catch {}

    hasChromeBuiltInAI = hasAIObject || hasScriptMention;
  } catch {}

  let metaRobotsBlocking = false;
  try {
    const metaRobots = doc?.querySelector('meta[name="robots" i], meta[name="googlebot" i]');
    if (metaRobots) {
      const content = (metaRobots.getAttribute('content') || '').toLowerCase();
      if (content.includes('noindex') || content.includes('noai') || content.includes('none')) {
        metaRobotsBlocking = true;
      }
    }
  } catch {}

  let hasAgentInvokedOrHumanInLoop = false;
  try {
    const hasConfirmationHint = sanitizedTools.some((t: any) => t?.annotations?.confirmationHint === true) || declarativeTools.some((t: any) => t?.annotations?.confirmationHint === true);
    const hasAgentInvokedAttr = !!(doc?.querySelector('[agentinvoked], [data-agent-invoked], [human-in-the-loop], [data-human-in-the-loop]'));
    let hasScriptMention = false;
    try {
      const scripts = doc ? Array.from(doc.querySelectorAll('script')).map((s: any) => s.textContent || '').join(' ') : '';
      hasScriptMention = /agentinvoked|humaninloop|human-in-loop|confirmationhint/i.test(scripts);
    } catch {}
    hasAgentInvokedOrHumanInLoop = hasConfirmationHint || hasAgentInvokedAttr || hasScriptMention || !!win.__webmcp_agent_invoked;
  } catch {}

  return {
    hasNavigatorModelContext: hasImperativeModelContext,
    hasDocumentModelContext: hasNativeDoc && !isBridgeInjected,
    hasOriginTrial,
    hasHtmlForms,
    hasToolNameAttribute,
    hasToolDescriptionAttribute,
    hasToolActionAttribute,
    hasChromeBuiltInAI,
    hasAgentInvokedOrHumanInLoop,
    metaRobotsBlocking,
    rawTools: siteActivelyRegistered ? sanitizedTools : [],
    declarative: {
      webmcpVersion,
      manifestLinks,
      helpLinks,
      originTrialTokens,
      declarativeTools,
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
