/**
 * Best-effort extraction of wait time in seconds from a CodeRabbit rate-limit
 * comment body.
 *
 * Target format (confirmed):
 *   "Please wait {X} minutes and {Y} seconds before requesting another review."
 *
 * Singular forms ("1 minute", "1 second") are handled. Returns `undefined`
 * when no parseable wait time is found.
 */
const SECONDS_PER_MINUTE = 60;

export const parseWaitSeconds = (body: string): number | undefined => {
  const match = body.match(/please wait (\d+) minutes?(?: and (\d+) seconds?)? before requesting another review/i);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = match[2] ? parseInt(match[2], 10) : 0;
    return minutes * SECONDS_PER_MINUTE + seconds;
  }

  const altMatch = body.match(/next review available in: (\d+) minutes?/i);
  if (altMatch) {
    return parseInt(altMatch[1], 10) * SECONDS_PER_MINUTE;
  }

  return undefined;
};
