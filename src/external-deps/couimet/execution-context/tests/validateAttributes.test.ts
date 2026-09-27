import { validateAttributes } from '../src/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const ATTRIBUTES = {
  runId: { key: 'run_id', isValid: isNonBlankString },
  version: { key: 'version', isValid: isNonBlankString },
} as const;

const UNRULED_ATTRIBUTES = {
  attempt: { key: 'attempt' },
} as const;

describe('validateAttributes', () => {
  it('maps every entry to the key its declaration carries', () => {
    const runId = getUniqueString();
    const version = getUniqueString();

    const attrs = validateAttributes(ATTRIBUTES, { runId, version });

    expect(attrs).toStrictEqual({ run_id: runId, version });
  });

  it('omits a declared attribute the caller passes no entry for', () => {
    const runId = getUniqueString();

    const attrs = validateAttributes(ATTRIBUTES, { runId });

    expect(attrs).toStrictEqual({ run_id: runId });
  });

  it('accepts any value for a declaration that carries no rule', () => {
    const attempt = getUniqueInt();

    const attrs = validateAttributes(UNRULED_ATTRIBUTES, { attempt });

    expect(attrs).toStrictEqual({ attempt });
  });

  it('throws when a value fails its rule', () => {
    const blankVersion = '   ';

    expect(() => validateAttributes(ATTRIBUTES, { version: blankVersion })).toThrowDetailedError('INVALID_ATTRIBUTE_VALUE', {
      message: 'Attribute value failed its validation rule',
      functionName: 'validateAttributes',
      details: { key: 'version', value: blankVersion },
    });
  });
});
