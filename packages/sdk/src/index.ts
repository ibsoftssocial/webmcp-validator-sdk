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
   * Scan and audit a target URL for WebMCP readiness
   */
  static async audit(url: string) {
    // Implemented in Milestones 2 & 3
    return {
      url,
      score: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * Convenience alias for WebMCPValidator
 */
export const WebMCP = WebMCPValidator;
