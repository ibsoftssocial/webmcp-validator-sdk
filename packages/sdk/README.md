# webmcp-validator-sdk

The official TypeScript and Node.js SDK for validating WebMCP implementations, calculating AI readiness scores, and generating continuous compliance reports.

🌐 **Official Website:** [https://webmcpworld.com](https://webmcpworld.com/)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Website](https://img.shields.io/badge/Website-webmcpworld.com-007acc?style=flat)](https://webmcpworld.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

---

## 🚀 Installation

```bash
npm install webmcp-validator-sdk
```

---

## 💡 Quick Start

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

// 1. Audit a single URL
const report = await WebMCPValidator.audit('https://example.com');

console.log(`URL: ${report.url}`);
console.log(`Score: ${report.overallScore}/100 (Grade ${report.grade})`);
console.log(`Passed: ${report.passed}`);
console.log(`Tools detected: ${report.toolCount}`);

// 2. Save interactive HTML report to disk
await WebMCPValidator.saveReport(report, './report.html', { format: 'html' });
```

---

## 🌐 Site-Wide Batch & Sitemap Auditing

Audit an array of URLs or crawl an entire XML sitemap concurrently:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

// Audit a list of URLs with concurrency control
const batchResult = await WebMCPValidator.auditBatch(
  ['https://example.com', 'https://example.com/docs', 'https://example.com/api'],
  { concurrency: 3 }
);

console.log(`Average Score: ${batchResult.averageScore} (Grade ${batchResult.overallGrade})`);
console.log(`Successful scans: ${batchResult.successCount} / ${batchResult.totalUrls}`);

// Or audit via sitemap directly
const sitemapResult = await WebMCPValidator.auditSitemap(
  'https://example.com/sitemap.xml',
  { concurrency: 5, maxUrls: 50 }
);

// Save batch report
await WebMCPValidator.saveBatchReport(sitemapResult, './site-report.html', { format: 'html' });
```

---

## ⚙️ Configuration Options

The `audit(url, options)` method accepts comprehensive options:

```typescript
const report = await WebMCPValidator.audit('https://example.com', {
  // Navigation & browser options
  headless: true,
  timeoutMs: 20000,
  mobile: false, // Emulate mobile viewport & user agent

  // Scoring thresholds
  passingScore: 85, // Default is 80

  // Category weight overrides (sums to 100)
  categoryWeights: {
    declarative: 30,
    infrastructure: 20,
    'agent-access': 20,
    imperative: 15,
    'discovery-manifest': 10,
    'chrome-ai': 5,
  },

  // Rule execution filter
  rules: ['IMP-001', 'TQ-001', 'SEC-001'],
});
```

---

## 📄 License

MIT © 2026
