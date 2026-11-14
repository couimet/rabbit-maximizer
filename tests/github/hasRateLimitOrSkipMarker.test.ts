import { hasRateLimitOrSkipMarker } from '../../src/github/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('hasRateLimitOrSkipMarker', () => {
  let rateLimitPhrase: string;
  let skipPhrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    rateLimitPhrase = getUniqueString({ prefix: 'rate-limit-' });
    skipPhrase = getUniqueString({ prefix: 'skip-' });
    phrases = [rateLimitPhrase, skipPhrase];
  });

  it('returns true when the body contains the rate-limit phrase', () => {
    expect(hasRateLimitOrSkipMarker(`${getRandomString()} ${rateLimitPhrase} ${getRandomString()}`, phrases)).toBe(true);
  });

  it('returns true when the body contains the skip phrase', () => {
    expect(hasRateLimitOrSkipMarker(`${getRandomString()} ${skipPhrase} ${getRandomString()}`, phrases)).toBe(true);
  });

  it('returns true when the body contains both phrases', () => {
    expect(hasRateLimitOrSkipMarker(`${getRandomString()} ${skipPhrase} ${rateLimitPhrase} ${getRandomString()}`, phrases)).toBe(true);
  });

  it('returns false when the body holds no configured phrase', () => {
    expect(hasRateLimitOrSkipMarker(getRandomString(), phrases)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasRateLimitOrSkipMarker('', phrases)).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasRateLimitOrSkipMarker(null, phrases)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasRateLimitOrSkipMarker(undefined, phrases)).toBe(false);
  });
});
