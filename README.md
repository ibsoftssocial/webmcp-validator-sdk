# WebMCP Validator Toolkit & CLI Monorepo

> **A developer toolkit and SDK to scan, audit, discover, and validate WebMCP implementations on websites.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-yellow.svg)](https://vitest.dev/)
[![W3C Draft](https://img.shields.io/badge/W3C-WebMCP_Draft-blue)](https://webmachinelearning.github.io/webmcp/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

---

## 📦 Monorepo Packages

| Package | Version | Description |
|---|---|---|
| [`webmcp-validator-sdk`](./packages/sdk) | `0.1.0` | Programmatic Node.js / TypeScript SDK API (`WebMCPValidator.audit(...)`) |
| [`webmcp-validator-cli`](./packages/cli) | `0.1.0` | Command-line scanner and reporter executable (`npx webmcp-validator scan <url>`) |
| [`@webmcp-validator/core`](./packages/core) | `0.1.0` | Core engine, Zod types, schema validation, and deterministic scoring algorithm |

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/ibsoftssocial/webmcp-validator-sdk.git
cd webmcp-validator-sdk

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
npx webmcp-validator scan https://example.com

# Audit local development server with failure threshold for CI/CD
npx webmcp-validator scan http://localhost:3000 --fail-under=80

# Export audit to JSON report
npx webmcp-validator scan https://example.com --format=json --output=audit.json
```

---

## 💻 Programmatic SDK Usage

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('http://localhost:3000');
console.log(`Score: ${report.overallScore}/100`);
```

---

## 📄 License

MIT © 2026
