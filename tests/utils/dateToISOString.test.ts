import { dateToISOString } from '../../src/utils/dateToISOString.js';

import { describe, expect, it } from '@jest/globals';

describe('dateToISOString', () => {
  it('returns ISO string for a valid date', () => {
    const date = new Date('2026-07-21T01:48:19.888Z');

    const result = dateToISOString(date);

    expect(result).toBe('2026-07-21T01:48:19.888Z');
  });

  it('returns undefined for undefined', () => {
    const result = dateToISOString(undefined);

    expect(result).toBeUndefined();
  });

  it('returns undefined for null', () => {
    const result = dateToISOString(null);

    expect(result).toBeUndefined();
  });

  it('returns undefined for an invalid date', () => {
    const result = dateToISOString(new Date('not-a-date'));

    expect(result).toBeUndefined();
  });

  it('returns undefined for a date with NaN time', () => {
    const result = dateToISOString(new Date(NaN));

    expect(result).toBeUndefined();
  });
});
