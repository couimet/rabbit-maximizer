import type { RateLimitInfo } from './types/index.js';

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const QUOTA_EXHAUSTED = '0';

/**
 * Inspects an unknown error for a GitHub API rate-limit shape.
 * Returns parsed rate-limit details when the error is a quota-exhausted
 * response with a valid x-ratelimit-reset header, or undefined otherwise.
 */
export const parseGitHubRateLimitError = (err: unknown): RateLimitInfo | undefined => {
  const error = err as { status?: number; response?: { headers?: Record<string, string> } };

  if ((error.status !== HTTP_FORBIDDEN && error.status !== HTTP_TOO_MANY_REQUESTS) || error.response?.headers?.['x-ratelimit-remaining'] !== QUOTA_EXHAUSTED) {
    return undefined;
  }

  const resetEpoch = Number(error.response.headers['x-ratelimit-reset']);
  if (Number.isNaN(resetEpoch)) {
    return undefined;
  }

  return { resetEpoch, status: error.status };
};
