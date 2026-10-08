import fs from 'node:fs/promises';
import path from 'node:path';
import { WebMCPReadinessReport, BatchAuditResult, BadgeOptions, GradeRating } from '../types/index.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getGradeColor(grade: GradeRating): string {
  switch (grade) {
    case 'A':
      return '#10b981'; // Emerald
    case 'B':
      return '#3b82f6'; // Blue
    case 'C':
      return '#f59e0b'; // Amber
    case 'D':
      return '#ec4899'; // Pink
    case 'F':
    default:
      return '#ef4444'; // Red
  }
}

function estimateTextWidth(text: string): number {
  // Approximate proportional font width in 11px Verdana/sans-serif
  let width = 0;
  for (const ch of text) {
    if (/[ijl\s.:,']/.test(ch)) width += 4.5;
    else if (/[mwWMQ]/.test(ch)) width += 9.5;
    else if (/[A-Z]/.test(ch)) width += 8.0;
    else width += 6.8;
  }
  return Math.ceil(width);
}

interface SvgBadgeConfig {
  label: string;
  value: string;
  valueColor: string;
  style?: 'flat' | 'flat-square';
  title?: string;
}

function renderSvgBadge(config: SvgBadgeConfig): string {
  const label = config.label;
  const value = config.value;
  const valueColor = config.valueColor;
  const borderRadius = config.style === 'flat-square' ? 0 : 3;

  const labelTextWidth = estimateTextWidth(label);
  const valueTextWidth = estimateTextWidth(value);

  const leftPad = 8;
  const rightPad = 8;
  const leftWidth = labelTextWidth + leftPad * 2;
  const rightWidth = valueTextWidth + rightPad * 2;
  const totalWidth = leftWidth + rightWidth;
  const height = 20;

  const leftTextX = Math.round(leftWidth / 2);
  const rightTextX = Math.round(leftWidth + rightWidth / 2);

  const titleText = config.title ? `<title>${escapeXml(config.title)}</title>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  ${titleText}
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="${totalWidth}" height="${height}" rx="${borderRadius}" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <rect width="${leftWidth}" height="${height}" fill="#27272a"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${valueColor}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${leftTextX * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${labelTextWidth * 10}">${escapeXml(label)}</text>
    <text x="${leftTextX * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${labelTextWidth * 10}">${escapeXml(label)}</text>
    <text aria-hidden="true" x="${rightTextX * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${valueTextWidth * 10}">${escapeXml(value)}</text>
    <text x="${rightTextX * 10}" y="140" transform="scale(.1)" fill="#fff" textLength="${valueTextWidth * 10}">${escapeXml(value)}</text>
  </g>
</svg>`;
}

/**
 * Generates an embeddable SVG readiness badge for a single page report
 */
export function generateReadinessBadge(
  report: WebMCPReadinessReport,
  options?: BadgeOptions
): string {
  const label = options?.label || 'WebMCP';
  const type = options?.type || 'combined';
  const color = getGradeColor(report.grade);

  let value = `${report.overallScore}/100 · Grade ${report.grade}`;
  if (type === 'grade') {
    value = `Grade ${report.grade}`;
  } else if (type === 'score') {
    value = `${report.overallScore}/100`;
  } else if (type === 'compact') {
    value = `${report.grade} (${report.overallScore})`;
  }

  return renderSvgBadge({
    label,
    value,
    valueColor: color,
    style: options?.style,
    title: `WebMCP AI Readiness: ${report.overallScore}/100 (Grade ${report.grade}) for ${report.url}`,
  });
}

/**
 * Generates an embeddable SVG readiness badge for a site-wide batch result
 */
export function generateBatchReadinessBadge(
  result: BatchAuditResult,
  options?: BadgeOptions
): string {
  const label = options?.label || 'WebMCP Site';
  const type = options?.type || 'combined';
  const color = getGradeColor(result.overallGrade);

  let value = `${result.averageScore}/100 · Grade ${result.overallGrade}`;
  if (type === 'grade') {
    value = `Grade ${result.overallGrade}`;
  } else if (type === 'score') {
    value = `${result.averageScore}/100`;
  } else if (type === 'compact') {
    value = `${result.overallGrade} (${result.averageScore})`;
  }

  return renderSvgBadge({
    label,
    value,
    valueColor: color,
    style: options?.style,
    title: `WebMCP Site-Wide AI Readiness: ${result.averageScore}/100 (Grade ${result.overallGrade}) across ${result.totalUrls} pages`,
  });
}

/**
 * Saves a page readiness badge to an SVG file
 */
export async function saveReadinessBadgeToFile(
  report: WebMCPReadinessReport,
  filePath: string,
  options?: BadgeOptions
): Promise<void> {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });

  const svg = generateReadinessBadge(report, options);
  await fs.writeFile(resolved, svg, 'utf8');
}

/**
 * Saves a site-wide batch readiness badge to an SVG file
 */
export async function saveBatchReadinessBadgeToFile(
  result: BatchAuditResult,
  filePath: string,
  options?: BadgeOptions
): Promise<void> {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });

  const svg = generateBatchReadinessBadge(result, options);
  await fs.writeFile(resolved, svg, 'utf8');
}

/**
 * Generates markdown snippet for embedding badge into a README.md
 */
export function generateMarkdownBadgeSnippet(options: {
  badgePathOrUrl: string;
  targetUrl?: string;
  altText?: string;
}): string {
  const alt = options.altText || 'WebMCP AI Readiness';
  const target = options.targetUrl || '#';
  return `[![${alt}](${options.badgePathOrUrl})](${target})`;
}
