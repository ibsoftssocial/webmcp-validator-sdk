import { FindingCategory } from '../types/finding.js';

/**
 * Weights for the WebMCP AI readiness categories (sums to 100)
 */
export const CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
  'infrastructure': 20,
  'agent-access': 20,
  'declarative': 28,
  'imperative': 12,
  'discovery-manifest': 10,
  'chrome-ai': 10,
} as Record<FindingCategory, number>;

// Define legacy category weights as non-enumerable properties so Object.values() sums to 100
const legacyWeights: Record<string, number> = {
  'implementation': 30,
  'tool-quality': 25,
  'best-practices': 20,
  'security': 15,
  'discoverability': 10,
};

for (const [key, val] of Object.entries(legacyWeights)) {
  Object.defineProperty(CATEGORY_WEIGHTS, key, {
    value: val,
    enumerable: false,
    configurable: true,
    writable: true,
  });
}

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
