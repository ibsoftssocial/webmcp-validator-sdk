import { z } from 'zod';

export const ReportFormatSchema = z.enum(['pretty', 'json', 'markdown', 'html', 'sarif', 'junit']);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

export interface ReporterOptions {
  /** Pretty-print JSON with indentation (default: 2) */
  jsonIndent?: number;
  /** Custom title for HTML / Markdown reports */
  title?: string;
  /** Color theme for HTML report ('dark' | 'light') (default: 'dark') */
  theme?: 'dark' | 'light';
  /** Include raw inputSchema JSON inside markdown/HTML tool cards (default: true) */
  includeSchemas?: boolean;
  /** Enable or disable ANSI colors in terminal reports (default: true) */
  colors?: boolean;
}
