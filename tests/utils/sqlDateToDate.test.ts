import { sqlDateToDate } from '../../src/utils/sqlDateToDate.js';

import { describe, expect, it } from '@jest/globals';

describe('sqlDateToDate', () => {
  it('returns the Date for a valid date', () => {
    const date = new Date('2026-07-21T01:48:19.888Z');

    const result = sqlDateToDate(date);

    expect(result).toBe(date);
  });

  it('returns undefined for null', () => {
    const result = sqlDateToDate(null);

    expect(result).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    const result = sqlDateToDate(undefined);

    expect(result).toBeUndefined();
  });

  it('returns undefined for an invalid date', () => {
    const result = sqlDateToDate(new Date('not-a-date'));

    expect(result).toBeUndefined();
  });
});
