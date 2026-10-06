import { ReporterOptions, WebMCPReadinessReport } from '../types/index.js';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return '#10b981'; // emerald
    case 'B':
      return '#3b82f6'; // blue
    case 'C':
      return '#f59e0b'; // amber
    case 'D':
      return '#ec4899'; // pink
    default:
      return '#ef4444'; // red
  }
}

function formatCategoryName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Renders a self-contained, offline-capable HTML report for WebMCP readiness audit
 */
export function renderHtmlReport(
  report: WebMCPReadinessReport,
  options?: ReporterOptions
): string {
  const title = options?.title ?? 'WebMCP AI Readiness Audit Report';
  const includeSchemas = options?.includeSchemas !== false;
  const gradeColor = getGradeColor(report.grade);
  const dateStr = new Date(report.timestamp).toUTCString();

  // SVG Radial Gauge calculation
  // Radius = 54, Circumference = 2 * PI * 54 = ~339.29
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (report.overallScore / 100) * circumference;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — ${escapeHtml(report.url)}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --text-dim: #6b7280;
      --grade-color: ${gradeColor};
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --error: #ef4444;
      --error-bg: rgba(239, 68, 68, 0.12);
      --warn: #f59e0b;
      --warn-bg: rgba(245, 158, 11, 0.12);
      --info: #3b82f6;
      --info-bg: rgba(59, 130, 246, 0.12);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding: 32px 16px 64px;
    }

    .container {
      max-width: 1080px;
      margin: 0 auto;
    }

    /* Header */
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }

    .header-titles h1 {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-titles .target-url {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-top: 4px;
      word-break: break-all;
    }

    .header-titles .target-url a {
      color: var(--primary);
      text-decoration: none;
    }

    .header-titles .target-url a:hover {
      text-decoration: underline;
    }

    .header-meta {
      font-size: 0.82rem;
      color: var(--text-dim);
      text-align: right;
    }

    /* Hero Score Grid */
    .hero-grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }

    @media (max-width: 768px) {
      .hero-grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }

    /* Score Radial Gauge */
    .score-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      position: relative;
    }

    .gauge-wrapper {
      position: relative;
      width: 160px;
      height: 160px;
      margin-bottom: 12px;
    }

    .gauge-svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .gauge-bg {
      fill: none;
      stroke: #1f2937;
      stroke-width: 10;
    }

    .gauge-progress {
      fill: none;
      stroke: var(--grade-color);
      stroke-width: 10;
      stroke-linecap: round;
      stroke-dasharray: ${circumference};
      stroke-dashoffset: ${offset};
      transition: stroke-dashoffset 1s ease-in-out;
    }

    .gauge-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .gauge-score {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1;
    }

    .gauge-sub {
      font-size: 0.8rem;
      color: var(--text-dim);
      font-weight: 600;
    }

    .grade-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--grade-color);
      color: var(--grade-color);
      font-weight: 700;
      font-size: 1rem;
    }

    .pass-indicator {
      margin-top: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      color: ${report.passed ? 'var(--success)' : 'var(--error)'};
    }

    /* Overview Stats */
    .stats-card h2 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: var(--text-main);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }

    .stat-box {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 12px 14px;
    }

    .stat-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-main);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Category Breakdown */
    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .category-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .cat-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.92rem;
    }

    .cat-title {
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cat-weight-pill {
      font-size: 0.75rem;
      padding: 1px 7px;
      border-radius: 10px;
      background: #1e293b;
      color: var(--text-muted);
    }

    .cat-score-val {
      font-weight: 700;
      color: var(--text-main);
    }

    .cat-progress-bg {
      height: 8px;
      background: #1e293b;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .cat-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease-in-out;
    }

    /* Tools Section */
    .tools-section {
      margin-top: 28px;
    }

    .tool-cards-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .tool-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 16px;
    }

    .tool-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 6px;
    }

    .tool-title {
      font-family: monospace;
      font-size: 1rem;
      font-weight: 700;
      color: #818cf8;
    }

    .tool-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .badge-source {
      background: #1e1b4b;
      color: #a5b4fc;
      border: 1px solid #3730a3;
    }

    .badge-readonly {
      background: var(--success-bg);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .badge-confirm {
      background: var(--warn-bg);
      color: var(--warn);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .tool-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-top: 4px;
    }

    details.schema-details {
      margin-top: 10px;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 6px;
      overflow: hidden;
    }

    details.schema-details summary {
      padding: 6px 12px;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      outline: none;
    }

    details.schema-details summary:hover {
      color: var(--text-main);
    }

    details.schema-details pre {
      padding: 12px;
      margin: 0;
      font-size: 0.78rem;
      color: #cbd5e1;
      background: #020617;
      border-top: 1px solid #1e293b;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    /* Findings Section */
    .findings-section {
      margin-top: 28px;
    }

    .findings-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .finding-item {
      background: var(--card-bg);
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-left: 4px solid var(--text-dim);
    }

    .finding-item.error {
      border-left-color: var(--error);
      background: rgba(239, 68, 68, 0.04);
    }

    .finding-item.warning {
      border-left-color: var(--warn);
      background: rgba(245, 158, 11, 0.04);
    }

    .finding-item.info {
      border-left-color: var(--info);
      background: rgba(59, 130, 246, 0.04);
    }

    .finding-top {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
    }

    .finding-pill {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .finding-pill.error {
      background: var(--error);
      color: #fff;
    }

    .finding-pill.warning {
      background: var(--warn);
      color: #000;
    }

    .finding-pill.info {
      background: var(--info);
      color: #fff;
    }

    .finding-rule {
      font-family: monospace;
      font-weight: 700;
      color: var(--text-main);
    }

    .finding-target {
      color: var(--text-muted);
      font-family: monospace;
    }

    .finding-message {
      font-size: 0.92rem;
      color: var(--text-main);
    }

    .finding-remediation {
      font-size: 0.85rem;
      color: #a5b4fc;
      background: rgba(99, 102, 241, 0.08);
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 4px;
    }

    /* Footer */
    footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid var(--card-border);
      text-align: center;
      font-size: 0.82rem;
      color: var(--text-dim);
    }

    footer a {
      color: var(--primary);
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-titles">
        <h1>
          <span>⚡</span> ${escapeHtml(title)}
        </h1>
        <div class="target-url">
          Target: <a href="${escapeHtml(report.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(report.url)}</a>
        </div>
      </div>
      <div class="header-meta">
        <div>Audited on ${escapeHtml(dateStr)}</div>
        <div>Engine: WebMCP Validator v0.1.0</div>
      </div>
    </header>

    <div class="hero-grid">
      <!-- Radial Gauge Score Card -->
      <div class="card score-card">
        <div class="gauge-wrapper">
          <svg class="gauge-svg" viewBox="0 0 120 120">
            <circle class="gauge-bg" cx="60" cy="60" r="${radius}"></circle>
            <circle class="gauge-progress" cx="60" cy="60" r="${radius}"></circle>
          </svg>
          <div class="gauge-text">
            <span class="gauge-score">${report.overallScore}</span>
            <span class="gauge-sub">/ 100</span>
          </div>
        </div>
        <div class="grade-badge">
          Grade ${report.grade}
        </div>
        <div class="pass-indicator">
          ${report.passed ? '✔ PASSED THRESHOLD' : '✖ BELOW THRESHOLD'}
        </div>
      </div>

      <!-- Quick Executive Summary Stats -->
      <div class="card stats-card">
        <h2>Executive Summary</h2>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">Discovered Tools</div>
            <div class="stat-value">${report.toolCount}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Linter Findings</div>
            <div class="stat-value">
              <span style="color: ${report.summary.errorCount > 0 ? 'var(--error)' : 'inherit'}">${report.summary.errorCount}E</span>
              <span style="color: ${report.summary.warningCount > 0 ? 'var(--warn)' : 'inherit'}">/ ${report.summary.warningCount}W</span>
              <span style="color: var(--info)">/ ${report.summary.infoCount}I</span>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Browser modelContext</div>
            <div class="stat-value">
              ${report.summary.hasNavigatorModelContext ? '<span style="color: var(--success)">✔ Active</span>' : '<span style="color: var(--error)">✖ Missing</span>'}
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Agent Directives (llms.txt)</div>
            <div class="stat-value">
              ${report.summary.hasLlmsTxt ? '<span style="color: var(--success)">✔ Present</span>' : '<span style="color: var(--text-dim)">— None</span>'}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Breakdown Card -->
    <div class="card" style="margin-bottom: 28px;">
      <h2 class="section-title"><span>📊</span> Category Breakdown</h2>
      <div class="category-list">
        ${Object.entries(report.categories)
          .map(([key, cat]) => {
            const barColor =
              cat.score >= 90
                ? 'var(--success)'
                : cat.score >= 70
                ? 'var(--warn)'
                : 'var(--error)';
            return `
          <div class="cat-item">
            <div class="cat-header">
              <div class="cat-title">
                ${escapeHtml(formatCategoryName(key))}
                <span class="cat-weight-pill">${cat.weight}% Weight</span>
              </div>
              <div class="cat-score-val">
                ${cat.score} / 100 <span style="color: var(--text-dim); font-size: 0.8rem;">(${cat.weightedScore.toFixed(1)} / ${cat.weight} pts)</span>
              </div>
            </div>
            <div class="cat-progress-bg">
              <div class="cat-progress-fill" style="width: ${cat.score}%; background: ${barColor};"></div>
            </div>
          </div>`;
          })
          .join('')}
      </div>
    </div>

    <!-- Discovered Tools Section -->
    <div class="tools-section">
      <h2 class="section-title"><span>🛠️</span> Discovered Tools (${report.toolCount})</h2>
      ${
        report.tools.length === 0
          ? `<div class="card" style="text-align: center; color: var(--text-muted); padding: 32px;">No WebMCP tools were discovered on this page.</div>`
          : `<div class="tool-cards-grid">
        ${report.tools
          .map((tool) => {
            return `
          <div class="tool-card">
            <div class="tool-card-header">
              <span class="tool-title">${escapeHtml(tool.name)}</span>
              <div class="tool-badges">
                <span class="badge badge-source">${escapeHtml(tool.source)}</span>
                ${tool.annotations?.readOnlyHint ? '<span class="badge badge-readonly">Read Only</span>' : ''}
                ${tool.annotations?.confirmationHint ? '<span class="badge badge-confirm">Confirmation Req.</span>' : ''}
              </div>
            </div>
            <div class="tool-desc">${escapeHtml(tool.description || 'No description provided.')}</div>
            ${
              includeSchemas
                ? `
            <details class="schema-details">
              <summary>View inputSchema</summary>
              <pre>${escapeHtml(JSON.stringify(tool.inputSchema, null, 2))}</pre>
            </details>`
                : ''
            }
          </div>`;
          })
          .join('')}
      </div>`
      }
    </div>

    <!-- Linter Findings Section -->
    <div class="findings-section">
      <h2 class="section-title"><span>🔍</span> Linter Audit Findings (${report.findings.length})</h2>
      ${
        report.findings.length === 0
          ? `<div class="card" style="color: var(--success); text-align: center; padding: 28px;">
          ✔ Zero rule violations or security warnings found!
        </div>`
          : `<div class="findings-list">
        ${report.findings
          .map((f) => {
            return `
          <div class="finding-item ${escapeHtml(f.severity)}">
            <div class="finding-top">
              <span class="finding-pill ${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span>
              <span class="finding-rule">${escapeHtml(f.ruleId)}</span>
              ${f.toolName ? `<span class="finding-target">↳ ${escapeHtml(f.toolName)}</span>` : '<span class="finding-target">↳ (page)</span>'}
            </div>
            <div class="finding-message">${escapeHtml(f.message)}</div>
            ${
              f.suggestion
                ? `<div class="finding-remediation"><strong>Fix:</strong> ${escapeHtml(f.suggestion)}</div>`
                : ''
            }
          </div>`;
          })
          .join('')}
      </div>`
      }
    </div>

    <footer>
      Audited with <a href="https://github.com/ibsoftssocial/webmcp-validator-sdk" target="_blank" rel="noopener noreferrer">WebMCP Validator SDK & CLI</a>
    </footer>
  </div>
</body>
</html>`;

  return html;
}
