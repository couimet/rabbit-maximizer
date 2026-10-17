import { hasRateLimitMarker } from '../../src/github/index.js';

import { getRandomString, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('hasRateLimitMarker', () => {
  let phrase: string;
  let phrases: readonly string[];

  beforeEach(() => {
    phrase = getUniqueString({ prefix: 'rate-limit-' });
    phrases = [phrase];
  });

  it('returns true when the body contains a configured phrase', () => {
    expect(hasRateLimitMarker(`${getRandomString()} ${phrase} ${getRandomString()}`, phrases)).toBe(true);
  });

  it('returns false when the body holds no configured phrase', () => {
    expect(hasRateLimitMarker(getRandomString(), phrases)).toBe(false);
  });

  it('returns false when the phrase list holds nothing', () => {
    expect(hasRateLimitMarker(phrase, [])).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasRateLimitMarker('', phrases)).toBe(false);
  });
});
