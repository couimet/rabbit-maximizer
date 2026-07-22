import { nullableString } from '../../src/utils/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('nullableString', () => {
  it('returns the string for a defined value', () => {
    const value = getUniqueString();
    expect(nullableString(value)).toBe(value);
  });

  it('returns null for undefined', () => {
    expect(nullableString(undefined)).toBeNull();
  });
});
