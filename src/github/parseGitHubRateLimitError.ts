import { stringToNumber } from '../utils/index.js';

import type { RateLimitInfo } from './types/index.js';

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const EXHAUSTED_REMAINING = 0;

const HEADER_PREFIX = 'x-ratelimit-';
const HEADER_LIMIT = `${HEADER_PREFIX}limit`;
const HEADER_REMAINING = `${HEADER_PREFIX}remaining`;
const HEADER_USED = `${HEADER_PREFIX}used`;
const HEADER_RESET = `${HEADER_PREFIX}reset`;
const HEADER_RESOURCE = `${HEADER_PREFIX}resource`;
const HEADER_RETRY_AFTER = 'retry-after';

const SECONDARY_LIMIT_MESSAGE = 'secondary rate limit';

/**
 * Inspects an unknown error for a GitHub API rate-limit shape.
 * Returns the parsed details when the error reports an exhausted primary quota
 * or a throttled request, or undefined otherwise.
 *
 * A 403 alone proves nothing, because GitHub answers a permissions failure with
 * the same status. A 403 counts only when it carries the exhausted-quota
 * headers, a retry-after header, or the secondary-limit message. A 429 counts on
 * its own, because throttling is its only meaning.
 */
export const parseGitHubRateLimitError = (err: unknown): RateLimitInfo | undefined => {
  const error = err as { status?: number; response?: { headers?: Record<string, string>; data?: { message?: unknown } } };

  if (error.status !== HTTP_FORBIDDEN && error.status !== HTTP_TOO_MANY_REQUESTS) {
    return undefined;
  }

  const headers = error.response?.headers ?? {};
  const remaining = stringToNumber(headers[HEADER_REMAINING]);
  const resetEpoch = stringToNumber(headers[HEADER_RESET]);
  const body = error.response?.data?.message;
  const message = typeof body === 'string' ? body.toLowerCase() : '';

  const base = {
    status: error.status,
    limit: stringToNumber(headers[HEADER_LIMIT]),
    remaining,
    used: stringToNumber(headers[HEADER_USED]),
    resource: headers[HEADER_RESOURCE],
  };

  if (remaining === EXHAUSTED_REMAINING && resetEpoch !== undefined) {
    return { ...base, kind: 'quota-exhausted', resetEpoch };
  }

  // The header counts on its presence alone, so an HTTP-date value still marks
  // the response as throttled and only its wait falls back to the caller.
  const isThrottled = headers[HEADER_RETRY_AFTER] !== undefined || message.includes(SECONDARY_LIMIT_MESSAGE) || error.status === HTTP_TOO_MANY_REQUESTS;
  if (!isThrottled) {
    return undefined;
  }

  return { ...base, kind: 'throttled', retryAfterSec: stringToNumber(headers[HEADER_RETRY_AFTER]) };
};
