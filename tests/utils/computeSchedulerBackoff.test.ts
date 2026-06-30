import { computeSchedulerBackoff } from '../../src/utils/computeSchedulerBackoff.js';

import { describe, expect, it } from '@jest/globals';

const BASE_MS = 60_000;
const MAX_MS = 3_600_000;

describe('computeSchedulerBackoff', () => {
  it('returns base on first attempt (attempts=0)', () => {
    expect(computeSchedulerBackoff(0, BASE_MS, MAX_MS)).toBe(BASE_MS);
  });

  it('returns base * 2 on second attempt (attempts=1)', () => {
    expect(computeSchedulerBackoff(1, BASE_MS, MAX_MS)).toBe(120_000);
  });

  it('doubles each attempt', () => {
    expect(computeSchedulerBackoff(2, BASE_MS, MAX_MS)).toBe(240_000);
    expect(computeSchedulerBackoff(3, BASE_MS, MAX_MS)).toBe(480_000);
  });

  it('caps at max', () => {
    expect(computeSchedulerBackoff(10, BASE_MS, MAX_MS)).toBe(MAX_MS);
    expect(computeSchedulerBackoff(100, BASE_MS, MAX_MS)).toBe(MAX_MS);
  });

  it('returns max when base * 2^attempts would exceed max', () => {
    expect(computeSchedulerBackoff(6, BASE_MS, MAX_MS)).toBe(MAX_MS);
  });
});
