import { nullableString } from '../../src/utils/nullableString.js';

import { describe, expect, it } from '@jest/globals';

describe('nullableString', () => {
  it('returns the string for a defined value', () => {
    expect(nullableString('hello')).toBe('hello');
  });

  it('returns null for undefined', () => {
    expect(nullableString(undefined)).toBeNull();
  });
});
