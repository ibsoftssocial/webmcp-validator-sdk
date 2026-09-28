import { FindingCategory } from '../types/finding.js';

/**
 * Weights for the 5 WebMCP readiness categories (sums to 100)
 */
export const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  'implementation': 30,
  'tool-quality': 25,
  'best-practices': 20,
  'security': 15,
  'discoverability': 10,
};

/**
 * Penalty deductions by finding severity
 */
export const SEVERITY_PENALTIES = {
  error: 10,
  warning: 4,
  info: 1,
} as const;

/**
 * Minimum score required for passing grade
 */
export const DEFAULT_PASSING_SCORE = 80;

/**
 * Valid tool name regular expression according to WebMCP draft
 */
export const TOOL_NAME_REGEX = /^[a-z][a-z0-9_.-]*$/;

/**
 * Standard tool name max length
 */
export const TOOL_NAME_MAX_LENGTH = 64;
