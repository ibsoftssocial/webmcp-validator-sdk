# webmcp-validator-cli

The official command-line interface for the WebMCP Validator ecosystem. Scan local or public websites, lint WebMCP tool declarations, enforce quality thresholds in CI/CD pipelines, and export audit reports.

🌐 **Official Website:** [https://webmcpworld.com](https://webmcpworld.com/)

[![CLI](https://img.shields.io/badge/CLI-webmcp--validator--cli-orange.svg)](https://npmjs.com/package/webmcp-validator-cli)
[![Website](https://img.shields.io/badge/Website-webmcpworld.com-007acc?style=flat)](https://webmcpworld.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

---

## 🚀 Installation & Execution

Run directly via `npx` without installation:

```bash
npx webmcp-validator-cli scan https://example.com
```

Or install globally:

```bash
npm install -g webmcp-validator-cli

# Run using either binary name:
webmcp-validator scan https://example.com
webmcp scan https://example.com
```

---

## 🛠️ Commands & Usage

### 1. Single Page Audit (`scan`)

```bash
# Standard interactive audit
npx webmcp-validator-cli scan https://example.com

# Audit local development server
npx webmcp-validator-cli scan http://localhost:3000

# CI/CD failure gating (exits 1 if score < 80)
npx webmcp-validator-cli scan http://localhost:3000 --fail-under 80

# Emulate mobile viewport & user agent
npx webmcp-validator-cli scan https://example.com --mobile
```

### 2. Multi-Page & Sitemap Batch Auditing (`batch`)

```bash
# Audit multiple specific URLs
npx webmcp-validator-cli batch https://example.com https://example.com/docs https://example.com/api

# Audit entire website via XML sitemap
npx webmcp-validator-cli batch --sitemap https://example.com/sitemap.xml --concurrency 4

# Read URL list from a text file
npx webmcp-validator-cli batch -f urls.txt -o batch-report.html
```

---

## 📊 Export Formats & Output Options

Export reports in various formats using `--format <type>` or by specifying file extension with `-o <file>`:

| Format Flag | Output Target | Typical Use Case |
|---|---|---|
| `--format pretty` (default) | Terminal stdout | Interactive developer inspection |
| `--format json` | Terminal stdout or file | Programmatic post-processing |
| `--format markdown` | Terminal stdout or file | Pull Request descriptions & comments |
| `--format html` | File (`-o report.html`) | Interactive, standalone visual dashboard |
| `--format sarif` | File (`-o results.sarif`) | GitHub Code Scanning Security Alerts |
| `--format junit` | File (`-o junit.xml`) | CI/CD Native Test Summary tabs |

### Export Examples

```bash
# Export interactive HTML report
npx webmcp-validator-cli scan https://example.com -o reports/audit.html

# Export SARIF for GitHub Security tab
npx webmcp-validator-cli scan https://example.com --format sarif -o results.sarif

# Export batch HTML summary
npx webmcp-validator-cli batch --sitemap https://example.com/sitemap.xml -o site-audit.html
```

---

## 🚦 Exit Codes for CI/CD

- **`0`:** Scan succeeded and AI readiness score satisfies `--fail-under` requirement (or no threshold set).
- **`1`:** Score is below `--fail-under` threshold, or a fatal network/execution error occurred.

---

## 📄 License

MIT © 2026
