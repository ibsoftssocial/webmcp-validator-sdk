# @webmcp-validator/core

The core engine powering the WebMCP Validator ecosystem. It provides headless browser scanning via Playwright, deterministic static and dynamic linting, multi-category readiness scoring, and versatile reporting formats (JSON, HTML, Markdown, SARIF, JUnit, SVG Badges).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

---

## 📦 Features

- **Automated WebMCP Discovery & Scanning:** Deep runtime scanning of `navigator.modelContext`, HTML `<form>` declarations, `<link rel="model-context">` manifests, `/llms.txt`, and `/robots.txt`.
- **Deterministic Linter Engine:** Extensible rule registry with 11 built-in rules auditing tool quality, schema correctness, security annotations, and crawler accessibility.
- **AI Readiness Scoring Model:** Standardized 100-point scoring model across 6 categories (Declarative, Infrastructure, Agent Access, Imperative, Manifest, Chrome AI) mapped to letter grades (A–F).
- **Multi-Format Reporting:** Generates console tables, raw JSON, GitHub Flavored Markdown, interactive single-file HTML reports, OASIS SARIF 2.1.0 (for GitHub Code Scanning), JUnit XML, and Shields-compatible SVG readiness badges.

---

## 🚀 Installation

```bash
npm install @webmcp-validator/core
```

---

## 💻 Programmatic Usage

### 1. Scanning a Page

```typescript
import { PlaywrightScanner } from '@webmcp-validator/core';

const scanner = new PlaywrightScanner({
  headless: true,
  timeoutMs: 15000,
});

const detection = await scanner.scan('https://example.com');
console.log(`Discovered ${detection.tools.length} tool(s)`);
```

### 2. Linting & Readiness Scoring

```typescript
import { WebMCPLinter, calculateReadinessScore } from '@webmcp-validator/core';

// Run linter across detected tools and page context
const linter = new WebMCPLinter();
const lintResult = linter.lint(detection);

// Calculate readiness score and assign grade
const report = calculateReadinessScore(detection, lintResult, {
  passingScore: 80,
});

console.log(`Overall Score: ${report.overallScore}/100 (Grade ${report.grade})`);
console.log(`Passed: ${report.passed}`);
```

### 3. Generating Reports & SVG Badges

```typescript
import {
  generateReport,
  generateReadinessBadge,
  saveReadinessBadgeToFile,
} from '@webmcp-validator/core';

// Export report as interactive HTML
const htmlReport = generateReport(report, { format: 'html' });

// Generate embeddable SVG readiness badge
const svg = generateReadinessBadge(report, {
  type: 'combined',
  label: 'WebMCP',
  style: 'flat',
});

// Save badge directly to file
await saveReadinessBadgeToFile(report, './badge.svg');
```

---

## 🧩 Architectural Submodules

| Submodule | Path | Description |
|---|---|---|
| **Scanner** | `src/scanner/` | Headless Playwright scanner with anti-bot resilience, retry backoff, and mobile emulation. |
| **Discovery** | `src/discovery/` | Sitemap parser, multi-source resolution, and `robots.txt` / `llms.txt` crawler checks. |
| **Linter** | `src/linter/` | Pluggable rule engine and registry with 11 built-in validation rules. |
| **Scorer** | `src/scorer/` | Weighted readiness calculation, category checklists, and grade resolution. |
| **Reporter** | `src/reporter/` | Pretty CLI tables, JSON, Markdown, standalone HTML, SARIF 2.1.0, JUnit XML, and SVG badges. |

---

## 📄 License

MIT © 2026
