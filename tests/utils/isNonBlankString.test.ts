import { isNonBlankString } from '../../src/utils/isNonBlankString.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('isNonBlankString', () => {
  it('accepts a string that holds more than space', () => {
    expect(isNonBlankString(getUniqueString())).toBe(true);
  });

  it('accepts a padded string without normalising it', () => {
    expect(isNonBlankString(' abc ')).toBe(true);
  });

  it('rejects the empty string', () => {
    expect(isNonBlankString('')).toBe(false);
  });

  it('rejects a string that holds only space', () => {
    expect(isNonBlankString('   ')).toBe(false);
  });

  it('rejects a value that is not a string', () => {
    expect(isNonBlankString(getUniqueInt())).toBe(false);
  });
});
