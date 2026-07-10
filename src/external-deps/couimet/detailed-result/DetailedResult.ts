import { DetailedResultErrorCodes } from './DetailedResultErrorCodes.js';

import { DetailedError } from '@couimet/detailed-error';

export class DetailedResult<T, E> {
  private readonly _success: boolean;
  private readonly _value?: T;
  private readonly _error?: E;

  protected constructor(success: boolean, value?: T, error?: E) {
    if (success && error !== undefined) {
      throw new DetailedError({
        code: DetailedResultErrorCodes.RESULT_INVALID_STATE,
        message: 'Result marked as success cannot have an error defined',
        functionName: 'DetailedResult.constructor',
        details: { success, hasValue: value !== undefined, hasError: error !== undefined },
      });
    }
    if (!success && value !== undefined) {
      throw new DetailedError({
        code: DetailedResultErrorCodes.RESULT_INVALID_STATE,
        message: 'Result marked as error cannot have a value defined',
        functionName: 'DetailedResult.constructor',
        details: { success, hasValue: value !== undefined, hasError: error !== undefined },
      });
    }
    this._success = success;
    this._value = value;
    this._error = error;
  }

  static ok<T>(value: T): DetailedResult<T, never> {
    return new DetailedResult<T, never>(true, value, undefined);
  }

  static err<E>(error: E): DetailedResult<never, E> {
    return new DetailedResult<never, E>(false, undefined, error);
  }

  get success(): boolean {
    return this._success;
  }

  get value(): T {
    if (!this._success) {
      throw new DetailedError({
        code: DetailedResultErrorCodes.RESULT_VALUE_ACCESS_ON_ERROR,
        message: 'Cannot access value on an error Result. Check .success before accessing .value',
        functionName: 'DetailedResult.value',
      });
    }
    return this._value as T;
  }

  get error(): E {
    if (this._success) {
      throw new DetailedError({
        code: DetailedResultErrorCodes.RESULT_ERROR_ACCESS_ON_SUCCESS,
        message: 'Cannot access error on a successful Result. Check .success before accessing .error',
        functionName: 'DetailedResult.error',
      });
    }
    return this._error as E;
  }
}
