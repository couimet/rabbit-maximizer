import { getUniqueStrings, getUniqueStringsNamed } from '../../../../src/external-deps/couimet/dynamic-testing/unique.js';

import { describe, expect, it } from '@jest/globals';

describe('getUniqueStrings', () => {
  it('returns an array of the requested length', () => {
    const result = getUniqueStrings(3);

    expect(result).toHaveLength(3);
    for (const str of result) {
      expect(typeof str).toBe('string');
    }
  });

  it('returns unique values', () => {
    const result = getUniqueStrings(3);

    expect(new Set(result).size).toBe(3);
  });

  it('throws for count 0', () => {
    expect(() => getUniqueStrings(0)).toThrow('COUNT_NOT_POSITIVE_INTEGER: count must be a positive integer, received 0');
  });
});

describe('getUniqueStringsNamed', () => {
  it('returns an object with the given keys mapped to unique strings', () => {
    const keys = ['alpha', 'beta', 'gamma'];
    const result = getUniqueStringsNamed(keys);

    expect(Object.keys(result)).toStrictEqual(keys);
  });

  it('each value is a unique string', () => {
    const result = getUniqueStringsNamed(['a', 'b', 'c']);

    const values = Object.values(result);
    expect(new Set(values).size).toBe(3);
    for (const value of values) {
      expect(typeof value).toBe('string');
    }
  });

  it('returns an empty object for an empty keys array', () => {
    const result = getUniqueStringsNamed([]);

    expect(result).toStrictEqual({});
  });
});
