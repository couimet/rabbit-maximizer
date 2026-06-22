import { getJitter } from '../../src/utils/getJitter.js';

import { describe, expect, it, jest } from '@jest/globals';

const JITTER_RATIO = 0.15;

describe('getJitter', () => {
  it('returns a rounded integer', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(getJitter(100)).toBe(100);
    expect(Number.isInteger(getJitter(100))).toBe(true);
  });

  it('scales by the jitter factor', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1);
    const result = getJitter(100);
    expect(result).toBe(115);
  });

  it('applies negative jitter at random floor', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = getJitter(100);
    expect(result).toBe(85);
  });

  it('stays within ±15% bounds over many iterations', () => {
    const base = 100;
    const max = Math.round(base * (1 + JITTER_RATIO));
    const min = Math.round(base * (1 - JITTER_RATIO));

    for (let i = 0; i < 100; i++) {
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
