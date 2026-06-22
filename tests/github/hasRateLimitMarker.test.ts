import { hasRateLimitMarker } from '../../src/github/hasRateLimitMarker.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('hasRateLimitMarker', () => {
  it('returns true when the body contains the rate-limit marker', () => {
    expect(hasRateLimitMarker(`${getRandomString()} rate limited by coderabbit.ai ${getRandomString()}`)).toBe(true);
  });

  it('returns false when the body does not contain the marker', () => {
    expect(hasRateLimitMarker(getRandomString())).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasRateLimitMarker('')).toBe(false);
  });
});
