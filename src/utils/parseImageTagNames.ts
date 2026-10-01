/**
 * Reads the tag name from one image reference. A digest names no tag. A colon
 * marks a tag only when it follows the last slash, so a registry port and its
 * repository stay out. A value without a colon is already a tag name, which is
 * how IMAGE_TAGS reads in a local .env.
 */
const tagNameOf = (reference: string): string => {
  const trimmed = reference.trim();

  if (trimmed.includes('@')) {
    return '';
  }

  const separator = trimmed.lastIndexOf(':');

  if (separator === -1) {
    return trimmed;
  }

  return separator > trimmed.lastIndexOf('/') ? trimmed.slice(separator + 1) : '';
};

/**
 * Reduces a comma-separated image reference list to the tag names alone. The
 * registry and the repository are constant, and every log record carries the
 * result.
 */
export const parseImageTagNames = (references: string): string =>
  references
    .split(',')
    .map(tagNameOf)
    .filter((name) => name !== '')
    .join(',');
