import { getJitter } from '../../src/utils/getJitter.js';

import { describe, expect, it, jest } from '@jest/globals';

const JITTER_RATIO = 0.15;
const BASE_WAIT_SECONDS = 100;
const POSITIVE_JITTER_EXPECTED = 115;
const NEGATIVE_JITTER_EXPECTED = 85;
const BOUNDS_ITERATIONS = 100;

describe('getJitter', () => {
  it('returns a rounded integer', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(getJitter(BASE_WAIT_SECONDS)).toBe(BASE_WAIT_SECONDS);
    expect(Number.isInteger(getJitter(BASE_WAIT_SECONDS))).toBe(true);
  });

  it('scales by the jitter factor', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1);
    const result = getJitter(BASE_WAIT_SECONDS);
    expect(result).toBe(POSITIVE_JITTER_EXPECTED);
  });

  it('applies negative jitter at random floor', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = getJitter(BASE_WAIT_SECONDS);
    expect(result).toBe(NEGATIVE_JITTER_EXPECTED);
  });

  it('stays within ±15% bounds over many iterations', () => {
    const base = BASE_WAIT_SECONDS;
    const max = Math.round(base * (1 + JITTER_RATIO));
    const min = Math.round(base * (1 - JITTER_RATIO));

    for (let i = 0; i < BOUNDS_ITERATIONS; i++) {
      const result = getJitter(base);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('returns 0 for a base of 0', () => {
    expect(getJitter(0)).toBe(0);
  });
});
