import {
  scanUrl,
  ScanTargetOptions,
  WebMCPDetectionResult,
  lintWebMCP,
  LinterOptions,
  LintResult,
  calculateReadinessScore,
  ScorerOptions,
  WebMCPReadinessReport,
} from '@webmcp-validator/core';
export * from '@webmcp-validator/core';

export interface AuditOptions {
  /** Linter options */
  linter?: LinterOptions;
  /** Scorer options */
  scorer?: ScorerOptions;
}

/**
 * Public WebMCP Validator SDK entry point
 */
export class WebMCPValidator {
  /**
   * Version of the WebMCP Validator SDK
   */
  static readonly version = '0.1.0';

  /**
   * Scan a website URL using headless Chromium to discover WebMCP tools and APIs
   */
  static async scan(target: string | ScanTargetOptions): Promise<WebMCPDetectionResult> {
    return scanUrl(target);
  }

  /**
   * Lint a WebMCP detection result to identify schema errors, security risks, and best practice violations
   */
  static async lint(detection: WebMCPDetectionResult, options?: LinterOptions): Promise<LintResult> {
    return lintWebMCP(detection, options);
  }

  /**
   * Calculate readiness score and generate audit report for a detection and lint result
   */
  static score(
    detection: WebMCPDetectionResult,
    lint: LintResult,
    options?: ScorerOptions
  ): WebMCPReadinessReport {
    return calculateReadinessScore(detection, lint, options);
  }

  /**
   * Complete end-to-end audit: Scan target, run linter rules, and calculate AI readiness score
   */
  static async audit(
    target: string | ScanTargetOptions,
    options?: AuditOptions
  ): Promise<WebMCPReadinessReport> {
    const detection = await this.scan(target);
    const lintResult = await this.lint(detection, options?.linter);
    return this.score(detection, lintResult, options?.scorer);
  }
}

/**
 * Convenience alias for WebMCPValidator
 */
export const WebMCP = WebMCPValidator;

