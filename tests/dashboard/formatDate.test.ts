import { formatDate } from '../../dashboard/src/formatDate.js';
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
});
