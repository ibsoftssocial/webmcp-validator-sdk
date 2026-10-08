# WebMCP Validator Toolkit & CLI Monorepo

> **The enterprise-grade developer toolkit and automated auditing suite to scan, lint, score, and validate WebMCP implementations on modern websites.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-212%20passed-brightgreen.svg)](https://vitest.dev/)
[![W3C Draft](https://img.shields.io/badge/W3C-WebMCP_Draft-blue)](https://webmachinelearning.github.io/webmcp/)
[![Readiness Badge](https://img.shields.io/badge/WebMCP-Grade_A_(95)-10b981.svg)](./docs/badges.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Monorepo Packages](#-monorepo-packages)
- [Quick Start](#-quick-start)
- [CLI Scanner Usage](#-cli-scanner-usage)
- [Programmatic TypeScript SDK](#-programmatic-typescript-sdk)
- [Developer Documentation & Guides](#-developer-documentation--guides)
- [CI/CD Integration & GitHub Actions](#-cicd-integration--github-actions)
- [Scoring Model & Grades](#-scoring-model--grades)
- [Built-in Rule Catalog](#-built-in-rule-catalog)
- [Embeddable SVG Readiness Badges](#-embeddable-svg-readiness-badges)
- [License](#-license)

---

## 🌟 Overview

As AI agents and web copilots proliferate, websites must expose structured, secure, and discoverable interfaces. The **WebMCP Validator Toolkit** bridges the gap between web applications and AI agents by providing:

1. **Deep Runtime Discovery:** Discovers WebMCP tools exposed across `navigator.modelContext`, declarative HTML `<form>` attributes, `<link rel="model-context">` manifests, `/llms.txt`, and `/robots.txt`.
2. **Deterministic Linter Engine:** Evaluates tool quality, JSON schema consistency, and safety hints (e.g. human-in-the-loop safeguards for mutating operations).
3. **Multi-Format Export & Reporting:** Interactive terminal tables, raw JSON, PR Markdown summaries, standalone self-contained HTML dashboards, OASIS SARIF 2.1.0 for GitHub Security scanning, JUnit XML for CI/CD test runners, and Shields-compatible SVG badges.
4. **Site-Wide Batch Auditing:** Concurrently audits hundreds of URLs via XML sitemaps or URL lists.

---

## 📦 Monorepo Packages

| Package | Version | Description | Documentation |
|---|---|---|---|
| [`webmcp-validator-sdk`](./packages/sdk) | `0.1.0` | Programmatic Node.js / TypeScript SDK API | [SDK README](./packages/sdk/README.md) |
| [`webmcp-validator-cli`](./packages/cli) | `0.1.0` | Command-line scanner and CI/CD gating executable | [CLI README](./packages/cli/README.md) |
| [`@webmcp-validator/core`](./packages/core) | `0.1.0` | Core headless browser scanner, rules, and scoring engine | [Core README](./packages/core/README.md) |

---

## 🚀 Quick Start

### Installation

Clone the repository and build the workspace:

```bash
git clone https://github.com/ibsoftssocial/webmcp-validator-sdk.git
cd webmcp-validator-sdk

# Install dependencies and build packages
npm install
npm run build

# Run comprehensive test suite (212+ unit & integration tests)
npm test
```

---

## 🛠️ CLI Scanner Usage

Run audits directly with zero installation via `npx`:

```bash
# Audit any website for WebMCP readiness
npx webmcp-validator scan https://example.com

# Audit local development server with CI failure threshold
npx webmcp-validator scan http://localhost:3000 --fail-under 80

# Export interactive standalone HTML report
npx webmcp-validator scan https://example.com -o reports/audit.html

# Audit an entire website via XML sitemap with 4 concurrent workers
npx webmcp-validator batch --sitemap https://example.com/sitemap.xml --concurrency 4 -o site-audit.html

# Generate an embeddable SVG readiness badge
npx webmcp-validator scan https://example.com --format badge -o badges/readiness.svg
```

---

## 💻 Programmatic TypeScript SDK

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

// Single URL Audit
const report = await WebMCPValidator.audit('https://example.com', {
  passingScore: 80,
  timeoutMs: 15000,
});

console.log(`Readiness Score: ${report.overallScore}/100 (Grade ${report.grade})`);
console.log(`Tools Found: ${report.toolCount}`);

// Save embeddable SVG badge to disk
await WebMCPValidator.saveBadge(report, './badge.svg', {
  type: 'combined', // 'combined' | 'grade' | 'score' | 'compact'
  label: 'WebMCP',
  style: 'flat',
});

// Site-Wide Sitemap Audit
const batchResult = await WebMCPValidator.auditSitemap('https://example.com/sitemap.xml', {
  concurrency: 5,
  maxUrls: 50,
});

console.log(`Average Score: ${batchResult.averageScore}/100 (Grade ${batchResult.overallGrade})`);
```

---

## 📚 Developer Documentation & Guides

| Guide | Description |
|---|---|
| [**Linter Rules Catalog**](./docs/rules/README.md) | Complete registry of all 11 built-in rules with code examples and remediations. |
| [**Scoring Model & Grading**](./docs/scoring-model.md) | In-depth breakdown of the 6 readiness categories, weights, checklists, and grades. |
| [**CI/CD Integration Guide**](./docs/ci-cd-integration.md) | Step-by-step guides for GitHub Actions, GitLab CI, SARIF code scanning, and PR gating. |
| [**SVG Readiness Badges**](./docs/badges.md) | Guide to generating, styling, and embedding vector readiness badges in READMEs. |

---

## 🤖 CI/CD Integration & GitHub Actions

Automate audits on every pull request using the official composite action:

```yaml
name: WebMCP AI Readiness Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Audit Website
        uses: ibsoftssocial/webmcp-validator-sdk@main
        with:
          url: 'https://staging.example.com'
          fail-under: '80'
          format: 'pretty'
```

---

## 📊 Scoring Model & Grades

The validator assigns a score from `0` to `100` and an alphabetical grade:

| Grade | Score Range | Status | Badge Color |
|---|---|---|---|
| **A** | `90 - 100` | **Production Ready** — Exemplary AI tool discoverability & safety | `#10b981` (Emerald) |
| **B** | `80 - 89` | **Passing** — Complies with all core WebMCP standards | `#3b82f6` (Blue) |
| **C** | `70 - 79` | **Moderate** — Missing optional directives or metadata | `#f59e0b` (Amber) |
| **D** | `60 - 69` | **Poor** — Significant gaps in tool quality or schemas | `#ec4899` (Pink) |
| **F** | `0 - 59` | **Failing** — Unusable or blocking for AI agents | `#ef4444` (Red) |

Read the full [Scoring Model Guide](./docs/scoring-model.md) for category weight breakdowns.

---

## 📜 Built-in Rule Catalog

| Rule ID | Category | Severity | Description |
|---|---|---|---|
| [`IMP-001`](./docs/rules/IMP-001.md) | `implementation` | `error` | WebMCP API Presence |
| [`IMP-002`](./docs/rules/IMP-002.md) | `implementation` | `error` | Unique Tool Identifiers across sources |
| [`TQ-001`](./docs/rules/TQ-001.md) | `tool-quality` | `error`/`warning` | Tool Name Syntax & snake_case casing |
| [`TQ-002`](./docs/rules/TQ-002.md) | `tool-quality` | `error`/`warning` | Informative Tool Description Required |
| [`TQ-003`](./docs/rules/TQ-003.md) | `tool-quality` | `warning` | Tool Parameters Described |
| [`BP-001`](./docs/rules/BP-001.md) | `best-practices` | `error` | Valid JSON Schema Type & Required Fields |
| [`BP-002`](./docs/rules/BP-002.md) | `best-practices` | `info` | Zero-Parameter Tool Documentation Check |
| [`SEC-001`](./docs/rules/SEC-001.md) | `security` | `warning` | Mutating Tool Consequential Confirmation Hint |
| [`SEC-002`](./docs/rules/SEC-002.md) | `security` | `error` | Contradictory Safety Assertions Conflict |
| [`DISC-001`](./docs/rules/DISC-001.md) | `discoverability` | `info` | Declarative Manifest Link in HTML Head |
| [`DISC-002`](./docs/rules/DISC-002.md) | `discoverability` | `warning`/`info` | Agent Directives (llms.txt & robots.txt) |

Explore the [Complete Rule Catalog](./docs/rules/README.md).

---

## 🛡️ Embeddable SVG Readiness Badges

Showcase your site's AI readiness in your project documentation:

```markdown
<!-- Standard Combined Badge -->
[![WebMCP Readiness](https://example.com/badges/readiness.svg)](https://example.com)
```

Read the [Badges Guide](./docs/badges.md) for customization options.

---

## 📄 License

MIT © 2026
