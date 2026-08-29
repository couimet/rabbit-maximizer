import { formatRelativeTime } from '../../src/utils/index.js';

import { describe, expect, it, jest } from '@jest/globals';

const NOW = '2026-07-04T12:00:00.000Z';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
  });

  describe('single granularity (default)', () => {
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

    it('returns "2d ago" for 2 days ago', () => {
      expect(formatRelativeTime('2026-07-02T12:00:00.000Z')).toBe('2d ago');
    });
  });

  describe('now option', () => {
    it('uses the provided now instead of Date.now()', () => {
      const customNow = new Date('2026-07-04T14:00:00.000Z');

      const result = formatRelativeTime('2026-07-04T12:00:00.000Z', { now: customNow });

      expect(result).toBe('2h ago');
    });
  });

  describe('compact granularity', () => {
    it('returns top 2 units for multi-unit durations', () => {
      expect(formatRelativeTime('2026-07-02T10:13:00.000Z', { granularity: 'compact' })).toBe('2d 1h ago');
    });

    it('returns single unit when only one is non-zero', () => {
      expect(formatRelativeTime('2026-07-04T10:00:00.000Z', { granularity: 'compact' })).toBe('2h ago');
    });
  });

  describe('full granularity', () => {
    it('returns all non-zero units', () => {
      expect(formatRelativeTime('2026-07-02T10:13:47.000Z', { granularity: 'full' })).toBe('2d 1h 46m ago');
    });

    it('returns single unit when only one is non-zero', () => {
      expect(formatRelativeTime('2026-07-04T10:00:00.000Z', { granularity: 'full' })).toBe('2h ago');
    });

    it('returns "just now" when less than a minute ago', () => {
      expect(formatRelativeTime('2026-07-04T11:59:30.000Z', { granularity: 'full' })).toBe('just now');
    });
  });
});
