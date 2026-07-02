import { formatDate } from '../../src/utils/formatDate.js';

import { describe, expect, it } from '@jest/globals';

describe('formatDate', () => {
  it('formats an ISO 8601 string to YYYY-MM-DD HH:MM:SS', () => {
    expect(formatDate('2026-06-23T14:30:00.000Z')).toBe('2026-06-23 14:30:00');
  });

  it('preserves UTC — does not apply local offset', () => {
    expect(formatDate('2026-01-01T03:00:00.000Z')).toBe('2026-01-01 03:00:00');
  });

  it('zero-pads single-digit months, days, hours, minutes, and seconds', () => {
    expect(formatDate('2026-02-05T09:07:03.000Z')).toBe('2026-02-05 09:07:03');
  });

  it('returns fallback string when given an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date');
  });

  describe('timezone', () => {
    it('produces same output for explicit UTC as no timezone param', () => {
      expect(formatDate('2026-06-23T14:30:00.000Z', 'UTC')).toBe('2026-06-23 14:30:00');
    });

    it('formats in a non-UTC timezone', () => {
      expect(formatDate('2026-06-23T14:30:00.000Z', 'America/New_York')).toBe('2026-06-23 10:30:00');
    });

    it('handles positive UTC offsets', () => {
      expect(formatDate('2026-06-23T14:30:00.000Z', 'Europe/Paris')).toBe('2026-06-23 16:30:00');
    });

    it('returns fallback string for invalid date with timezone param', () => {
      expect(formatDate('not-a-date', 'America/New_York')).toBe('Invalid date');
    });

    it('returns fallback string for invalid timezone', () => {
      expect(formatDate('2026-06-23T14:30:00.000Z', 'Not/AZone')).toBe('Invalid date');
    });
  });
});
