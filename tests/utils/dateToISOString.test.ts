import { dateToISOString } from '../../src/utils/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('dateToISOString', () => {
  it('returns ISO string for a valid date', () => {
    const date = getUniqueDate();

    const result = dateToISOString(date);

    expect(result).toBe(date.toISOString());
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
