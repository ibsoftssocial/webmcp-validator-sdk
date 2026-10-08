import { BatchAuditResult, ReporterOptions, WebMCPReadinessReport } from '../types/index.js';
import { renderSarifReport } from './sarif-reporter.js';
import { renderJunitReport } from './junit-reporter.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renders terminal report for a batch audit
 */
export function renderBatchTerminalReport(
  result: BatchAuditResult,
  options?: ReporterOptions
): string {
  const useColors = options?.colors !== false;
  const lines: string[] = [];

  const bold = (s: string) => (useColors ? `\x1b[1m${s}\x1b[22m` : s);
  const green = (s: string) => (useColors ? `\x1b[32m${s}\x1b[39m` : s);
  const yellow = (s: string) => (useColors ? `\x1b[33m${s}\x1b[39m` : s);
  const red = (s: string) => (useColors ? `\x1b[31m${s}\x1b[39m` : s);
  const cyan = (s: string) => (useColors ? `\x1b[36m${s}\x1b[39m` : s);
  const gray = (s: string) => (useColors ? `\x1b[90m${s}\x1b[39m` : s);

  lines.push('');
  lines.push(bold('═'.repeat(78)));
  lines.push(bold('   🌐 WebMCP Site-Wide Batch Audit Report'));
  lines.push(bold('═'.repeat(78)));
  lines.push('');

  const statusBadge = result.passed ? green('✔ PASSED') : red('✖ FAILED');
  const gradeBadge =
    result.overallGrade === 'A'
      ? green(`Grade ${result.overallGrade}`)
      : result.overallGrade === 'B'
      ? cyan(`Grade ${result.overallGrade}`)
      : result.overallGrade === 'C'
      ? yellow(`Grade ${result.overallGrade}`)
      : red(`Grade ${result.overallGrade}`);

  lines.push(`  ${bold('Site-Wide Average Score:')}   ${bold(result.averageScore.toString() + '/100')}  [${gradeBadge}]  ${statusBadge}`);
  lines.push(`  ${bold('Pages Audited:')}             ${result.successfulAudits} of ${result.totalUrls} succeeded (${result.failedAudits} errors)`);
  lines.push(`  ${bold('Total Tools Discovered:')}    ${result.summary.totalToolsDiscovered} (${result.summary.uniqueTools.length} unique)`);
  lines.push(`  ${bold('Linter Findings:')}           ${red(result.summary.errorCount + ' Errors')}, ${yellow(result.summary.warningCount + ' Warnings')}, ${cyan(result.summary.infoCount + ' Info')}`);
  lines.push(`  ${bold('Total Duration:')}            ${(result.durationMs / 1000).toFixed(2)}s`);
  lines.push('');

  // Page Breakdown Table
  lines.push(bold('Audited Pages Summary:'));
  lines.push(
    `  ${'URL'.padEnd(42)} ${'Score'.padEnd(10)} ${'Grade'.padEnd(8)} ${'Tools'.padEnd(8)} ${'Findings'}`
  );
  lines.push('  ' + '─'.repeat(76));

  for (const report of result.reports) {
    const truncatedUrl = report.url.length > 40 ? report.url.substring(0, 37) + '...' : report.url;
    const scoreStr = `${report.overallScore}/100`;
    const gradeStr = `[${report.grade}]`;
    const toolsStr = `${report.toolCount} tools`;
    const findingsStr = `${report.summary.errorCount}E / ${report.summary.warningCount}W`;

    const scoreColor = report.overallScore >= 80 ? green : report.overallScore >= 60 ? yellow : red;
    lines.push(
      `  ${truncatedUrl.padEnd(42)} ${scoreColor(scoreStr.padEnd(10))} ${gradeStr.padEnd(8)} ${toolsStr.padEnd(8)} ${findingsStr}`
    );
  }

  for (const err of result.errors) {
    const truncatedUrl = err.url.length > 40 ? err.url.substring(0, 37) + '...' : err.url;
    lines.push(`  ${truncatedUrl.padEnd(42)} ${red('ERROR'.padEnd(10))} [-]      0 tools  ${err.error}`);
  }

  lines.push('');

  // Category Averages
  if (Object.keys(result.summary.categoryAverages).length > 0) {
    lines.push(bold('Category Average Scores:'));
    for (const [cat, avg] of Object.entries(result.summary.categoryAverages)) {
      const catLabel = cat
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const barLength = Math.round(avg / 5);
      const bar = green('█'.repeat(barLength)) + gray('░'.repeat(20 - barLength));
      lines.push(`  • ${catLabel.padEnd(34)} ${bar} ${avg}%`);
    }
    lines.push('');
  }

  // Unique Tools Inventory
  if (result.summary.uniqueTools.length > 0) {
    lines.push(bold(`Discovered Site-Wide Tools Inventory (${result.summary.uniqueTools.length} unique):`));
    for (const tool of result.summary.uniqueTools) {
      const srcBadge = gray(`[${tool.source}]`);
      const ro = tool.annotations?.readOnlyHint ? green('(readOnly)') : '';
      const conf = (tool.annotations?.consequentialHint || tool.annotations?.confirmationHint)
        ? yellow('(consequential)')
        : '';
      lines.push(`  • ${bold(tool.name)} ${srcBadge} ${ro} ${conf}`.trim());
      if (tool.description) {
        lines.push(`    ${gray(tool.description)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Renders raw JSON report for a batch audit
 */
export function renderBatchJsonReport(
  result: BatchAuditResult,
  options?: ReporterOptions
): string {
  const indent = options?.jsonIndent ?? 2;
  return JSON.stringify(result, null, indent);
}

/**
 * Renders Markdown report for a batch audit
 */
export function renderBatchMarkdownReport(
  result: BatchAuditResult,
  _options?: ReporterOptions
): string {
  const lines: string[] = [];

  lines.push('# WebMCP Site-Wide Batch Audit Report');
  lines.push('');
  lines.push(`- **Site-Wide Average Score:** **${result.averageScore}/100** (Grade ${result.overallGrade})`);
  lines.push(`- **Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push(`- **Pages Audited:** ${result.successfulAudits} succeeded, ${result.failedAudits} errors (${result.totalUrls} total)`);
  lines.push(`- **Total Tools Discovered:** ${result.summary.totalToolsDiscovered} (${result.summary.uniqueTools.length} unique)`);
  lines.push(`- **Findings Summary:** ${result.summary.errorCount} Errors, ${result.summary.warningCount} Warnings, ${result.summary.infoCount} Info`);
  lines.push('');

  lines.push('## Audited Pages Breakdown');
  lines.push('');
  lines.push('| Page URL | Score | Grade | Status | Discovered Tools | Findings |');
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: |');

  for (const r of result.reports) {
    const status = r.passed ? '✅ Passed' : '⚠️ Below Threshold';
    lines.push(`| [${r.url}](${r.url}) | **${r.overallScore}/100** | ${r.grade} | ${status} | ${r.toolCount} | ${r.summary.errorCount}E / ${r.summary.warningCount}W |`);
  }

  for (const e of result.errors) {
    lines.push(`| [${e.url}](${e.url}) | **0/100** | F | ❌ Error | 0 | ${e.error} |`);
  }
  lines.push('');

  lines.push('## Category Averages');
  lines.push('');
  lines.push('| Category | Average Score |');
  lines.push('| :--- | :---: |');
  for (const [cat, avg] of Object.entries(result.summary.categoryAverages)) {
    const catLabel = cat.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    lines.push(`| ${catLabel} | **${avg}/100** |`);
  }
  lines.push('');

  if (result.summary.uniqueTools.length > 0) {
    lines.push('## Site-Wide Unique Tools Inventory');
    lines.push('');
    lines.push('| Tool Name | Source | Read Only | Consequential | Description |');
    lines.push('| :--- | :---: | :---: | :---: | :--- |');
    for (const t of result.summary.uniqueTools) {
      const ro = t.annotations?.readOnlyHint ? '✅' : '—';
      const conf = (t.annotations?.consequentialHint || t.annotations?.confirmationHint) ? '⚠️ Yes' : '—';
      const desc = (t.description || '*No description*').replace(/\n+/g, ' ');
      lines.push(`| \`${t.name}\` | \`${t.source}\` | ${ro} | ${conf} | ${desc} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Merges all findings across all pages into a unified OASIS SARIF v2.1.0 document
 */
export function renderBatchSarifReport(
  result: BatchAuditResult,
  options?: ReporterOptions
): string {
  const combinedReport: WebMCPReadinessReport = {
    url: result.reports[0]?.url || 'https://webmcp.local/batch',
    timestamp: result.timestamp,
    overallScore: result.averageScore,
    grade: result.overallGrade,
    passed: result.passed,
    categories: result.reports[0]?.categories || ({} as any),
    tools: result.summary.uniqueTools as any,
    toolCount: result.summary.uniqueTools.length,
    findings: result.reports.flatMap((r) => r.findings),
    summary: {
      totalFindings: result.summary.totalFindings,
      errorCount: result.summary.errorCount,
      warningCount: result.summary.warningCount,
      infoCount: result.summary.infoCount,
      hasNavigatorModelContext: result.reports.some((r) => r.summary.hasNavigatorModelContext),
      hasLlmsTxt: result.reports.some((r) => r.summary.hasLlmsTxt),
    },
  };

  return renderSarifReport(combinedReport, options);
}

/**
 * Combines all audited pages into a multi-testsuite JUnit XML document
 */
export function renderBatchJunitReport(
  result: BatchAuditResult,
  options?: ReporterOptions
): string {
  const xmlLines: string[] = [];
  xmlLines.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlLines.push(
    `<testsuites name="WebMCP Site-Wide Batch Audit" tests="${result.totalUrls}" failures="${result.failedAudits}" time="${(result.durationMs / 1000).toFixed(3)}">`
  );

  for (const report of result.reports) {
    const singleXml = renderJunitReport(report, options);
    // Strip <?xml ...> and top-level <testsuites> tags, embedding the inner <testsuite> elements
    const inner = singleXml
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<testsuites[^>]*>/g, '')
      .replace(/<\/testsuites>/g, '')
      .trim();
    if (inner) {
      xmlLines.push(inner);
    }
  }

  xmlLines.push('</testsuites>');
  xmlLines.push('');
  return xmlLines.join('\n');
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return '#10b981';
    case 'B':
      return '#3b82f6';
    case 'C':
      return '#f59e0b';
    case 'D':
      return '#ec4899';
    default:
      return '#ef4444';
  }
}

function formatCategoryName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Renders an offline-capable HTML report for a site-wide batch audit
 */
export function renderBatchHtmlReport(
  result: BatchAuditResult,
  options?: ReporterOptions
): string {
  const title = options?.title ?? 'WebMCP Site-Wide Batch Audit Report';
  const gradeColor = getGradeColor(result.overallGrade);
  const dateStr = new Date(result.timestamp).toUTCString();

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.averageScore / 100) * circumference;

  const pagesRows = result.reports
    .map((r) => {
      const pageGradeColor = getGradeColor(r.grade);
      const statusBadge = r.passed
        ? `<span class="badge badge-success">PASS</span>`
        : `<span class="badge badge-danger">FAIL</span>`;
      return `
        <tr>
          <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.url)}</a></td>
          <td><span class="score-badge" style="color: ${pageGradeColor}; border-color: ${pageGradeColor};">${r.overallScore}/100 (${r.grade})</span></td>
          <td>${r.toolCount}</td>
          <td>${r.summary.errorCount} err / ${r.summary.warningCount} warn</td>
          <td>${statusBadge}</td>
        </tr>`;
    })
    .join('');

  const toolRows = result.summary.uniqueTools
    .map((t) => {
      const consequential = t.annotations?.consequentialHint
        ? `<span class="badge badge-warn">Consequential</span>`
        : `<span class="badge badge-info">Standard</span>`;
      const params = t.inputSchema?.properties
        ? Object.keys(t.inputSchema.properties).length
        : 0;
      return `
        <tr>
          <td><code>${escapeHtml(t.name)}</code></td>
          <td>${escapeHtml(t.description || 'No description provided')}</td>
          <td>${params} param(s)</td>
          <td>${consequential}</td>
        </tr>`;
    })
    .join('');

  const categoryBars = Object.entries(result.summary.categoryAverages)
    .map(([cat, score]) => {
      const barColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
      return `
        <div class="category-item">
          <div class="category-header">
            <span class="cat-name">${escapeHtml(formatCategoryName(cat))}</span>
            <span class="cat-score">${score}/100</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, score))}%; background: ${barColor};"></div>
          </div>
        </div>`;
    })
    .join('');

  const errorsSection =
    result.errors.length > 0
      ? `
    <div class="card" style="margin-top: 24px;">
      <h2 style="color: #ef4444;">Scan Failures & Errors (${result.errors.length})</h2>
      <ul class="error-list">
        ${result.errors
          .map(
            (e) =>
              `<li><strong>${escapeHtml(e.url)}</strong>: <span>${escapeHtml(e.error)}</span></li>`
          )
          .join('')}
      </ul>
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --grade-color: ${gradeColor};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
      padding: 32px 16px 64px;
    }
    .container { max-width: 1080px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .header-title h1 { font-size: 1.7rem; font-weight: 700; }
    .header-title p { color: var(--text-muted); font-size: 0.9rem; margin-top: 4px; }
    .meta-time { color: var(--text-muted); font-size: 0.85rem; text-align: right; }
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
    }
    .card h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 16px; }
    .stat-label { font-size: 0.85rem; color: var(--text-muted); }
    .stat-val { font-size: 1.8rem; font-weight: 700; margin-top: 4px; }
    .gauge-card { display: flex; align-items: center; gap: 20px; }
    .gauge-container { position: relative; width: 120px; height: 120px; flex-shrink: 0; }
    .gauge-container svg { transform: rotate(-90deg); }
    .gauge-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .gauge-score { font-size: 1.5rem; font-weight: 700; color: var(--grade-color); }
    .gauge-grade { font-size: 0.85rem; color: var(--text-muted); }
    .category-item { margin-bottom: 12px; }
    .category-header { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 4px; }
    .cat-name { font-weight: 500; }
    .cat-score { color: var(--text-muted); }
    .progress-bar-bg { background: #1f2937; height: 8px; border-radius: 4px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9rem; }
    th { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--card-border); color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    td { padding: 12px; border-bottom: 1px solid var(--card-border); }
    tr:last-child td { border-bottom: none; }
    a { color: var(--primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85em; color: #38bdf8; }
    .score-badge { border: 1px solid; border-radius: 6px; padding: 2px 8px; font-weight: 600; font-size: 0.85rem; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-success { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .badge-warn { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
    .badge-info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .error-list { list-style: none; margin-top: 10px; }
    .error-list li { padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; margin-bottom: 8px; border-radius: 4px; font-size: 0.85rem; }
    footer { text-align: center; margin-top: 40px; color: var(--text-muted); font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-title">
        <h1>${escapeHtml(title)}</h1>
        <p>Site-wide WebMCP Readiness and Tool Discovery Audit</p>
      </div>
      <div class="meta-time">
        <div>${dateStr}</div>
        <div>Duration: ${(result.durationMs / 1000).toFixed(2)}s</div>
      </div>
    </header>

    <div class="grid-stats">
      <div class="card gauge-card">
        <div class="gauge-container">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#1f2937" stroke-width="10" />
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--grade-color)" stroke-width="10"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" />
          </svg>
          <div class="gauge-text">
            <div class="gauge-score">${result.averageScore}</div>
            <div class="gauge-grade">Grade ${result.overallGrade}</div>
          </div>
        </div>
        <div>
          <div class="stat-label">Average Score</div>
          <div class="stat-val" style="color: var(--grade-color);">${result.averageScore} / 100</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${result.passed ? 'PASSED' : 'FAILED'} (threshold ${result.overallGrade})</div>
        </div>
      </div>

      <div class="card">
        <div class="stat-label">Audited Pages</div>
        <div class="stat-val">${result.totalUrls}</div>
        <div style="font-size: 0.85rem; color: #10b981; margin-top: 4px;">${result.successfulAudits} Passed / <span style="color: #ef4444;">${result.failedAudits} Failed</span></div>
      </div>

      <div class="card">
        <div class="stat-label">Discovered Tools</div>
        <div class="stat-val">${result.summary.totalToolsDiscovered}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${result.summary.uniqueTools.length} Unique Across Site</div>
      </div>

      <div class="card">
        <div class="stat-label">Total Findings</div>
        <div class="stat-val">${result.summary.totalFindings}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
          <span style="color: #ef4444;">${result.summary.errorCount} Errors</span> •
          <span style="color: #f59e0b;">${result.summary.warningCount} Warnings</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <h2>Category Performance Breakdown</h2>
      ${categoryBars}
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <h2>Audited Pages (${result.reports.length})</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Page URL</th>
              <th>Score & Grade</th>
              <th>Tools</th>
              <th>Findings</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${pagesRows}
          </tbody>
        </table>
      </div>
    </div>

    ${
      result.summary.uniqueTools.length > 0
        ? `
    <div class="card" style="margin-bottom: 24px;">
      <h2>Discovered Tools Overview (${result.summary.uniqueTools.length} unique)</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Tool Name</th>
              <th>Description</th>
              <th>Parameters</th>
              <th>Action Type</th>
            </tr>
          </thead>
          <tbody>
            ${toolRows}
          </tbody>
        </table>
      </div>
    </div>`
        : ''
    }

    ${errorsSection}

    <footer>
      Generated by WebMCP Validator SDK &bull; Site-Wide Batch Report
    </footer>
  </div>
</body>
</html>`;
}

