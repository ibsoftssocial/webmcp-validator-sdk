# WebMCP Linter Rule Registry & Catalog

Welcome to the **WebMCP Linter Rule Catalog**. The WebMCP Validator SDK includes a deterministic static and dynamic linting engine that evaluates tool registrations, declarative markup, manifests, crawler access, and AI security annotations against the [W3C WebMCP Draft Specification](https://webmachinelearning.github.io/webmcp/).

---

## 📊 Rule Summary by Readiness Category

| Category | Primary Weight | Description | Rules Included |
|---|---|---|---|
| **Implementation** / Imperative | **30% / 12%** | API availability, duplicate registration prevention, context binding | [`IMP-001`](./IMP-001.md), [`IMP-002`](./IMP-002.md) |
| **Tool Quality** | **25%** | Standard naming syntax, informative descriptions, parameter explanations | [`TQ-001`](./TQ-001.md), [`TQ-002`](./TQ-002.md), [`TQ-003`](./TQ-003.md) |
| **Best Practices** / Declarative | **20% / 28%** | Valid JSON Schema type declarations, required property consistency | [`BP-001`](./BP-001.md), [`BP-002`](./BP-002.md) |
| **Security & Safety** | **15%** | Consequential mutation hints, non-contradictory safety assertions | [`SEC-001`](./SEC-001.md), [`SEC-002`](./SEC-002.md) |
| **Discoverability** / Manifest | **10% / 10%** | Static `<link rel="model-context">` tags, `llms.txt`, and crawler policy | [`DISC-001`](./DISC-001.md), [`DISC-002`](./DISC-002.md) |

---

## 📜 Complete Rule Registry

| Rule ID | Title | Category | Severity | Penalty | Scope | Summary |
|---|---|---|---|---|---|---|
| [`IMP-001`](./IMP-001.md) | WebMCP API Presence | `implementation` | `error` | 100 pts | Page | Ensures target site provides a detectable WebMCP implementation. |
| [`IMP-002`](./IMP-002.md) | Unique Tool Identifiers | `implementation` | `error` | 10 pts | Page | Prevents duplicate tool names across imperative, declarative, and manifest sources. |
| [`TQ-001`](./TQ-001.md) | Tool Name Format | `tool-quality` | `error` / `warning` | 10 pts | Tool | Enforces lowercase alphanumeric `snake_case` naming (max 64 chars). |
| [`TQ-002`](./TQ-002.md) | Tool Description Required | `tool-quality` | `error` / `warning` | 10 pts | Tool | Requires non-empty, informative tool descriptions for AI reasoning. |
| [`TQ-003`](./TQ-003.md) | Tool Parameters Described | `tool-quality` | `warning` | 5 pts | Tool | Checks that inputSchema properties have descriptive explanations. |
| [`BP-001`](./BP-001.md) | Valid Input Schema | `best-practices` | `error` | 10 pts | Tool | Enforces valid JSON Schema (`type: "object"` and matching `required` properties). |
| [`BP-002`](./BP-002.md) | Input Schema Parameter Check | `best-practices` | `info` | 2 pts | Tool | Flags zero-parameter tools to verify explicit intent. |
| [`SEC-001`](./SEC-001.md) | Mutating Tool Confirmation Hint | `security` | `warning` | 8 pts | Tool | Flags state-mutating actions missing `consequentialHint: true`. |
| [`SEC-002`](./SEC-002.md) | Conflicting Safety Annotations | `security` | `error` | 10 pts | Tool | Rejects contradictory assertions (e.g. `readOnlyHint: true` with `destructiveHint: true`). |
| [`DISC-001`](./DISC-001.md) | Declarative Manifest Link | `discoverability` | `info` | 4 pts | Page | Audits presence of `<link rel="model-context">` for zero-JS agent discovery. |
| [`DISC-002`](./DISC-002.md) | Agent Directives | `discoverability` | `warning` / `info` | 5 pts | Page | Audits presence of `/llms.txt` and permissive AI agent `robots.txt` policy. |

---

## ⚙️ Configuring Rules

You can filter or configure rules via the SDK or CLI:

### Programmatic SDK Filter
```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('https://example.com', {
  // Only execute security and tool quality rules
  rules: ['SEC-001', 'SEC-002', 'TQ-001', 'TQ-002'],
});
```

### CLI Command Options
```bash
# Ignore non-critical informational warnings
npx webmcp-validator scan https://example.com --fail-under 80
```
