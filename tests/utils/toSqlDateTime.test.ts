import { toSqlDateTime } from '../../src/utils/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('toSqlDateTime', () => {
  it('writes the UTC offset form that Prisma stores in a SQLite datetime column', () => {
    const date = new Date('2026-10-17T12:34:56.789Z');

    const result = toSqlDateTime(date);

    expect(result).toBe('2026-10-17T12:34:56.789+00:00');
  });

  it('keeps the instant of the given date', () => {
    const date = getUniqueDate();

    const result = toSqlDateTime(date);

    expect(new Date(result).getTime()).toBe(date.getTime());
  });

  it('sorts lexicographically in the same order as the instants', () => {
    const earlier = new Date('2026-01-02T03:04:05.000Z');
    const later = new Date('2026-01-02T03:04:06.000Z');

    expect(toSqlDateTime(earlier) < toSqlDateTime(later)).toBe(true);
  });
});
