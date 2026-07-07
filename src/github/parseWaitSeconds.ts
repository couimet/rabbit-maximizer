import removeMarkdown from 'remove-markdown';

/**
 * Best-effort extraction of wait time in seconds from a CodeRabbit rate-limit
 * comment body.
 *
 * Target format (confirmed):
 *   "Please wait {X} minutes and {Y} seconds before requesting another review."
 *
 * Singular forms ("1 minute", "1 second") are handled. Markdown formatting
 * is stripped before parsing so bold / italic markers don't defeat the regex.
 * Returns `undefined` when no parseable wait time is found.
 */
const SECONDS_PER_MINUTE = 60;

export const parseWaitSeconds = (body: string): number | undefined => {
  const plain = removeMarkdown(body);

  const match = plain.match(/please wait (\d+) minutes?(?: and (\d+) seconds?)? before requesting another review/i);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = match[2] ? parseInt(match[2], 10) : 0;
    return minutes * SECONDS_PER_MINUTE + seconds;
  }

  const altMatch = plain.match(/next review available in: (\d+) minutes?(?: and (\d+) seconds?)?/i);
  if (altMatch) {
    const minutes = parseInt(altMatch[1], 10);
    const seconds = altMatch[2] ? parseInt(altMatch[2], 10) : 0;
    return minutes * SECONDS_PER_MINUTE + seconds;
  }

  const secondsMatch = plain.match(/next review available in: (\d+) seconds?/i);
  if (secondsMatch) {
    return parseInt(secondsMatch[1], 10);
  }

  return undefined;
};
