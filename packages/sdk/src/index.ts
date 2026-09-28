export * from '@webmcp/core';

/**
 * Public WebMCP SDK API entry point
 */
export class WebMCP {
  /**
   * Version of the WebMCP SDK
   */
  static readonly version = '0.1.0';

  /**
   * Scan and audit a target URL for WebMCP readiness
   */
  static async audit(url: string) {
    // Placeholder to be implemented in Milestone 2 & 3
    return {
      url,
      score: 0,
      timestamp: Date.now(),
    };
  }
}
