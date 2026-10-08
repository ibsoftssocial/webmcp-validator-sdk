import fs from 'node:fs/promises';
import path from 'node:path';
import { ReportFormat, ReporterOptions, WebMCPReadinessReport, BatchAuditResult } from '../types/index.js';
import { renderJsonReport } from './json-reporter.js';
import { renderMarkdownReport } from './markdown-reporter.js';
import { renderHtmlReport } from './html-reporter.js';
import { renderTerminalReport } from './terminal-reporter.js';
import { renderSarifReport } from './sarif-reporter.js';
import { renderJunitReport } from './junit-reporter.js';
import {
  renderBatchTerminalReport,
  renderBatchJsonReport,
  renderBatchMarkdownReport,
  renderBatchSarifReport,
  renderBatchJunitReport,
  renderBatchHtmlReport,
} from './batch-reporter.js';

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
    case '.sarif':
      return 'sarif';
    case '.xml':
    case '.junit':
      return 'junit';
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
    case 'sarif':
      return renderSarifReport(report, options);
    case 'junit':
      return renderJunitReport(report, options);
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

/**
 * Generates formatted output for a multi-page batch audit
 */
export function generateBatchReport(
  result: BatchAuditResult,
  format: ReportFormat = 'pretty',
  options?: ReporterOptions
): string {
  switch (format) {
    case 'json':
      return renderBatchJsonReport(result, options);
    case 'markdown':
      return renderBatchMarkdownReport(result, options);
    case 'sarif':
      return renderBatchSarifReport(result, options);
    case 'junit':
      return renderBatchJunitReport(result, options);
    case 'html':
      return renderBatchHtmlReport(result, options);
    case 'pretty':
    default:
      return renderBatchTerminalReport(result, options);
  }
}

/**
 * Saves a batch audit report to a local file
 */
export async function saveBatchReportToFile(
  result: BatchAuditResult,
  filePath: string,
  options?: ReporterOptions & { format?: ReportFormat }
): Promise<void> {
  const resolvedPath = path.resolve(filePath);
  const format = options?.format ?? inferReportFormat(resolvedPath);
  const content = generateBatchReport(result, format, options);

  const targetDir = path.dirname(resolvedPath);
  await fs.mkdir(targetDir, { recursive: true });

  await fs.writeFile(resolvedPath, content, 'utf8');
}

