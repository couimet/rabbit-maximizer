/**
 * Reduces a comma-separated image reference list to the tag names alone. The
 * registry and the repository are constant, and every log record carries the
 * result.
 */
export const parseImageTagNames = (references: string): string =>
  references
    .split(',')
    .map((reference) => reference.slice(reference.lastIndexOf(':') + 1))
    .filter((name) => name !== '')
    .join(',');
