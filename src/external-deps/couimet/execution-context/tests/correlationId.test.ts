import { CorrelationId } from '../src/index.js';

import { BLANK_VALUE, SOURCE_VALUE, UUID_V4_PATTERN, WHITESPACE_VALUE } from './idTestValues.js';

import { describe, expect, it } from '@jest/globals';

describe('CorrelationId', () => {
  it('creates a uuid v4 value', () => {
    expect(CorrelationId.create().toString()).toMatch(UUID_V4_PATTERN);
  });

  it('creates distinct values on repeated calls', () => {
    expect(CorrelationId.create().toString()).not.toBe(CorrelationId.create().toString());
  });

  it('round-trips through fromString and toString', () => {
    expect(CorrelationId.fromString(SOURCE_VALUE).toString()).toBe(SOURCE_VALUE);
  });

  it('rejects an empty string from fromString', () => {
    expect(() => CorrelationId.fromString(BLANK_VALUE)).toThrowDetailedError('INVALID_BLANK_CORRELATION_ID', {
      message: 'correlationId must be a non-blank string',
      functionName: 'CorrelationId.fromString',
      details: { value: BLANK_VALUE },
    });
  });

  it('rejects a whitespace-only string from fromString', () => {
    expect(() => CorrelationId.fromString(WHITESPACE_VALUE)).toThrowDetailedError('INVALID_BLANK_CORRELATION_ID', {
      message: 'correlationId must be a non-blank string',
      functionName: 'CorrelationId.fromString',
      details: { value: WHITESPACE_VALUE },
    });
  });

  it('passes a valid value through fromStringOrCreate', () => {
    expect(CorrelationId.fromStringOrCreate(SOURCE_VALUE).toString()).toBe(SOURCE_VALUE);
  });

  it('generates an id from fromStringOrCreate when the value is undefined', () => {
    expect(CorrelationId.fromStringOrCreate(undefined).toString()).toMatch(UUID_V4_PATTERN);
  });

  it('generates an id from fromStringOrCreate when the value is blank', () => {
    expect(CorrelationId.fromStringOrCreate(BLANK_VALUE).toString()).toMatch(UUID_V4_PATTERN);
  });

  it('generates an id from fromStringOrCreate when the value is whitespace', () => {
    expect(CorrelationId.fromStringOrCreate(WHITESPACE_VALUE).toString()).toMatch(UUID_V4_PATTERN);
  });
});
