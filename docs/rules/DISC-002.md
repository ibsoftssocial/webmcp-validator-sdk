# DISC-002: Agent Directives (llms.txt & robots.txt)

- **Category:** `discoverability`
- **Default Severity:** `warning` (for blocking crawler directives) / `info` (for missing `llms.txt`)
- **Penalty Points:** 5
- **Scope:** Page-level / Host-level
- **Specification:** [llmstxt.org Standard](https://llmstxt.org/) & [RFC 9309 Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)

---

## Overview

Modern web agents and AI search indexing crawlers rely on site-level directives to discover public documentation, tool guides, and API endpoints, while respecting site access boundaries:

1. **/llms.txt:** A Markdown-formatted document residing at `https://example.com/llms.txt` designed specifically to provide concise site maps, documentation links, and tool summaries for LLMs.
2. **/robots.txt:** The exclusion file governing bot traffic. When building public WebMCP tools for agents, blocking prominent AI user agents prevents them from finding or interacting with the tools.

---

## Failure Conditions

1. **Blocking AI Crawlers (`warning`):** `robots.txt` explicitly disallows reputable AI crawlers (such as `GPTBot`, `ClaudeBot`, `PerplexityBot`, or wildcard `User-agent: * Disallow: /`) when the site intends to expose public agent tools.
2. **Missing `llms.txt` (`info`):** The host lacks an `/llms.txt` file at the domain root.

### ❌ Non-Compliant Examples

```txt
# robots.txt blocking AI bots completely from finding WebMCP tools
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /
```

---

## Remediation

1. Allow authorized AI agent user agents in `robots.txt` to access public tool manifest routes:
   ```txt
   User-agent: GPTBot
   Allow: /.well-known/
   Allow: /llms.txt

   User-agent: ClaudeBot
   Allow: /.well-known/
   Allow: /llms.txt
   ```
2. Provide a clean `/llms.txt` at the root of your domain:
   ```markdown
   # Acme Corp

   > AI-ready API and WebMCP service endpoints.

   ## Tools & APIs
   - [WebMCP Manifest](/.well-known/mcp.json): Machine-readable tool specifications
   - [API Reference](/docs/api): Full documentation
   ```
