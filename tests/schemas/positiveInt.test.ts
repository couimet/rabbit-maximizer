import { positiveInt } from '../../src/schemas/positiveInt.js';

import { describe, expect, it } from '@jest/globals';

const CONFIG_KEY = 'POLL_INTERVAL_SEC';
const FALLBACK = 90;

describe('positiveInt', () => {
  it('coerces a numeric string to a number', () => {
    expect(positiveInt(CONFIG_KEY, FALLBACK).parse('120')).toBe(120);
  });

  it('applies the fallback when the value is absent', () => {
    expect(positiveInt(CONFIG_KEY, FALLBACK).parse(undefined)).toBe(FALLBACK);
  });

  it('rejects zero and names the key in the message', () => {
    const { error } = positiveInt(CONFIG_KEY, FALLBACK).safeParse('0');

    expect(error?.issues.map((issue) => issue.message)).toStrictEqual(['POLL_INTERVAL_SEC must be a positive integer']);
  });

  it('rejects a negative value and names the key in the message', () => {
    const { error } = positiveInt(CONFIG_KEY, FALLBACK).safeParse('-5');

    expect(error?.issues.map((issue) => issue.message)).toStrictEqual(['POLL_INTERVAL_SEC must be a positive integer']);
  });

  it('rejects a non-numeric value', () => {
    expect(positiveInt(CONFIG_KEY, FALLBACK).safeParse('abc').success).toBe(false);
  });
});
