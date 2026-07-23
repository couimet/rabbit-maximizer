import { formatRelativeTime } from '../../src/utils/index.js';

import { describe, expect, it, jest } from '@jest/globals';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-04T12:00:00.000Z'));
  });

  it('returns "just now" for a future timestamp', () => {
    expect(formatRelativeTime('2026-07-04T12:01:00.000Z')).toBe('just now');
  });

  it('returns "just now" for less than a minute ago', () => {
    expect(formatRelativeTime('2026-07-04T11:59:30.000Z')).toBe('just now');
  });

  it('returns "7m ago" for 7 minutes ago', () => {
    expect(formatRelativeTime('2026-07-04T11:53:00.000Z')).toBe('7m ago');
  });

  it('returns "3h ago" for 3 hours ago', () => {
    expect(formatRelativeTime('2026-07-04T09:00:00.000Z')).toBe('3h ago');
  });

  it('returns "4h ago" for 4h 18m ago (minutes truncated)', () => {
    expect(formatRelativeTime('2026-07-04T07:42:00.000Z')).toBe('4h ago');
  });
});
