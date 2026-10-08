# DISC-001: Declarative Manifest Link

- **Category:** `discoverability`
- **Default Severity:** `info`
- **Penalty Points:** 4
- **Scope:** Page-level
- **Specification:** [W3C WebMCP Discovery Draft](https://webmachinelearning.github.io/webmcp/)

---

## Overview

Static discovery allows external AI crawlers and zero-JavaScript agent scrapers to discover a site's WebMCP capabilities simply by reading the initial HTML response, without having to spin up headless Chromium or execute client scripts.

This is achieved by declaring a `<link rel="model-context" ...>` tag in the HTML `<head>`.

---

## Evaluation Condition

This rule checks whether the HTML document contains a `<link>` tag with `rel="model-context"` pointing to an MCP manifest JSON endpoint (e.g. `/.well-known/mcp.json` or `/.well-known/webmcp`).

If missing, an informational finding is raised suggesting its addition.

### ℹ️ Informational Example

```html
<!-- HTML document without static discovery link -->
<html>
<head>
  <title>Acme Services</title>
</head>
<body>
  ...
</body>
</html>
```

---

## Remediation

Add a `<link rel="model-context" ...>` element inside the `<head>` of your HTML document:

### ✅ Compliant Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Acme Services</title>
  <!-- Enables static AI agent tool discovery -->
  <link rel="model-context" type="application/json" href="/.well-known/mcp.json" />
</head>
<body>
  ...
</body>
</html>
```
