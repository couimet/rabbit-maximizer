import { stringToNumber } from '../../src/utils/index.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('stringToNumber', () => {
  it('parses a numeric string', () => {
    const value = getUniqueInt();
    expect(stringToNumber(String(value))).toBe(value);
  });

  it('parses a negative number', () => {
    expect(stringToNumber('-42')).toBe(-42);
  });

  it('parses zero', () => {
    expect(stringToNumber('0')).toBe(0);
  });

  it('returns undefined for undefined', () => {
    expect(stringToNumber(undefined)).toBeUndefined();
  });

  it('returns undefined for the empty string', () => {
    expect(stringToNumber('')).toBeUndefined();
  });

  it('returns undefined for a value that is not a number', () => {
    expect(stringToNumber('many')).toBeUndefined();
  });
});
