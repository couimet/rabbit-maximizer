import { DetailedResult } from '../src/external-deps/couimet/detailed-result/DetailedResult.js';
import { DetailedResultErrorCodes } from '../src/external-deps/couimet/detailed-result/DetailedResultErrorCodes.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const VALUE = getUniqueInt();
const ERROR_MESSAGE = getUniqueString();

describe('DetailedResult', () => {
  describe('ok', () => {
    it('creates a successful result', () => {
      const result = DetailedResult.ok(VALUE);

      expect(result.success).toBe(true);
      expect(result.value).toBe(VALUE);
    });

    it('throws when accessing error on success result', () => {
      const result = DetailedResult.ok(VALUE);

      expect(() => result.error).toThrowDetailedError(DetailedResultErrorCodes.RESULT_ERROR_ACCESS_ON_SUCCESS, {
        message: 'Cannot access error on a successful Result. Check .success before accessing .error',
        functionName: 'DetailedResult.error',
      });
    });
  });

  describe('err', () => {
    it('creates an error result', () => {
      const result = DetailedResult.err(ERROR_MESSAGE);

      expect(result.success).toBe(false);
      expect(result.error).toBe(ERROR_MESSAGE);
    });

    it('throws when accessing value on error result', () => {
      const result = DetailedResult.err(ERROR_MESSAGE);

      expect(() => result.value).toThrowDetailedError(DetailedResultErrorCodes.RESULT_VALUE_ACCESS_ON_ERROR, {
        message: 'Cannot access value on an error Result. Check .success before accessing .value',
        functionName: 'DetailedResult.value',
      });
    });
  });

  describe('constructor invariants', () => {
    const Ctor = DetailedResult as unknown as new (success: boolean, value?: unknown, error?: unknown) => DetailedResult<unknown, unknown>;

    it('throws when success=true and error is defined', () => {
      expect(() => new Ctor(true, 42, 'error')).toThrowDetailedError(DetailedResultErrorCodes.RESULT_INVALID_STATE, {
        message: 'Result marked as success cannot have an error defined',
        functionName: 'DetailedResult.constructor',
        details: { success: true, hasValue: true, hasError: true },
      });
    });

    it('throws when success=false and value is defined', () => {
      expect(() => new Ctor(false, 42, 'error')).toThrowDetailedError(DetailedResultErrorCodes.RESULT_INVALID_STATE, {
        message: 'Result marked as error cannot have a value defined',
        functionName: 'DetailedResult.constructor',
        details: { success: false, hasValue: true, hasError: true },
      });
    });
  });
});
