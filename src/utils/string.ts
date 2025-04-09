/**
 * Utility functions for string operations with safety against undefined/null values
 */

import { trackStringOperation } from './debug';

/**
 * Safely sanitizes a string for use as a filename
 * Handles undefined or null inputs by returning a default value
 *
 * @param input The string to sanitize
 * @param defaultValue Default value to use if input is undefined/null
 * @returns A sanitized string safe for filenames
 */
export function sanitizeFileName(input: any, defaultValue = 'unnamed'): string {
  // Track the operation for debugging
  trackStringOperation(input, 'sanitizeFileName', 'sanitizeFileName');

  // If input is undefined or null, use the default value
  if (input == null) {
    return defaultValue;
  }

  // Convert to string if it's not already
  const str = String(input);

  // First remove characters that aren't alphanumeric, spaces, underscores, or hyphens
  const sanitized = str.replace(/[^\w\s-]/gi, '');

  // Then replace spaces with underscores
  return sanitized.replace(/\s+/g, '_');
}

/**
 * Safely performs a replace operation, handling undefined/null inputs
 *
 * @param input The string to perform replace on
 * @param pattern The search pattern (regex or string)
 * @param replacement The replacement string
 * @param defaultValue Default value to use if input is undefined/null
 * @returns The result of the replace operation or the default value
 */
export function safeReplace(
  input: any,
  pattern: RegExp | string,
  replacement: string,
  defaultValue = ''
): string {
  // Track the operation for debugging
  trackStringOperation(input, 'safeReplace', 'safeReplace');

  // If input is undefined or null, use the default value
  if (input == null) {
    return defaultValue;
  }

  // Convert to string and perform the replace
  return String(input).replace(pattern, replacement);
}
