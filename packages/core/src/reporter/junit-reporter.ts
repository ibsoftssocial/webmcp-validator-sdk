import { WebMCPReadinessReport, ReporterOptions } from '../types/index.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a WebMCP Readiness Report as a standard JUnit XML document
 * compatible with GitHub Actions, GitLab CI, Jenkins, CircleCI, and Azure DevOps test dashboards.
 */
export function renderJunitReport(
  report: WebMCPReadinessReport,
  _options?: ReporterOptions
): string {
  const categories = Object.entries(report.categories);
  const totalFindings = report.findings.length;
  const linterErrors = report.summary.errorCount;
  const linterWarnings = report.summary.warningCount;

  // Count failed categories (score < 80)
  const failedCategories = categories.filter(([, c]) => c.score < 80).length;

  const totalTests = categories.length + Math.max(1, totalFindings);
  const totalFailures = failedCategories + linterWarnings;
  const totalErrors = linterErrors;
  const durationSeconds = (report.summary && (report as any).durationMs ? (report as any).durationMs / 1000 : 0.5).toFixed(3);

  const xmlLines: string[] = [];
  xmlLines.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlLines.push(
    `<testsuites name="WebMCP AI Readiness Audit" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${durationSeconds}">`
  );

  // 1. Category Readiness Test Suite
  xmlLines.push(
    `  <testsuite name="webmcp.readiness.categories" tests="${categories.length}" failures="${failedCategories}" errors="0" time="${durationSeconds}" timestamp="${new Date(report.timestamp).toISOString()}">`
  );

  for (const [catName, cat] of categories) {
    const title = cat.title || catName;
    const isPassing = cat.score >= 80;
    const classname = `webmcp.readiness.${catName}`;

    if (isPassing) {
      xmlLines.push(
        `    <testcase classname="${escapeXml(classname)}" name="${escapeXml(title)}" time="0.050" />`
      );
    } else {
      const failedItems = (cat.checklist || [])
        .filter((item) => !item.passed)
        .map((item) => `• ${item.name}: ${item.details || 'failed'}`)
        .join('\n');

      const weighted = cat.weightedScore !== undefined ? cat.weightedScore : ((cat.score || 0) * (cat.weight || 25)) / 100;
      const weightVal = cat.weight || 25;
      const failureMessage = `Category score ${cat.score}/100 (${weighted.toFixed(1)}/${weightVal} pts) is below 80% passing threshold`;
      xmlLines.push(
        `    <testcase classname="${escapeXml(classname)}" name="${escapeXml(title)}" time="0.050">`
      );
      xmlLines.push(
        `      <failure message="${escapeXml(failureMessage)}" type="ThresholdFailure">`
      );
      xmlLines.push(escapeXml(`${failureMessage}\n\nFailed Checklist Items:\n${failedItems || 'None'}`));
      xmlLines.push('      </failure>');
      xmlLines.push('    </testcase>');
    }
  }

  xmlLines.push('  </testsuite>');

  // 2. Linter Rules Test Suite
  const linterTestsCount = Math.max(1, totalFindings);
  xmlLines.push(
    `  <testsuite name="webmcp.linter.rules" tests="${linterTestsCount}" failures="${linterWarnings}" errors="${linterErrors}" time="0.050" timestamp="${new Date(report.timestamp).toISOString()}">`
  );

  if (totalFindings === 0) {
    xmlLines.push(
      '    <testcase classname="webmcp.linter" name="All Security & Best-Practice Rules Passed" time="0.010" />'
    );
  } else {
    for (const f of report.findings) {
      const classname = `webmcp.linter.${f.category}`;
      const testName = `${f.ruleId}: ${f.title || f.ruleId}${f.toolName ? ` [${f.toolName}]` : ''}`;

      if (f.severity === 'error') {
        xmlLines.push(
          `    <testcase classname="${escapeXml(classname)}" name="${escapeXml(testName)}" time="0.010">`
        );
        xmlLines.push(
          `      <error message="${escapeXml(f.message)}" type="${escapeXml(f.ruleId)}">`
        );
        xmlLines.push(
          escapeXml(`${f.message}${f.suggestion ? `\n\nSuggestion: ${f.suggestion}` : ''}`)
        );
        xmlLines.push('      </error>');
        xmlLines.push('    </testcase>');
      } else if (f.severity === 'warning') {
        xmlLines.push(
          `    <testcase classname="${escapeXml(classname)}" name="${escapeXml(testName)}" time="0.010">`
        );
        xmlLines.push(
          `      <failure message="${escapeXml(f.message)}" type="${escapeXml(f.ruleId)}">`
        );
        xmlLines.push(
          escapeXml(`${f.message}${f.suggestion ? `\n\nSuggestion: ${f.suggestion}` : ''}`)
        );
        xmlLines.push('      </failure>');
        xmlLines.push('    </testcase>');
      } else {
        xmlLines.push(
          `    <testcase classname="${escapeXml(classname)}" name="${escapeXml(testName)}" time="0.010">`
        );
        xmlLines.push(`      <system-out>${escapeXml(`[INFO] ${f.message}`)}</system-out>`);
        xmlLines.push('    </testcase>');
      }
    }
  }

  xmlLines.push('  </testsuite>');
  xmlLines.push('</testsuites>');
  xmlLines.push('');

  return xmlLines.join('\n');
}
