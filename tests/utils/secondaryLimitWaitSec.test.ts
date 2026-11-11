import { secondaryLimitWaitSec } from '../../src/utils/index.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('secondaryLimitWaitSec', () => {
  it('returns the documented minimum when the retry-after is undefined', () => {
    expect(secondaryLimitWaitSec(undefined)).toBe(60);
  });

  it('returns the documented minimum for a negative retry-after', () => {
    expect(secondaryLimitWaitSec(-5)).toBe(60);
  });

  it('returns the documented minimum for an infinite retry-after', () => {
    expect(secondaryLimitWaitSec(Infinity)).toBe(60);
  });

  it('returns the documented minimum for a NaN retry-after', () => {
    expect(secondaryLimitWaitSec(Number.NaN)).toBe(60);
  });

  it('returns zero for a zero retry-after', () => {
    expect(secondaryLimitWaitSec(0)).toBe(0);
  });

  it('returns a positive retry-after unchanged', () => {
    const retryAfterSec = getUniqueInt();
    expect(secondaryLimitWaitSec(retryAfterSec)).toBe(retryAfterSec);
  });
});
