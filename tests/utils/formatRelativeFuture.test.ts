import { formatRelativeFuture } from '../../src/utils/index.js';

import { describe, expect, it, jest } from '@jest/globals';

describe('formatRelativeFuture', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-04T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "eligible now" for past timestamp', () => {
    expect(formatRelativeFuture('2026-07-04T11:00:00.000Z')).toBe('eligible now');
  });

  it('returns "in 7m" for 7 minutes from now', () => {
    expect(formatRelativeFuture('2026-07-04T12:07:00.000Z')).toBe('in 7m');
  });

  it('returns "in 4h" for exactly 4 hours from now', () => {
    expect(formatRelativeFuture('2026-07-04T16:00:00.000Z')).toBe('in 4h');
  });

  it('returns "in 4h 13m" for 4h 13m from now', () => {
    expect(formatRelativeFuture('2026-07-04T16:13:00.000Z')).toBe('in 4h 13m');
  });

  it('returns "in 1d 8h" for 1 day 8 hours from now', () => {
    expect(formatRelativeFuture('2026-07-05T20:00:00.000Z')).toBe('in 1d 8h');
  });
});
