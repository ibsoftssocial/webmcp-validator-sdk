# WebMCP Embeddable SVG Readiness Badges

The WebMCP Validator SDK includes a built-in SVG badge generator compatible with the Shields.io pill design pattern. Badges are 100% self-contained vectors with crisp text rendering and color coding corresponding to audit scores and grades.

---

## 🎨 Grade Color Mapping

| Grade | Score Range | Color Hex | Sample Preview |
|---|---|---|---|
| **A** | `90 - 100` | `#10b981` (Emerald) | `WebMCP | 96/100 · Grade A` |
| **B** | `80 - 89` | `#3b82f6` (Blue) | `WebMCP | 85/100 · Grade B` |
| **C** | `70 - 79` | `#f59e0b` (Amber) | `WebMCP | 74/100 · Grade C` |
| **D** | `60 - 69` | `#ec4899` (Pink) | `WebMCP | 62/100 · Grade D` |
| **F** | `0 - 59` | `#ef4444` (Red) | `WebMCP | 45/100 · Grade F` |

---

## 🏷️ Badge Formats & Styles

### Value Display Formats (`type`)
- **`combined` (default):** Displays both score and grade, e.g., `92/100 · Grade A`
- **`grade`:** Displays only the letter grade, e.g., `Grade A`
- **`score`:** Displays numerical score only, e.g., `92/100`
- **`compact`:** Minimalist presentation, e.g., `A (92)`

### Visual Styles (`style`)
- **`flat` (default):** Modern pill style with 3px border radius.
- **`flat-square`:** Square pill style with 0px border radius.

---

## 🖥️ Generating Badges via CLI

### Single URL Audit Badge
```bash
# Export standard badge to badge.svg
npx webmcp-validator scan https://example.com --format badge -o badge.svg

# Export compact badge directly
npx webmcp-validator scan https://example.com -o readiness.svg
```

### Site-Wide Batch Badge
```bash
# Audit entire sitemap and generate site readiness badge
npx webmcp-validator batch --sitemap https://example.com/sitemap.xml --format badge -o site-readiness.svg
```

---

## 💻 Programmatic SDK Usage

```typescript
import { WebMCPValidator } from 'webmcp-validator-sdk';

const report = await WebMCPValidator.audit('https://example.com');

// 1. Generate SVG string directly
const svg = WebMCPValidator.generateBadge(report, {
  type: 'combined',
  label: 'AI Ready',
  style: 'flat',
});

// 2. Save directly to file
await WebMCPValidator.saveBadge(report, './public/webmcp-badge.svg', {
  type: 'compact',
});

// 3. Generate Markdown embedding snippet
const markdown = WebMCPValidator.generateMarkdownBadgeSnippet({
  badgePathOrUrl: './public/webmcp-badge.svg',
  targetUrl: 'https://example.com',
  altText: 'WebMCP AI Readiness Badge',
});

console.log(markdown);
// Output: [![WebMCP AI Readiness Badge](./public/webmcp-badge.svg)](https://example.com)
```

### Batch Badges via SDK
```typescript
const batchResult = await WebMCPValidator.auditBatch([
  'https://example.com',
  'https://example.com/docs',
  'https://example.com/api',
]);

await WebMCPValidator.saveBatchBadge(batchResult, './public/site-badge.svg', {
  label: 'WebMCP Site',
  type: 'combined',
});
```

---

## 📋 Embedding in `README.md`

### Relative Local File (Recommended for repos with CI commit action)
```markdown
[![WebMCP Readiness](./public/badges/webmcp.svg)](https://example.com)
```

### Raw GitHub Content URL
```markdown
[![WebMCP Readiness](https://raw.githubusercontent.com/username/repo/main/badges/webmcp.svg)](https://github.com/username/repo)
```
