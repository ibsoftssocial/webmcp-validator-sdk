# WebMCP Toolkit & CLI Monorepo

> **A developer toolkit to scan, audit, discover, and validate WebMCP implementations on websites.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-yellow.svg)](https://vitest.dev/)
[![W3C Draft](https://img.shields.io/badge/W3C-WebMCP_Draft-blue)](https://webmachinelearning.github.io/webmcp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## 📦 Monorepo Packages

| Package | Version | Description |
|---|---|---|
| [`@webmcp/core`](./packages/core) | `0.1.0` | Core engine, Zod types, schema validation, and deterministic scoring algorithm |
| [`@webmcp/sdk`](./packages/sdk) | `0.1.0` | Programmatic Node.js / TypeScript SDK API (`WebMCP.audit(...)`) |
| [`webmcp-cli`](./packages/cli) | `0.1.0` | Command-line scanner and reporter executable (`npx webmcp scan <url>`) |

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/ibsoftssocial/webmcp-sdk.git
cd webmcp-sdk

# Install dependencies
npm install

# Build all workspace packages
npm run build

# Run unit tests
npm test
```

---

## 🛠️ CLI Usage (Preview)

```bash
# Audit any website for WebMCP readiness
npx webmcp scan https://example.com

# Audit local development server with failure threshold for CI/CD
npx webmcp scan http://localhost:3000 --fail-under=80

# Export audit to JSON report
npx webmcp scan https://example.com --format=json --output=audit.json
```

---

## 📄 License

MIT © 2026
