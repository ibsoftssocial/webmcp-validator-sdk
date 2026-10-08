# WebMCP Scoring Model & AI Readiness Grading

The WebMCP Validator calculates a deterministic, standardized **AI Readiness Score** (from 0 to 100) and assigns an alphabetical **Grade Rating** (`A`, `B`, `C`, `D`, `F`) based on empirical criteria defined in the W3C WebMCP draft specification.

---

## 📐 Score Calculation Formula

The overall score is a weighted aggregation across **6 readiness domains**:

$$\text{Overall Score} = \min\left(100, \max\left(0, \sum_{c \in \text{Categories}} \left( \frac{\text{Earned Points}_c}{\text{Max Points}_c} \times \text{Weight}_c \right) \right)\right)$$

Where the category weights sum exactly to 100:

| Category | Weight (%) | Description | Primary Audit Focus |
|---|---|---|---|
| **Declarative WebMCP** | `28%` | Declarative HTML markup | `toolname`, `tooldescription`, `toolaction`, `<form>` |
| **Infrastructure & Connectivity** | `20%` | Network & transport | HTTPS, HTTP 200, response time (<1500ms), `robots.txt`, `sitemap.xml` |
| **Agent Access & Permissions** | `20%` | Crawler policy & directives | AI crawler permissions, `llms.txt`, `X-Robots-Tag`, `<meta name="robots">` |
| **Imperative WebMCP API** | `12%` | JavaScript runtime API | `navigator.modelContext`, `registerTool()`, `agentInvoked` / human-in-loop |
| **Discovery Manifest** | `10%` | Agent discovery endpoints | `/.well-known/webmcp`, `/.well-known/mcp.json`, valid JSON Schema |
| **Chrome Built-in AI** | `10%` | Client-side Gemini Nano | `window.ai` / Prompt API availability |
| **Total** | **100%** | | |

---

## 🗂️ Category Checklist Breakdown

### 1. Declarative WebMCP Implementation (Weight: 28%)
- `toolname Attribute` (7 pts): Valid tool name declared on HTML element.
- `tooldescription Attribute` (7 pts): Clear semantic description declared on element.
- `toolaction Attribute` (7 pts): Declared action verb or handler attribute.
- `HTML Forms Present` (7 pts): Semantic HTML `<form>` tags present for agent inputs.

### 2. Infrastructure & Connectivity (Weight: 20%)
- `HTTPS Enabled` (4 pts): Site delivered securely over TLS/HTTPS (or localhost).
- `Fast Server Response` (4 pts): Initial response time under 1500ms.
- `robots.txt Present` (4 pts): Host provides standard `/robots.txt`.
- `sitemap.xml Present` (4 pts): Host provides `/sitemap.xml` for multi-page crawling.
- `Site Returns 200 OK` (4 pts): HTTP response code is 200.

### 3. Agent Access & Permissions (Weight: 20%)
- `AI Agents Not Blocked` (5 pts): `robots.txt` does not disallow AI agents.
- `llms.txt Present` (5 pts): Domain provides an `/llms.txt` file for agent indexing.
- `X-Robots-Tag Not Blocking` (5 pts): HTTP header does not emit `noindex` or `none` for agents.
- `Meta Robots Not Blocking` (5 pts): HTML `<meta name="robots">` does not restrict AI access.

### 4. Imperative WebMCP JavaScript API (Weight: 12%)
- `document.modelContext API` (4 pts): Browser supports or polyfills model context.
- `registerTool() Call` (4 pts): Actively registers one or more tools via JavaScript.
- `agentInvoked / Human-in-Loop` (4 pts): Configures human approval hints (`consequentialHint`, `confirmationHint`).

### 5. Discovery Manifest (Weight: 10%)
- `/.well-known/webmcp Present` (5 pts): Host provides manifest at well-known path.
- `Valid Manifest JSON` (5 pts): Well-known payload validates against WebMCP schema.

### 6. Chrome Built-in AI (Prompt API) (Weight: 10%)
- `Chrome Built-in AI (Gemini Nano)` (10 pts): Exposes `window.ai` or language model session.

---

## 🏆 Grade Thresholds & Ratings

| Grade | Score Range | Readiness Level | Default Color |
|---|---|---|---|
| **A** | `90 - 100` | **Production Ready** — Excellent AI discovery and tool safety | `#10b981` (Emerald) |
| **B** | `80 - 89` | **Passing** — Meets standard production requirements | `#3b82f6` (Blue) |
| **C** | `70 - 79` | **Moderate** — Partial implementation, missing optional directives | `#f59e0b` (Amber) |
| **D** | `60 - 69` | **Poor** — Significant gaps in tool quality or discoverability | `#ec4899` (Pink) |
| **F** | `0 - 59` | **Failing** — Unusable or blocking for autonomous AI agents | `#ef4444` (Red) |

The default passing threshold for CI/CD pipelines is **80 (Grade B)**.

---

## ⚙️ Customizing the Scoring Model

You can override weights and thresholds programmatically:

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('https://example.com', {
  passingScore: 85, // Require score of 85+ to pass
  categoryWeights: {
    'declarative': 35,
    'imperative': 25,
    'agent-access': 15,
    'infrastructure': 15,
    'discovery-manifest': 5,
    'chrome-ai': 5,
  },
});
```
