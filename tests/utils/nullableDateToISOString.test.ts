import { nullableDateToISOString } from '../../src/utils/nullableDateToISOString.js';

import { describe, expect, it } from '@jest/globals';

describe('nullableDateToISOString', () => {
  it('returns ISO string for a valid date', () => {
    const date = new Date('2026-07-21T01:48:19.888Z');

    const result = nullableDateToISOString(date);

    expect(result).toBe('2026-07-21T01:48:19.888Z');
  });

  it('returns null for undefined', () => {
    const result = nullableDateToISOString(undefined);

    expect(result).toBeNull();
  });

  it('returns null for null', () => {
    const result = nullableDateToISOString(null);

    expect(result).toBeNull();
  });

  it('returns null for an invalid date', () => {
    const result = nullableDateToISOString(new Date('not-a-date'));

    expect(result).toBeNull();
  });
});
