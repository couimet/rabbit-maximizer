import { nullableDateToISOString } from '../../src/utils/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('nullableDateToISOString', () => {
  it('returns ISO string for a valid date', () => {
    const date = getUniqueDate();

    const result = nullableDateToISOString(date);

    expect(result).toBe(date.toISOString());
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
