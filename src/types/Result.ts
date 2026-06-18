import { RabbitOptimizerError } from "../errors/RabbitOptimizerError.js";
import { RabbitOptimizerErrorCodes } from "../errors/RabbitOptimizerErrorCodes.js";

/**
 * Functional error handling Value Object.
 *
 * Represents either a successful value or an error.
 *
 * Use factory methods to create instances:
 * - `Result.ok(value)` for success
 * - `Result.err(error)` for failure
 *
 * Access value/error safely via getters after checking `.success`:
 * ```typescript
 * if (result.success) {
 *   console.log(result.value); // Safe
 * } else {
 *   console.log(result.error); // Safe
 * }
 * ```
 */
export class Result<T, E> {
  private readonly _success: boolean;
  private readonly _value?: T;
  private readonly _error?: E;

  private constructor(success: boolean, value?: T, error?: E) {
    if (success && error !== undefined) {
      throw new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.RESULT_INVALID_STATE,
        message: "Result marked as success cannot have an error defined",
        functionName: "Result.constructor",
        details: {
          success,
          hasValue: value !== undefined,
          hasError: error !== undefined,
        },
      });
    }
    if (!success && value !== undefined) {
      throw new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.RESULT_INVALID_STATE,
        message: "Result marked as error cannot have a value defined",
        functionName: "Result.constructor",
        details: {
          success,
          hasValue: value !== undefined,
          hasError: error !== undefined,
        },
      });
    }
    this._success = success;
    this._value = value;
    this._error = error;
  }

  /** Create a successful Result containing a value. */
  static ok<T>(value: T): Result<T, never> {
    return new Result<T, never>(true, value, undefined);
  }

  /** Create an error Result containing an error. */
  static err<E>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }

  /** Check if Result is successful. Always check this before accessing `.value` or `.error`. */
  get success(): boolean {
    return this._success;
  }

  /** Get the success value. Throws if Result is an error. */
  get value(): T {
    if (!this._success) {
      throw new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.RESULT_VALUE_ACCESS_ON_ERROR,
        message:
          "Cannot access value on an error Result. Check .success before accessing .value",
        functionName: "Result.value",
      });
    }
    return this._value as T;
  }

  /** Get the error. Throws if Result is successful. */
  get error(): E {
    if (this._success) {
      throw new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.RESULT_ERROR_ACCESS_ON_SUCCESS,
        message:
          "Cannot access error on a successful Result. Check .success before accessing .error",
        functionName: "Result.error",
      });
    }
    return this._error as E;
  }
}
