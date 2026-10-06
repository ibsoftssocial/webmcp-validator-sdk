import { ReporterOptions, WebMCPReadinessReport } from '../types/index.js';

function formatCategoryName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats a WebMCP readiness report into a formatted terminal string with ANSI colors
 */
export function renderTerminalReport(
  report: WebMCPReadinessReport,
  options?: ReporterOptions & { colors?: boolean }
): string {
  const useColors = options?.colors !== false;

  const bold = (s: string) => (useColors ? `\x1b[1m${s}\x1b[0m` : s);
  const green = (s: string) => (useColors ? `\x1b[32m${s}\x1b[0m` : s);
  const red = (s: string) => (useColors ? `\x1b[31m${s}\x1b[0m` : s);
  const yellow = (s: string) => (useColors ? `\x1b[33m${s}\x1b[0m` : s);
  const cyan = (s: string) => (useColors ? `\x1b[36m${s}\x1b[0m` : s);
  const gray = (s: string) => (useColors ? `\x1b[90m${s}\x1b[0m` : s);

  const lines: string[] = [];

  const gradeColor =
    report.grade === 'A'
      ? green
      : report.grade === 'B'
      ? cyan
      : report.grade === 'C'
      ? yellow
      : red;

  const passBadge = report.passed ? green('✔ PASSED') : red('✖ FAILED');

  lines.push('');
  lines.push(bold('WebMCP AI Readiness Score:'));
  lines.push(`  ${bold('Target URL:')}                 ${report.url}`);
  lines.push(
    `  ${bold('Overall Score:')}           ${bold(`${report.overallScore}/100`)}  [Grade ${gradeColor(
      report.grade
    )}]  ${passBadge}`
  );
  lines.push(`  ${bold('Total Tools:')}             ${report.toolCount}`);
  lines.push(
    `  ${bold('Findings:')}                ${
      report.summary.errorCount > 0 ? red(`${report.summary.errorCount} Errors`) : '0 Errors'
    }, ${
      report.summary.warningCount > 0 ? yellow(`${report.summary.warningCount} Warnings`) : '0 Warnings'
    }, ${cyan(`${report.summary.infoCount} Info`)}`
  );
  lines.push('');

  lines.push(bold('Category Breakdown:'));
  lines.push(
    cyan(
      `  ${'Category'.padEnd(18)} ${'Weight'.padEnd(8)} ${'Score'.padEnd(10)} ${'Weighted'.padEnd(14)} ${'Findings (E/W/I)'}`
    )
  );
  lines.push(gray('  ' + '─'.repeat(68)));

  for (const [catName, cat] of Object.entries(report.categories)) {
    const label = formatCategoryName(catName).padEnd(18);
    const weight = `${cat.weight}%`.padEnd(8);
    const scoreStr = `${cat.score}/100`.padEnd(10);
    const weighted = `${cat.weightedScore.toFixed(1)} / ${cat.weight}`.padEnd(14);
    const findingsStr = `${cat.findingsCount.errors}E / ${cat.findingsCount.warnings}W / ${cat.findingsCount.info}I`;

    lines.push(`  ${label} ${weight} ${scoreStr} ${weighted} ${findingsStr}`);
  }
  lines.push('');

  if (report.tools.length > 0) {
    lines.push(bold(`Discovered Tools (${report.tools.length}):`));
    for (const tool of report.tools) {
      const srcBadge = gray(`[${tool.source}]`);
      const ro = tool.annotations?.readOnlyHint ? green('(readOnly)') : '';
      const conf = tool.annotations?.confirmationHint ? yellow('(confirmReq)') : '';
      lines.push(`  • ${bold(tool.name)} ${srcBadge} ${ro} ${conf}`.trim());
      if (tool.description) {
        lines.push(`    ${gray(tool.description)}`);
      }
    }
    lines.push('');
  }

  if (report.findings.length > 0) {
    lines.push(bold(`Audit Findings (${report.findings.length}):`));
    for (const f of report.findings) {
      const badge =
        f.severity === 'error'
          ? red('ERROR')
          : f.severity === 'warning'
          ? yellow('WARN ')
          : cyan('INFO ');
      const target = f.toolName ? `[${f.toolName}]` : '[page]';
      lines.push(`  ${badge} ${bold(f.ruleId)} ${gray(target)} ${f.message}`);
      if (f.suggestion) {
        lines.push(`         ${gray('↳ Fix: ' + f.suggestion)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
