import { RequestId } from '../src/index.js';

import { BLANK_VALUE, SOURCE_VALUE, UUID_V4_PATTERN, WHITESPACE_VALUE } from './idTestValues.js';

import { describe, expect, it } from '@jest/globals';

describe('RequestId', () => {
  it('creates a uuid v4 value', () => {
    expect(RequestId.create().toString()).toMatch(UUID_V4_PATTERN);
  });

  it('creates distinct values on repeated calls', () => {
    expect(RequestId.create().toString()).not.toBe(RequestId.create().toString());
  });

  it('round-trips through fromString and toString', () => {
    expect(RequestId.fromString(SOURCE_VALUE).toString()).toBe(SOURCE_VALUE);
  });

  it('rejects an empty string from fromString', () => {
    expect(() => RequestId.fromString(BLANK_VALUE)).toThrowDetailedError('INVALID_BLANK_REQUEST_ID', {
      message: 'requestId must be a non-blank string',
      functionName: 'RequestId.fromString',
      details: { value: BLANK_VALUE },
    });
  });

  it('rejects a whitespace-only string from fromString', () => {
    expect(() => RequestId.fromString(WHITESPACE_VALUE)).toThrowDetailedError('INVALID_BLANK_REQUEST_ID', {
      message: 'requestId must be a non-blank string',
      functionName: 'RequestId.fromString',
      details: { value: WHITESPACE_VALUE },
    });
  });

  it('passes a valid value through fromStringOrCreate', () => {
    expect(RequestId.fromStringOrCreate(SOURCE_VALUE).toString()).toBe(SOURCE_VALUE);
  });

  it('generates an id from fromStringOrCreate when the value is undefined', () => {
    expect(RequestId.fromStringOrCreate(undefined).toString()).toMatch(UUID_V4_PATTERN);
  });

  it('generates an id from fromStringOrCreate when the value is blank', () => {
    expect(RequestId.fromStringOrCreate(BLANK_VALUE).toString()).toMatch(UUID_V4_PATTERN);
  });

  it('generates an id from fromStringOrCreate when the value is whitespace', () => {
    expect(RequestId.fromStringOrCreate(WHITESPACE_VALUE).toString()).toMatch(UUID_V4_PATTERN);
  });
});
