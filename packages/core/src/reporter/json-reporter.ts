import { ReporterOptions, WebMCPReadinessReport } from '../types/index.js';

/**
 * Formats a WebMCP readiness report into JSON string
 */
export function renderJsonReport(
  report: WebMCPReadinessReport,
  options?: ReporterOptions
): string {
  const indent = options?.jsonIndent ?? 2;
  return JSON.stringify(report, null, indent);
}
