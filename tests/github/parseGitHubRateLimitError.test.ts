import { parseGitHubRateLimitError } from '../../src/github/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('parseGitHubRateLimitError', () => {
  it('returns every rate-limit header when the error is a 403 quota-exhausted response', () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 3600;
    const limit = getUniqueInt();
    const used = getUniqueInt();
    const resource = getUniqueString();
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-limit': String(limit),
          'x-ratelimit-remaining': '0',
          'x-ratelimit-used': String(used),
          'x-ratelimit-reset': String(resetEpoch),
          'x-ratelimit-resource': resource,
        },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({ kind: 'quota-exhausted', resetEpoch, status: 403, limit, remaining: 0, used, resource });
  });

  it('returns resetEpoch and status for a 429 response, with the absent headers undefined', () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 1800;
    const err = {
      status: 429,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpoch),
        },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({ kind: 'quota-exhausted', resetEpoch, status: 429, limit: undefined, remaining: 0, used: undefined, resource: undefined });
  });

  it('leaves limit and used undefined when their headers are not numbers', () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 600;
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-limit': 'many',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-used': '',
          'x-ratelimit-reset': String(resetEpoch),
        },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({ kind: 'quota-exhausted', resetEpoch, status: 403, limit: undefined, remaining: 0, used: undefined, resource: undefined });
  });

  it('returns the throttled kind with the retry-after wait when the response carries the header', () => {
    const remaining = getUniqueInt();
    const retryAfterSec = getUniqueInt();
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': String(remaining),
          'retry-after': String(retryAfterSec),
        },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({ kind: 'throttled', status: 403, limit: undefined, remaining, used: undefined, resource: undefined, retryAfterSec });
  });

  it('returns the throttled kind with no wait when the body names a secondary rate limit', () => {
    const err = {
      status: 403,
      response: {
        data: { message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({
      kind: 'throttled',
      status: 403,
      limit: undefined,
      remaining: undefined,
      used: undefined,
      resource: undefined,
      retryAfterSec: undefined,
    });
  });

  it('returns the throttled kind with no wait for a bare 429', () => {
    const err = { status: 429 };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({
      kind: 'throttled',
      status: 429,
      limit: undefined,
      remaining: undefined,
      used: undefined,
      resource: undefined,
      retryAfterSec: undefined,
    });
  });

  it('marks a date-valued retry-after header as throttled and leaves the wait undefined', () => {
    const err = {
      status: 403,
      response: {
        headers: { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({
      kind: 'throttled',
      status: 403,
      limit: undefined,
      remaining: undefined,
      used: undefined,
      resource: undefined,
      retryAfterSec: undefined,
    });
  });

  it('returns undefined for a 403 whose message reports a permissions failure', () => {
    const err = {
      status: 403,
      response: {
        headers: { 'x-ratelimit-remaining': String(getUniqueInt()) },
        data: { message: 'Resource not accessible by integration' },
      },
    };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when the status is not 403 or 429', () => {
    const err = {
      status: 500,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1234567890',
        },
      },
    };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when x-ratelimit-remaining is not zero', () => {
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '5',
          'x-ratelimit-reset': '1234567890',
        },
      },
    };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when response is missing', () => {
    const err = { status: 403 };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when headers are missing', () => {
    const err = { status: 403, response: {} };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when x-ratelimit-reset is not a valid number', () => {
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': 'not-a-number',
        },
      },
    };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when x-ratelimit-reset is an empty string', () => {
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '',
        },
      },
    };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined when x-ratelimit-reset is null', () => {
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': null,
        },
      },
    };

    expect(parseGitHubRateLimitError(err)).toBeUndefined();
  });

  it('returns undefined for a non-object error', () => {
    expect(parseGitHubRateLimitError('some string error')).toBeUndefined();
  });
});
