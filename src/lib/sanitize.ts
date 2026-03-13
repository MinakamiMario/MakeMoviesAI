/**
 * Input sanitization utilities for user-generated content.
 *
 * Note: React JSX automatically escapes text content (XSS-safe for rendering).
 * These utilities are for cleaning user input BEFORE sending to the database,
 * and for display purposes (truncation, normalization).
 */

/**
 * Strip control characters and normalize whitespace in user text input.
 * Preserves newlines but collapses multiple spaces/tabs.
 */
export function sanitizeText(input: string): string {
  return input
    // Remove zero-width characters and control chars (except \n, \r, \t)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    // Collapse multiple spaces/tabs into single space
    .replace(/[^\S\n]+/g, ' ')
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Sanitize a username: lowercase, alphanumeric + underscores only.
 */
export function sanitizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

/**
 * Truncate text to max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Validate and constrain text length. Returns null if invalid.
 */
export function validateTextLength(
  input: string,
  minLength: number,
  maxLength: number
): string | null {
  const cleaned = sanitizeText(input);
  if (cleaned.length < minLength || cleaned.length > maxLength) return null;
  return cleaned;
}
