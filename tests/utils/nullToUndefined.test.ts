import { nullToUndefined } from '../../src/utils/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('nullToUndefined', () => {
  it('returns the value for a non-null value', () => {
    const value = getUniqueString();
    expect(nullToUndefined(value)).toBe(value);
  });

  it('returns undefined for null', () => {
    expect(nullToUndefined(null)).toBeUndefined();
  });
});
