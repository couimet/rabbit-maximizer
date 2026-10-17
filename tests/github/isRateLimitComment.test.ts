import { isRateLimitComment, REVIEW_BOT_SELF_MARKER_PREFIX } from '../../src/github/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('isRateLimitComment', () => {
  let rateLimitPhrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    rateLimitPhrase = getUniqueString({ prefix: 'rate-limit-' });
    phrases = [rateLimitPhrase];
  });

  it('returns true when the body holds a configured rate-limit phrase', () => {
    expect(isRateLimitComment(`${getRandomString()} ${rateLimitPhrase} ${getRandomString()}`, phrases)).toBe(true);
  });

  it('returns false when the body holds no configured phrase', () => {
    expect(isRateLimitComment(getRandomString(), phrases)).toBe(false);
  });

  it('returns false when our own retrigger marker is present', () => {
    expect(isRateLimitComment(`${REVIEW_BOT_SELF_MARKER_PREFIX} -->\n\n${rateLimitPhrase}`, phrases)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isRateLimitComment('', phrases)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRateLimitComment(null, phrases)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRateLimitComment(undefined, phrases)).toBe(false);
  });
});
