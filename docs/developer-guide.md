# WebMCP Developer Guide & SDK / CLI Reference

> **The definitive engineering guide for scanning, linting, scoring, and integrating WebMCP implementations on modern web applications.**

🌐 **Official Portal & Web Scanner:** [https://webmcpworld.com](https://webmcpworld.com/)  
📦 **npm Packages:** [`webmcp-validator-sdk`](https://www.npmjs.com/package/webmcp-validator-sdk) | [`webmcp-validator-cli`](https://www.npmjs.com/package/webmcp-validator-cli) | [`@webmcp-validator/core`](https://www.npmjs.com/package/@webmcp-validator/core)  
💻 **Repository:** [`github.com/ibsoftssocial/webmcp-validator-sdk`](https://github.com/ibsoftssocial/webmcp-validator-sdk)  
📄 **License:** MIT © 2026

[![npm version](https://img.shields.io/npm/v/webmcp-validator-sdk.svg?color=blue)](https://www.npmjs.com/package/webmcp-validator-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![W3C WebMCP Draft](https://img.shields.io/badge/W3C-WebMCP_Draft-purple)](https://webmachinelearning.github.io/webmcp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

## 📖 Table of Contents

1. [Introduction to WebMCP](#1-introduction-to-webmcp)
2. [Ecosystem Architecture](#2-ecosystem-architecture)
3. [Quick Start (60 Seconds)](#3-quick-start-60-seconds)
4. [CLI Guide (`webmcp-validator-cli`)](#4-cli-guide-webmcp-validator-cli)
   - [Installation Options](#installation-options)
   - [Single-URL Auditing (`scan`)](#single-url-auditing-scan)
   - [Batch & Sitemap Auditing (`batch`)](#batch--sitemap-auditing-batch)
   - [CI/CD Quality Gating (`--fail-under`)](#cicd-quality-gating---fail-under)
   - [Export Formats & Outputs](#export-formats--outputs)
5. [Programmatic SDK Guide (`webmcp-validator-sdk`)](#5-programmatic-sdk-guide-webmcp-validator-sdk)
   - [Installation & Setup](#installation--setup)
   - [One-Line Full Audit API (`WebMCPValidator.audit`)](#one-line-full-audit-api-webmcpvalidatoraudit)
   - [Modular Step-by-Step Pipeline (`scan` → `lint` → `score`)](#modular-step-by-step-pipeline-scan--lint--score)
   - [Custom Configurations & Weight Overrides](#custom-configurations--weight-overrides)
   - [Site-Wide Batch & Sitemap Auditing](#site-wide-batch--sitemap-auditing)
   - [In-Memory & File Export APIs](#in-memory--file-export-apis)
   - [Full TypeScript Type Reference](#full-typescript-type-reference)
6. [Production Integration Recipes](#6-production-integration-recipes)
   - [Recipe 1: Next.js / Express API Route](#recipe-1-nextjs--express-api-route)
   - [Recipe 2: GitHub Actions Automated PR Gating](#recipe-2-github-actions-automated-pr-gating)
   - [Recipe 3: Slack / Discord Webhook Notifications](#recipe-3-slack--discord-webhook-notifications)
   - [Recipe 4: Pre-Commit Git Hook](#recipe-4-pre-commit-git-hook)
7. [WebMCP Compliance Checklist (Achieving Grade A)](#7-webmcp-compliance-checklist-achieving-grade-a)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Introduction to WebMCP

As Autonomous AI Agents (such as Google Gemini, Claude, and OpenAI Operator) and web copilots interact with the open web, traditional brittle DOM scraping fails. 

The **W3C WebMCP (Web Model Context Protocol)** specification standardizes how web applications expose structured, discoverable, and safe executable capabilities to AI agents:
* **Declarative HTML Annotations:** HTML `<form>` elements equipped with `toolname`, `tooldescription`, and `toolaction` attributes.
* **Imperative JavaScript APIs:** `navigator.modelContext.registerTool(...)` permitting client-side single-page applications (SPAs) to register tools at runtime.
* **Agent Directives & Discovery:** Standardized manifests (`/.well-known/webmcp`), `/llms.txt`, and `/robots.txt` directives.
* **Built-in Browser AI:** Client-side Gemini Nano Prompt API integrations via `window.ai`.

The **WebMCP Validator Toolkit** is the official testing and compliance harness. It provides automated headless browser discovery, 11 deterministic linter rules, a 100-point 6-category readiness scoring model, and enterprise CI/CD exporters.

---

## 2. Ecosystem Architecture

```mermaid
flowchart TD
    Target["Target Web Application\n(Localhost, Staging, or Production)"] --> Discovery

    subgraph Scanner ["1. Discovery & Scanner Engine"]
        Discovery["Headless Chromium (Playwright)\nMulti-Source Discovery Engine"]
        Discovery --> S1["Imperative JS API\n(navigator.modelContext)"]
        Discovery --> S2["Declarative HTML\n(Forms, toolname, toolaction)"]
        Discovery --> S3["Discovery Manifests\n(/.well-known/webmcp)"]
        Discovery --> S4["Agent Directives\n(/robots.txt, /llms.txt)"]
        Discovery --> S5["Chrome Built-in AI\n(window.ai Prompt API)"]
    end

    Scanner --> LintEngine

    subgraph Linter ["2. Deterministic Linter Engine"]
        LintEngine["Rule Registry (11 Built-in Rules)"]
        LintEngine --> R1["Implementation: IMP-001, IMP-002"]
        LintEngine --> R2["Tool Quality: TQ-001, TQ-002, TQ-003"]
        LintEngine --> R3["Best Practices: BP-001, BP-002"]
        LintEngine --> R4["Security & Safety: SEC-001, SEC-002"]
        LintEngine --> R5["Discoverability: DISC-001, DISC-002"]
    end

    Linter --> ScoreEngine

    subgraph Scorer ["3. AI Readiness Scorer"]
        ScoreEngine["Weighted Readiness Formula\n(100 Points Rubric)"]
        ScoreEngine --> C1["Declarative (28%)"]
        ScoreEngine --> C2["Infrastructure (20%)"]
        ScoreEngine --> C3["Agent Access (20%)"]
        ScoreEngine --> C4["Imperative (12%)"]
        ScoreEngine --> C5["Discovery (10%)"]
        ScoreEngine --> C6["Chrome AI (10%)"]
    end

    Scorer --> Reporters

    subgraph Reporters ["4. Multi-Format Exporters"]
        Reporters --> Out1["Pretty Terminal Diagnostic Table"]
        Reporters --> Out2["Interactive HTML Dashboard"]
        Reporters --> Out3["Raw JSON Data"]
        Reporters --> Out4["PR Markdown Summary"]
        Reporters --> Out5["OASIS SARIF 2.1.0 (GitHub CodeQL)"]
        Reporters --> Out6["JUnit XML (CI Test Tabs)"]
    end
```

---

## 3. Quick Start (60 Seconds)

### Run with Zero Installation (`npx`)
Run an instant audit against any public or local website:

```bash
npx webmcp-validator-cli scan https://webmcpworld.com
```

### Install in your Node.js Project (`npm`)
```bash
npm install webmcp-validator-sdk
```

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('https://webmcpworld.com');

console.log(`Score: ${report.overallScore}/100 [Grade ${report.grade}]`);
console.log(`Tools Found: ${report.toolCount}`);
console.log(`Passed: ${report.passed}`);
```

---

## 4. CLI Guide (`webmcp-validator-cli`)

### Installation Options

#### Option A: Run via `npx` (No installation needed)
```bash
npx webmcp-validator-cli scan <url>
```

#### Option B: Install Globally
```bash
npm install -g webmcp-validator-cli
```
Once installed globally, both `webmcp` and `webmcp-validator` binary aliases are available:
```bash
webmcp --version
# Output: 0.1.1
```

---

### Single-URL Auditing (`scan`)

```bash
# Standard interactive audit
webmcp scan https://webmcpworld.com

# Audit local development server
webmcp scan http://localhost:3000

# Audit with mobile viewport and user-agent emulation
webmcp scan https://example.com --mobile

# Speed up scans by blocking image, font, and media asset downloads
webmcp scan https://example.com --block-media

# Set custom navigation timeout (in milliseconds)
webmcp scan https://example.com --timeout 30000
```

---

### Batch & Sitemap Auditing (`batch`)

Audit multiple URLs concurrently or crawl an entire website via XML sitemap:

```bash
# 1. Audit multiple explicit URLs
webmcp batch https://example.com https://example.com/pricing https://example.com/docs

# 2. Crawl and audit an entire website via XML sitemap
webmcp batch --sitemap https://example.com/sitemap.xml --concurrency 4 --limit 25

# 3. Read target URLs from a plain-text file (one URL per line)
webmcp batch -f urls.txt --concurrency 5 -o site-audit.html
```

#### Batch CLI Flags Reference:
| Flag | Description | Default |
|---|---|---|
| `--sitemap <url>` | Discover URLs dynamically from an XML sitemap or sitemap index | `undefined` |
| `-f, --file <path>` | Read URLs from a line-delimited text file | `undefined` |
| `-c, --concurrency <number>` | Maximum number of concurrent browser instances | `3` |
| `-l, --limit <number>` | Maximum number of URLs to crawl from sitemap | `25` |
| `--fail-under <score>` | Fail entire batch run if site-wide average score is below threshold | `undefined` |

---

### CI/CD Quality Gating (`--fail-under`)

Integrate WebMCP audits directly into continuous deployment gates:

```bash
# Exits with Code 0 if Score >= 80; Exits with Code 1 if Score < 80
webmcp scan https://example.com --fail-under 80

# Enforce strict enterprise Grade A compliance (Score >= 90)
webmcp scan http://localhost:3000 --fail-under 90
```

#### Exit Codes:
* **`0`:** Scan completed successfully and score satisfies `--fail-under` requirement (or no threshold set).
* **`1`:** Score is strictly below `--fail-under` threshold, or an unrecoverable execution error occurred.

---

### Export Formats & Outputs

Generate self-contained reports in multiple formats using `--format <type>` or by specifying file extension with `-o <file>`:

```bash
# Save standalone interactive HTML report
webmcp scan https://example.com -o reports/audit.html

# Save OASIS SARIF v2.1.0 for GitHub Security Code Scanning tab
webmcp scan https://example.com --format sarif -o results.sarif

# Save JUnit XML for GitLab CI or CircleCI Test Summary tabs
webmcp scan https://example.com --format junit -o junit.xml

# Output raw JSON to stdout for jq or pipeline ingestion
webmcp scan https://example.com --format json > audit.json
```

| Format | Output Flag | Target Output | Primary Use Case |
|---|---|---|---|
| `pretty` | `--format pretty` (default) | stdout | Interactive terminal inspection |
| `html` | `-o audit.html` | File | Visual stakeholder dashboard |
| `json` | `--format json` | stdout / File | Automated pipeline processing |
| `markdown` | `--format markdown` | stdout / File | Pull request descriptions & comments |
| `sarif` | `--format sarif` | File | GitHub Security Code Scanning alerts |
| `junit` | `--format junit` | File | CI test runner summary reporting |

---

## 5. Programmatic SDK Guide (`webmcp-validator-sdk`)

The SDK provides direct TypeScript and Node.js programmatic APIs for custom developer platforms, synthetic monitoring, and test suites.

### Installation & Setup

```bash
npm install webmcp-validator-sdk
```

Ensure your `package.json` specifies `"type": "module"` (ESM), or import in TypeScript:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';
```

---

### One-Line Full Audit API (`WebMCPValidator.audit`)

The fastest way to scan, lint, and score an endpoint:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

async function runAudit() {
  const report = await WebMCPValidator.audit('https://webmcpworld.com', {
    // Optional configuration
    scanner: {
      headless: true,
      timeoutMs: 20000,
      isMobile: false,
      blockMedia: true,
    },
    scorer: {
      passingScore: 80,
    },
  });

  console.log(`URL:           ${report.url}`);
  console.log(`Overall Score: ${report.overallScore}/100`);
  console.log(`Grade:         ${report.grade}`);
  console.log(`Passed:        ${report.passed}`);
  console.log(`Total Tools:   ${report.toolCount}`);
  
  // Category Breakdown
  for (const [category, data] of Object.entries(report.categories)) {
    console.log(` - ${category}: ${data.score}/${data.maxScore} (${data.percentage}%)`);
  }
}

runAudit();
```

---

### Modular Step-by-Step Pipeline (`scan` → `lint` → `score`)

For advanced use cases (e.g., custom AST analysis, caching, or custom rules), execute each stage independently:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

async function customPipeline() {
  const targetUrl = 'https://webmcpworld.com';

  // Step 1: Headless Discovery Scan
  const detection = await WebMCPValidator.scan(targetUrl);
  console.log(`Discovered ${detection.tools.length} tool definitions`);
  console.log(`Manifest Found: ${detection.manifest.discovered}`);

  // Step 2: Deterministic Linter Evaluation
  const lintResult = await WebMCPValidator.lint(detection, {
    // Optional: filter specific rules or override severities
    rules: ['IMP-001', 'TQ-001', 'SEC-001', 'SEC-002'],
  });
  console.log(`Linter Errors: ${lintResult.summary.errors}`);
  console.log(`Linter Warnings: ${lintResult.summary.warnings}`);

  // Step 3: Calculate AI Readiness Score
  const report = WebMCPValidator.score(detection, lintResult, {
    passingScore: 85,
  });

  console.log(`Final Grade: ${report.grade} (${report.overallScore}/100)`);
}
```

---

### Custom Configurations & Weight Overrides

You can customize the 6 scoring category weights to match your organization's specific priorities (weights must sum to 100):

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('https://example.com', {
  scorer: {
    passingScore: 85,
    categoryWeights: {
      declarative: 35,          // Emphasize HTML form declarations
      infrastructure: 20,       // Latency, HTTPS, robots.txt
      'agent-access': 20,       // AI crawler policy & llms.txt
      imperative: 10,           // JS runtime API
      'discovery-manifest': 10, // /.well-known/webmcp
      'chrome-ai': 5,           // Gemini Nano Prompt API
    },
  },
  linter: {
    // Only enforce critical security and schema correctness rules
    rules: ['IMP-001', 'TQ-001', 'BP-001', 'SEC-001', 'SEC-002'],
  },
});
```

---

### Site-Wide Batch & Sitemap Auditing

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

async function auditSite() {
  // 1. Crawl sitemap URLs
  const urls = await WebMCPValidator.crawlSitemap('https://webmcpworld.com/sitemap.xml', {
    maxUrls: 20,
  });

  // 2. Execute concurrent batch audit
  const batchResult = await WebMCPValidator.batchAudit({
    urls,
    concurrency: 4,
    failUnder: 80,
  });

  console.log(`Total Pages Scanned: ${batchResult.totalUrls}`);
  console.log(`Average Site Score:  ${batchResult.averageScore}/100 (Grade ${batchResult.overallGrade})`);
  console.log(`Successful Scans:    ${batchResult.successfulAudits}`);
  console.log(`Failed Pages:        ${batchResult.failedAudits}`);

  // 3. Save batch summary HTML dashboard
  await WebMCPValidator.saveBatchReport(batchResult, './reports/site-summary.html', {
    format: 'html',
  });
}
```

---

### In-Memory & File Export APIs

The SDK allows rendering report strings in memory or writing formatted reports directly to the local filesystem:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('https://webmcpworld.com');

// 1. Generate formatted strings in-memory
const jsonString     = WebMCPValidator.generateReport(report, 'json');
const markdownString = WebMCPValidator.generateReport(report, 'markdown');
const htmlString     = WebMCPValidator.generateReport(report, 'html');
const sarifString    = WebMCPValidator.generateReport(report, 'sarif');
const junitString    = WebMCPValidator.generateReport(report, 'junit');

// 2. Save directly to files on disk (creates directories automatically)
await WebMCPValidator.saveReport(report, './dist/reports/audit.html');
await WebMCPValidator.saveReport(report, './dist/reports/audit.sarif');
await WebMCPValidator.saveReport(report, './dist/reports/junit.xml');
```

---

### Full TypeScript Type Reference

```typescript
export interface WebMCPReadinessReport {
  /** Target URL audited */
  url: string;
  /** ISO timestamp of audit execution */
  timestamp: string;
  /** Overall readiness score from 0 to 100 */
  overallScore: number;
  /** Letter grade rating: 'A' | 'B' | 'C' | 'D' | 'F' */
  grade: GradeRating;
  /** Boolean indicating whether overallScore satisfies passing threshold */
  passed: boolean;
  /** Minimum passing score threshold */
  passThreshold: number;
  /** Total WebMCP tools discovered across all sources */
  toolCount: number;
  /** 6-category weighted score breakdown */
  categories: Record<ReadinessCategory, CategoryScore>;
  /** Diagnostic checklist criteria items evaluated */
  checklist: ChecklistItem[];
  /** Linter findings summary and evaluation records */
  lintSummary: LintSummary;
  /** Discovered tool definitions */
  tools: ToolDeclaration[];
  /** Execution elapsed time in milliseconds */
  durationMs: number;
}

export type GradeRating = 'A' | 'B' | 'C' | 'D' | 'F';

export type ReadinessCategory =
  | 'declarative'
  | 'infrastructure'
  | 'agent-access'
  | 'imperative'
  | 'discovery-manifest'
  | 'chrome-ai';

export interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
  percentage: number;
  errors: number;
  warnings: number;
  info: number;
}
```

---

## 6. Production Integration Recipes

### Recipe 1: Next.js / Express API Route
Build an on-demand audit microservice:

```typescript
// app/api/audit/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import { WebMCPValidator } from 'webmcp-validator-sdk';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    const report = await WebMCPValidator.audit(url, {
      scanner: { timeoutMs: 15000, blockMedia: true },
    });

    return NextResponse.json({
      url: report.url,
      score: report.overallScore,
      grade: report.grade,
      passed: report.passed,
      toolCount: report.toolCount,
      categories: report.categories,
      findings: report.lintSummary.findings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### Recipe 2: GitHub Actions Automated PR Gating
Create `.github/workflows/webmcp-audit.yml` to automatically scan your staging environment on every Pull Request:

```yaml
name: WebMCP Quality Gate

on:
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Run WebMCP Audit (PR Gate)
        run: |
          npx webmcp-validator-cli scan https://staging.example.com \
            --fail-under 80 \
            --format markdown \
            -o ./audit.md \
            --format sarif \
            -o ./results.sarif

      - name: Publish Summary to PR
        if: always()
        run: cat ./audit.md >> $GITHUB_STEP_SUMMARY

      - name: Upload Security Alerts to GitHub Security Tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
```

---

### Recipe 3: Slack / Discord Webhook Notifications
Trigger team alerts when compliance drops:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

async function monitorAndAlert() {
  const target = 'https://example.com';
  const report = await WebMCPValidator.audit(target);

  if (!report.passed || report.overallScore < 80) {
    const message = {
      text: `🚨 *WebMCP AI Readiness Alert for ${target}*`,
      attachments: [
        {
          color: '#e53e3e',
          fields: [
            { title: 'Score', value: `${report.overallScore}/100`, short: true },
            { title: 'Grade', value: `Grade ${report.grade}`, short: true },
            { title: 'Tools Detected', value: `${report.toolCount}`, short: true },
            { title: 'Linter Errors', value: `${report.lintSummary.errors}`, short: true },
          ],
        },
      ],
    };

    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }
}
```

---

### Recipe 4: Pre-Commit Git Hook
Enforce tool declaration standards before code is committed using `husky`:

```bash
# .husky/pre-commit
#!/bin/sh
npx webmcp-validator-cli scan http://localhost:3000 --fail-under 85
```

---

## 7. WebMCP Compliance Checklist (Achieving Grade A)

To earn an **Overall Score ≥ 90 / Grade A**, ensure your website meets the criteria below:

### 1. Declarative Markup (28 pts)
* [ ] HTML `<form>` elements define `toolname="unique_tool_name"`.
* [ ] Each form defines an informative `tooldescription="Action description explaining purpose to AI agents"`.
* [ ] Form specifies valid `toolaction="create" | "read" | "update" | "delete"`.
* [ ] Form inputs include descriptive `name`, `type`, and `placeholder` attributes.

### 2. Infrastructure & Performance (20 pts)
* [ ] Site served strictly over HTTPS.
* [ ] Initial response time < 1,500ms.
* [ ] Server responds with HTTP 200 OK.
* [ ] `/robots.txt` present and accessible.
* [ ] `/sitemap.xml` present and lists public URLs.

### 3. Agent Access & Directives (20 pts)
* [ ] AI user-agents (`GPTBot`, `ClaudeBot`, `Google-Extended`) not blocked in `robots.txt`.
* [ ] `/llms.txt` directives file present at domain root describing site content for language models.
* [ ] `X-Robots-Tag` and `<meta name="robots">` permit automated indexation.

### 4. Imperative JavaScript API (12 pts)
* [ ] `navigator.modelContext` or `document.modelContext` available in browser runtime.
* [ ] Tools registered using `modelContext.registerTool({ name, description, parameters, execute })`.
* [ ] Mutating tools annotate `consequentialHint: true` and implement confirmation safeguards.

### 5. Discovery Manifest (10 pts)
* [ ] Domain hosts `/.well-known/webmcp` (or linked via `<link rel="model-context" href="/manifest.json">`).
* [ ] Manifest payload adheres to valid JSON Schema containing tool metadata and endpoints.

### 6. Chrome Built-in AI (10 pts)
* [ ] Client application integrates or supports Chrome Built-in AI Gemini Nano Prompt API (`window.ai.languageModel`).

---

## 8. Troubleshooting & FAQ

#### Q: Why does `npx webmcp-validator` fail with a 404 error?
**A:** On npm, the published package is named `webmcp-validator-cli`. Run:
```bash
npx webmcp-validator-cli scan <url>
```
If installed globally (`npm install -g webmcp-validator-cli`), both `webmcp` and `webmcp-validator` work directly.

#### Q: How do I run audits on headless Linux servers / Docker?
**A:** Playwright requires system browser dependencies. Run:
```bash
npx playwright install --with-deps chromium
```

#### Q: How do I audit client-side Single Page Applications (React, Vue, Next.js)?
**A:** The validator executes in real headless Chromium and waits for network idle and DOM hydration. If your app loads tools asynchronously, increase the timeout:
```bash
webmcp scan http://localhost:3000 --timeout 20000
```

#### Q: Can I audit authenticated pages behind logins?
**A:** Yes, with the programmatic SDK, you can launch a custom browser context, inject auth cookies/headers, and pass the active target to `WebMCPValidator.scan()`.

---

## 🤝 Community & Support

* **Official Website:** [https://webmcpworld.com](https://webmcpworld.com)
* **Bug Tracker & Feature Requests:** [GitHub Issues](https://github.com/ibsoftssocial/webmcp-validator-sdk/issues)
* **W3C WebMCP Discussion:** [WebMachineLearning / WebMCP](https://webmachinelearning.github.io/webmcp/)
