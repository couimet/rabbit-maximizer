/** @jest-environment jsdom */

import { buildQueryString } from '../../dashboard/src/queryParams.js';

import { describe, expect, it } from '@jest/globals';

describe('buildQueryString', () => {
  it('returns empty string for empty params', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('returns empty string when all values are undefined', () => {
    expect(buildQueryString({ a: undefined, b: undefined })).toBe('');
  });

  it('builds query string from string, number, and boolean values', () => {
    expect(buildQueryString({ page: 2, pageSize: 50 })).toBe('?page=2&pageSize=50');
  });

  it('serializes Date to ISO 8601 string', () => {
    const date = new Date('2026-07-08T14:30:00.000Z');
    expect(buildQueryString({ since: date })).toBe('?since=2026-07-08T14%3A30%3A00.000Z');
  });

  it('skips undefined values but includes defined ones', () => {
    expect(buildQueryString({ a: 1, b: undefined, c: 'hello' })).toBe('?a=1&c=hello');
  });

  it('encodes special characters in keys and values', () => {
    expect(buildQueryString({ 'key with spaces': 'value & more' })).toBe('?key%20with%20spaces=value%20%26%20more');
  });

  it('handles boolean values', () => {
    expect(buildQueryString({ completed: true, active: false })).toBe('?completed=true&active=false');
  });
});
