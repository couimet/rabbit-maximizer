import { getUniqueDates, getUniqueDatesNamed, getUniqueInts, getUniqueIntsNamed } from '../../../../src/external-deps/couimet/dynamic-testing/unique.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('getUniqueInts', () => {
  it('returns an array of the requested length', () => {
    const startingPoint = getUniqueInt();
    const result = getUniqueInts(5);

    expect(result).toHaveLength(5);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(startingPoint + i + 1);
    }
  });

  it('returns unique values', () => {
    const result = getUniqueInts(3);

    expect(new Set(result).size).toBe(3);
  });

  it('throws for count 0', () => {
    expect(() => getUniqueInts(0)).toThrow('COUNT_NOT_POSITIVE_INTEGER: count must be a positive integer, received 0');
  });
});

describe('getUniqueIntsNamed', () => {
  it('returns an object with the given keys mapped to unique integers', () => {
    const result = getUniqueIntsNamed(['alpha', 'beta', 'gamma']);

    expect(Object.keys(result)).toStrictEqual(['alpha', 'beta', 'gamma']);
  });

  it('each value is a unique integer', () => {
    const result = getUniqueIntsNamed(['a', 'b', 'c']);

    const values = Object.values(result);
    expect(new Set(values).size).toBe(3);
    for (const value of values) {
      expect(typeof value).toBe('number');
    }
  });

  it('returns an empty object for an empty keys array', () => {
    const result = getUniqueIntsNamed([]);

    expect(result).toStrictEqual({});
  });
});

describe('getUniqueDates', () => {
  it('returns an array of the requested length', () => {
    const result = getUniqueDates(3);

    expect(result).toHaveLength(3);
    for (const date of result) {
      expect(date).toBeInstanceOf(Date);
    }
  });

  it('returns unique values', () => {
    const result = getUniqueDates(3);

    const timestamps = result.map((d: Date) => d.getTime());
    expect(new Set(timestamps).size).toBe(3);
  });

  it('throws for count 0', () => {
    expect(() => getUniqueDates(0)).toThrow('COUNT_NOT_POSITIVE_INTEGER: count must be a positive integer, received 0');
  });
});

describe('getUniqueDatesNamed', () => {
  it('returns an object with the given keys mapped to unique dates', () => {
    const result = getUniqueDatesNamed(['first', 'second']);

    expect(Object.keys(result)).toStrictEqual(['first', 'second']);
    for (const date of Object.values(result)) {
      expect(date).toBeInstanceOf(Date);
    }
  });

  it('each value is unique', () => {
    const result = getUniqueDatesNamed(['x', 'y', 'z']);

    const timestamps = Object.values(result).map((d: Date) => d.getTime());
    expect(new Set(timestamps).size).toBe(3);
  });

  it('returns an empty object for an empty keys array', () => {
    const result = getUniqueDatesNamed([]);

    expect(result).toStrictEqual({});
  });
});
