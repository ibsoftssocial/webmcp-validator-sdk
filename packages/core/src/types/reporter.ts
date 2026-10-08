import { z } from 'zod';

export const ReportFormatSchema = z.enum(['pretty', 'json', 'markdown', 'html', 'sarif', 'junit', 'badge']);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

export interface BadgeOptions {
  /** Badge style: 'flat' (pill) or 'flat-square' (default: 'flat') */
  style?: 'flat' | 'flat-square';
  /** Badge content type: 'combined' (score + grade), 'grade', 'score', or 'compact' (default: 'combined') */
  type?: 'combined' | 'grade' | 'score' | 'compact';
  /** Left side label text (default: 'WebMCP') */
  label?: string;
}

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
  /** Options for SVG badge generation */
  badgeOptions?: BadgeOptions;
}
