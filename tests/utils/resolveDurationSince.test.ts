import { resolveDurationSince } from '../../src/utils/index.js';

import { describe, expect, it, jest } from '@jest/globals';

const MS_PER_DAY = 86_400_000;
const FIXED_NOW = 1_756_800_000_000;

describe('resolveDurationSince', () => {
  const withNow = (fn: () => void) => {
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    fn();
  };

  it('defaults to 24h when rawQuery is undefined', () => {
    withNow(() => {
      expect(resolveDurationSince(undefined)).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
    });
  });

  it('defaults to 24h when rawQuery is not a string', () => {
    withNow(() => {
      expect(resolveDurationSince(42)).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
      expect(resolveDurationSince(['2d'])).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
    });
  });

  it('defaults to 24h when rawQuery is an empty string', () => {
    withNow(() => {
      expect(resolveDurationSince('')).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
    });
  });

  it('returns 24h offset for the 24h key', () => {
    withNow(() => {
      expect(resolveDurationSince('24h')).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
    });
  });

  it('returns correct offset for each valid duration', () => {
    withNow(() => {
      expect(resolveDurationSince('2d')).toStrictEqual(new Date(FIXED_NOW - 2 * MS_PER_DAY));
      expect(resolveDurationSince('3d')).toStrictEqual(new Date(FIXED_NOW - 3 * MS_PER_DAY));
      expect(resolveDurationSince('5d')).toStrictEqual(new Date(FIXED_NOW - 5 * MS_PER_DAY));
      expect(resolveDurationSince('1w')).toStrictEqual(new Date(FIXED_NOW - 7 * MS_PER_DAY));
    });
  });

  it('defaults to 24h for unrecognized duration values', () => {
    withNow(() => {
      expect(resolveDurationSince('invalid')).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
      expect(resolveDurationSince('10d')).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
    });
  });

  it('rejects prototype keys like toString via Object.hasOwn', () => {
    withNow(() => {
      expect(resolveDurationSince('toString')).toStrictEqual(new Date(FIXED_NOW - MS_PER_DAY));
    });
  });
});
