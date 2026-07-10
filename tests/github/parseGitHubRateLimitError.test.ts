import { parseGitHubRateLimitError } from '../../src/github/parseGitHubRateLimitError.js';

import { describe, expect, it } from '@jest/globals';

describe('parseGitHubRateLimitError', () => {
  it('returns resetEpoch and status when the error is a 403 quota-exhausted response with a valid reset header', () => {
    const resetEpoch = Math.floor(Date.now() / 1000) + 3600;
    const err = {
      status: 403,
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetEpoch),
        },
      },
    };

    const result = parseGitHubRateLimitError(err);

    expect(result).toStrictEqual({ resetEpoch, status: 403 });
  });

  it('returns resetEpoch and status for a 429 response', () => {
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

    expect(result).toStrictEqual({ resetEpoch, status: 429 });
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

  it('returns undefined for a non-object error', () => {
    expect(parseGitHubRateLimitError('some string error')).toBeUndefined();
  });
});
