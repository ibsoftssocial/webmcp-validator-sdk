import fs from 'node:fs/promises';
import path from 'node:path';
import { ReportFormat, ReporterOptions, WebMCPReadinessReport } from '../types/index.js';
import { renderJsonReport } from './json-reporter.js';
import { renderMarkdownReport } from './markdown-reporter.js';
import { renderHtmlReport } from './html-reporter.js';
import { renderTerminalReport } from './terminal-reporter.js';

/**
 * Infers report format from a file path extension
 */
export function inferReportFormat(filePath: string): ReportFormat {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
      return 'html';
    case '.md':
    case '.markdown':
      return 'markdown';
    case '.json':
      return 'json';
    default:
      return 'json';
  }
}

/**
 * Generates formatted report content based on specified format
 */
export function generateReport(
  report: WebMCPReadinessReport,
  format: ReportFormat = 'json',
  options?: ReporterOptions
): string {
  switch (format) {
    case 'json':
      return renderJsonReport(report, options);
    case 'markdown':
      return renderMarkdownReport(report, options);
    case 'html':
      return renderHtmlReport(report, options);
    case 'pretty':
      return renderTerminalReport(report, options);
    default:
      return renderJsonReport(report, options);
  }
}

/**
 * Saves a formatted report to a local file, creating parent directories if needed
 */
export async function saveReportToFile(
  report: WebMCPReadinessReport,
  filePath: string,
  options?: ReporterOptions & { format?: ReportFormat }
): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  const format = options?.format ?? inferReportFormat(resolvedPath);
  const content = generateReport(report, format, options);

  // Ensure target directory exists
  const targetDir = path.dirname(resolvedPath);
  await fs.mkdir(targetDir, { recursive: true });

  await fs.writeFile(resolvedPath, content, 'utf8');
}
