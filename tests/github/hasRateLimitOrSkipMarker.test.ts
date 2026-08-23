import { hasRateLimitOrSkipMarker } from '../../src/github/index.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('hasRateLimitOrSkipMarker', () => {
  it('returns true when the body contains the rate-limit marker', () => {
    expect(hasRateLimitOrSkipMarker(`${getRandomString()} rate limited by coderabbit.ai ${getRandomString()}`)).toBe(true);
  });

  it('returns true when the body contains the skip marker', () => {
    expect(hasRateLimitOrSkipMarker(`${getRandomString()} skip review by coderabbit.ai ${getRandomString()}`)).toBe(true);
  });

  it('returns true when the body contains both markers', () => {
    expect(hasRateLimitOrSkipMarker(`${getRandomString()} skip review by coderabbit.ai rate limited by coderabbit.ai ${getRandomString()}`)).toBe(true);
  });

  it('returns false when the body contains neither marker', () => {
    expect(hasRateLimitOrSkipMarker(getRandomString())).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasRateLimitOrSkipMarker('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasRateLimitOrSkipMarker(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasRateLimitOrSkipMarker(undefined)).toBe(false);
  });
});
