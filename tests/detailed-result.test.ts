import { RabbitMaximizerError } from '../src/errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from '../src/errors/RabbitMaximizerErrorCodes.js';
import { RabbitResult } from '../src/types/RabbitResult.js';

import { DetailedResult } from '@couimet/detailed-result';
import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('RabbitResult', () => {
  let value: number;
  let errorMessage: string;

  beforeEach(() => {
    value = getUniqueInt();
    errorMessage = getUniqueString();
  });

  const createError = (message: string): RabbitMaximizerError =>
    new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_PENDING,
      message,
      functionName: 'test',
    });

  describe('ok', () => {
    it('creates a successful result that is an instanceof DetailedResult', () => {
      const result = RabbitResult.ok(value);

      expect(result).toBeInstanceOf(DetailedResult);
      expect(result).toBeInstanceOf(RabbitResult);
      expect(result.success).toBe(true);
      expect(result.value).toBe(value);
    });

    it('throws when accessing error on success result', () => {
      const result = RabbitResult.ok(value);

      expect(() => result.error).toThrowDetailedError('RESULT_ERROR_ACCESS_ON_SUCCESS', {
        message: 'Cannot access error on a successful DetailedResult. Check .success before accessing .error',
        functionName: 'DetailedResult.error',
      });
    });
  });

  describe('err', () => {
    it('creates an error result that is an instanceof DetailedResult', () => {
      const error = createError(errorMessage);
      const result = RabbitResult.err(error);

      expect(result).toBeInstanceOf(DetailedResult);
      expect(result).toBeInstanceOf(RabbitResult);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });

    it('throws when accessing value on error result', () => {
      const result = RabbitResult.err(createError(errorMessage));

      expect(() => result.value).toThrowDetailedError('RESULT_VALUE_ACCESS_ON_ERROR', {
        message: 'Cannot access value on an error DetailedResult. Check .success before accessing .value',
        functionName: 'DetailedResult.value',
      });
    });
  });
});
