import { getAttribute } from '../src/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { ExecutionContext } from '@couimet/execution-context';
import { beforeEach, describe, expect, it } from '@jest/globals';

const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

const ATTRIBUTES = {
  attempt: { key: 'attempt' },
  runId: { key: 'run_id', isValid: isNonBlankString },
} as const;

describe('getAttribute', () => {
  let correlationId: string;
  let requestId: string;

  beforeEach(() => {
    correlationId = getUniqueString();
    requestId = getUniqueString();
  });

  const runWith = <T>(attributes: Record<string, unknown>, fn: () => T): T => ExecutionContext.run({ correlationId, requestId, attributes }, fn);

  it('returns the value of a declaration that carries a rule', () => {
    const runId = getUniqueString();

    const seen = runWith({ run_id: runId }, () => getAttribute(ATTRIBUTES.runId));

    expect(seen).toBe(runId);
  });

  it('returns the value of a declaration that carries no rule', () => {
    const attempt = getUniqueInt();

    const seen = runWith({ attempt }, () => getAttribute(ATTRIBUTES.attempt));

    expect(seen).toBe(attempt);
  });

  it('returns the value of a raw key', () => {
    const runId = getUniqueString();

    const seen = runWith({ run_id: runId }, () => getAttribute('run_id'));

    expect(seen).toBe(runId);
  });

  it('runs no rule for a raw key', () => {
    const blank = '   ';

    const seen = runWith({ run_id: blank }, () => getAttribute('run_id'));

    expect(seen).toBe(blank);
  });

  it('throws when no writer set the declared attribute', () => {
    runWith({}, () => {
      expect(() => getAttribute(ATTRIBUTES.runId)).toThrowDetailedError('MISSING_CONTEXT_ATTRIBUTE', {
        message: 'Active execution context is missing the attribute',
        functionName: 'getAttribute',
        details: { key: 'run_id' },
      });
    });
  });

  it('throws when no writer set the raw key', () => {
    runWith({}, () => {
      expect(() => getAttribute('run_id')).toThrowDetailedError('MISSING_CONTEXT_ATTRIBUTE', {
        message: 'Active execution context is missing the attribute',
        functionName: 'getAttribute',
        details: { key: 'run_id' },
      });
    });
  });

  it('throws when the value fails its rule', () => {
    const blank = '   ';

    runWith({ run_id: blank }, () => {
      expect(() => getAttribute(ATTRIBUTES.runId)).toThrowDetailedError('INVALID_ATTRIBUTE_VALUE', {
        message: 'Attribute value failed its validation rule',
        functionName: 'getAttribute',
        details: { key: 'run_id', value: blank },
      });
    });
  });

  it('throws when the value is not of the declared type', () => {
    const notAString = getUniqueInt();

    runWith({ run_id: notAString }, () => {
      expect(() => getAttribute(ATTRIBUTES.runId)).toThrowDetailedError('INVALID_ATTRIBUTE_VALUE', {
        message: 'Attribute value failed its validation rule',
        functionName: 'getAttribute',
        details: { key: 'run_id', value: notAString },
      });
    });
  });

  it('throws outside any run', () => {
    expect(() => getAttribute(ATTRIBUTES.runId)).toThrowDetailedError('MISSING_CONTEXT_ATTRIBUTE', {
      message: 'Active execution context is missing the attribute',
      functionName: 'getAttribute',
      details: { key: 'run_id' },
    });
  });
});
