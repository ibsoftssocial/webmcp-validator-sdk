import { scanUrl, ScanTargetOptions, WebMCPDetectionResult } from '@webmcp-validator/core';
export * from '@webmcp-validator/core';

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
   * Scan and audit a target URL for WebMCP readiness
   */
  static async audit(target: string | ScanTargetOptions) {
    const detection = await this.scan(target);
    return {
      url: typeof target === 'string' ? target : target.url,
      detection,
      score: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * Convenience alias for WebMCPValidator
 */
export const WebMCP = WebMCPValidator;
