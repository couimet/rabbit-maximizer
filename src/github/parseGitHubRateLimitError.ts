import { stringToNumber } from '../utils/index.js';

import type { RateLimitInfo } from './types/index.js';

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const QUOTA_EXHAUSTED = '0';

const HEADER_PREFIX = 'x-ratelimit-';
const HEADER_LIMIT = `${HEADER_PREFIX}limit`;
const HEADER_REMAINING = `${HEADER_PREFIX}remaining`;
const HEADER_USED = `${HEADER_PREFIX}used`;
const HEADER_RESET = `${HEADER_PREFIX}reset`;
const HEADER_RESOURCE = `${HEADER_PREFIX}resource`;

/**
 * Inspects an unknown error for a GitHub API rate-limit shape.
 * Returns parsed rate-limit details when the error is a quota-exhausted
 * response with a valid x-ratelimit-reset header, or undefined otherwise.
 */
export const parseGitHubRateLimitError = (err: unknown): RateLimitInfo | undefined => {
  const error = err as { status?: number; response?: { headers?: Record<string, string> } };

  if ((error.status !== HTTP_FORBIDDEN && error.status !== HTTP_TOO_MANY_REQUESTS) || error.response?.headers?.[HEADER_REMAINING] !== QUOTA_EXHAUSTED) {
    return undefined;
  }

  const headers = error.response.headers;
  const resetEpoch = stringToNumber(headers[HEADER_RESET]);
  if (resetEpoch === undefined) {
    return undefined;
  }

  return {
    resetEpoch,
    status: error.status,
    limit: stringToNumber(headers[HEADER_LIMIT]),
    remaining: stringToNumber(headers[HEADER_REMAINING]),
    used: stringToNumber(headers[HEADER_USED]),
    resource: headers[HEADER_RESOURCE],
  };
};
