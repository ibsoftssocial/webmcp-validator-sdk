import { ReporterOptions, WebMCPReadinessReport } from '../types/index.js';

function formatCategoryName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats a WebMCP readiness report into GitHub Flavored Markdown (GFM)
 */
export function renderMarkdownReport(
  report: WebMCPReadinessReport,
  options?: ReporterOptions
): string {
  const title = options?.title ?? 'WebMCP AI Readiness Audit Report';
  const includeSchemas = options?.includeSchemas !== false;
  const dateStr = new Date(report.timestamp).toUTCString();

  const lines: string[] = [];

  // Header & Title
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**Target URL:** \`${report.url}\`  `);
  lines.push(`**Audit Date:** ${dateStr}  `);
  lines.push(`**Overall Score:** **${report.overallScore}/100** (Grade: **${report.grade}**) — **${report.passed ? 'PASSED ✅' : 'FAILED ❌'}**`);
  lines.push('');

  // Summary Metrics
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| **Overall Readiness Score** | **${report.overallScore} / 100** |`);
  lines.push(`| **Letter Grade** | **${report.grade}** |`);
  lines.push(`| **Pass Status** | ${report.passed ? '✅ Passed (Score ≥ 80)' : '❌ Failed (Score < 80)'} |`);
  lines.push(`| **Total Discovered Tools** | ${report.toolCount} |`);
  lines.push(`| **Total Linter Findings** | ${report.summary.totalFindings} (${report.summary.errorCount} Errors, ${report.summary.warningCount} Warnings, ${report.summary.infoCount} Info) |`);
  lines.push(`| **Browser \`navigator.modelContext\`** | ${report.summary.hasNavigatorModelContext ? '✅ Detected' : '❌ Not Found'} |`);
  lines.push(`| **Agent Directives (\`/llms.txt\`)** | ${report.summary.hasLlmsTxt ? '✅ Found' : '❌ Not Found'} |`);
  lines.push('');

  // Category Breakdown Table
  lines.push('## Category Breakdown');
  lines.push('');
  lines.push('| Category | Weight | Raw Score | Weighted Score | Errors | Warnings | Info |');
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

  for (const [catName, cat] of Object.entries(report.categories)) {
    lines.push(
      `| **${cat.title || formatCategoryName(catName)}** | ${cat.weight}% | ${cat.score} / 100 | ${cat.weightedScore.toFixed(1)} / ${cat.weight} | ${cat.findingsCount.errors} | ${cat.findingsCount.warnings} | ${cat.findingsCount.info} |`
    );
  }
  lines.push('');

  // AI Readiness Checklist Breakdown Table
  const hasAnyChecklist = Object.values(report.categories).some(
    (c) => c.checklist && c.checklist.length > 0
  );
  if (hasAnyChecklist) {
    lines.push('## AI Readiness Checklist Breakdown');
    lines.push('');
    lines.push('| Checklist Item | Status | Points | Details |');
    lines.push('| :--- | :---: | :---: | :--- |');

    for (const [catName, cat] of Object.entries(report.categories)) {
      if (cat.checklist && cat.checklist.length > 0) {
        lines.push(
          `| **${cat.title || formatCategoryName(catName)}** | — | **${cat.weightedScore.toFixed(0)} / ${cat.weight}** | — |`
        );
        for (const item of cat.checklist) {
          const statusBadge = item.passed ? '✅ Passed' : '❌ Failed';
          const points = `${item.points} / ${item.maxPoints}`;
          const details = item.details || '—';
          lines.push(`| &nbsp;&nbsp;↳ ${item.name} | ${statusBadge} | ${points} | ${details} |`);
        }
      }
    }
    lines.push('');
  }

  // Discovered Tools
  lines.push('## Discovered Tools');
  lines.push('');
  if (report.tools.length === 0) {
    lines.push('> ℹ️ *No WebMCP tools were discovered on this page.*');
    lines.push('');
  } else {
    lines.push('| Tool Name | Source | Read Only | Confirm Hint | Description |');
    lines.push('| :--- | :---: | :---: | :---: | :--- |');
    for (const tool of report.tools) {
      const readOnly = tool.annotations?.readOnlyHint ? '✅' : '—';
      const confirm = tool.annotations?.confirmationHint ? '⚠️ Required' : '—';
      const desc = (tool.description || '*No description*').replace(/\n+/g, ' ');
      lines.push(`| \`${tool.name}\` | \`${tool.source}\` | ${readOnly} | ${confirm} | ${desc} |`);
    }
    lines.push('');

    // Schema code blocks
    if (includeSchemas) {
      lines.push('### Tool Schemas');
      lines.push('');
      for (const tool of report.tools) {
        lines.push(`<details>`);
        lines.push(`<summary><b><code>${tool.name}</code></b> Input Schema (JSON)</summary>`);
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(tool.inputSchema, null, 2));
        lines.push('```');
        lines.push('</details>');
        lines.push('');
      }
    }
  }

  // Linter Audit Findings
  lines.push('## Linter Audit Findings');
  lines.push('');
  if (report.findings.length === 0) {
    lines.push('> ✅ *Zero findings! All evaluated WebMCP rules and best practices passed.*');
    lines.push('');
  } else {
    lines.push('| Severity | Rule ID | Target | Finding & Remediation |');
    lines.push('| :---: | :---: | :---: | :--- |');
    for (const f of report.findings) {
      const badge =
        f.severity === 'error'
          ? '🔴 **ERROR**'
          : f.severity === 'warning'
          ? '🟡 **WARN**'
          : '🔵 **INFO**';
      const target = f.toolName ? `\`${f.toolName}\`` : '*(page)*';
      let msg = f.message;
      if (f.suggestion) {
        msg += `<br>↳ *Fix:* ${f.suggestion}`;
      }
      lines.push(`| ${badge} | \`${f.ruleId}\` | ${target} | ${msg} |`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*Report generated by [WebMCP Validator](https://github.com/ibsoftssocial/webmcp-validator-sdk).*');
  lines.push('');

  return lines.join('\n');
}
