import type { ErrorDetails } from "../../src/errors/detailedError.js";
import { RabbitOptimizerError } from "../../src/errors/RabbitOptimizerError.js";

/**
 * Expected error properties for strict validation.
 * Note: Error code is passed as a separate string parameter to enforce string literal usage.
 */
export interface ExpectedRabbitOptimizerError {
  /** Expected error message - exact match (required) */
  message: string;
  /** Expected function name (required - all RabbitOptimizerErrors must have this) */
  functionName: string;
  /** Expected error details - uses toStrictEqual (optional) */
  details?: ErrorDetails;
  /** Expected cause error (optional) */
  cause?: Error;
}

/**
 * Custom Jest matcher to validate RabbitOptimizerError objects with strict equality.
 * Enforces that all required properties from DetailedError are present and correct.
 *
 * Validates:
 * - Error is actual instance of RabbitOptimizerError class (not just duck-typed)
 * - Code matches exactly (required, passed as string literal)
 * - Message matches exactly (required)
 * - Function name matches exactly (required)
 * - Details match with toStrictEqual (optional)
 * - Cause matches (optional)
 */
export const toBeRabbitOptimizerError = (
  received: unknown,
  expectedCode: string,
  expected: ExpectedRabbitOptimizerError,
): jest.CustomMatcherResult => {
  const failures: string[] = [];

  if (!(received instanceof RabbitOptimizerError)) {
    return {
      pass: false,
      message: () => {
        const receivedType = received?.constructor?.name || typeof received;
        return `Expected value to be an instance of RabbitOptimizerError, but received: ${receivedType}\n  Value: ${JSON.stringify(received)}`;
      },
    };
  }

  const error = received as RabbitOptimizerError;

  if (error.code !== expectedCode) {
    failures.push(`  Code: expected "${expectedCode}", received "${error.code}"`);
  }

  if (error.message !== expected.message) {
    failures.push(
      `  Message:\n    expected: "${expected.message}"\n    received: "${error.message}"`,
    );
  }

  if (error.functionName !== expected.functionName) {
    failures.push(
      `  Function name: expected "${expected.functionName}", received "${error.functionName || 'undefined'}"`,
    );
  }

  if (expected.details !== undefined) {
    try {
      expect(error.details).toStrictEqual(expected.details);
    } catch {
      failures.push(
        `  Details (toStrictEqual):\n    expected: ${JSON.stringify(expected.details, null, 2)}\n    received: ${JSON.stringify(error.details, null, 2)}`,
      );
    }
  } else if (error.details !== undefined) {
    failures.push(`  Details: expected undefined, received ${JSON.stringify(error.details)}`);
  }

  if (expected.cause !== undefined) {
    if (error.cause !== expected.cause) {
      const expectedCauseMsg =
        expected.cause instanceof Error ? expected.cause.message : 'undefined';
      const receivedCauseMsg =
        error.cause instanceof Error ? (error.cause as Error).message : 'undefined';
      failures.push(`  Cause: expected ${expectedCauseMsg}, received ${receivedCauseMsg}`);
    }
  } else if (error.cause !== undefined) {
    const causeMsg =
      error.cause instanceof Error ? (error.cause as Error).message : String(error.cause);
    failures.push(`  Cause: expected undefined, received error with message "${causeMsg}"`);
  }

  const pass = failures.length === 0;

  return {
    pass,
    message: () =>
      pass
        ? `Expected error NOT to match RabbitOptimizerError("${expectedCode}")`
        : `Expected RabbitOptimizerError("${expectedCode}") to match:\n${failures.join('\n')}`,
  };
};

/**
 * Custom Jest matcher for testing synchronous functions that throw RabbitOptimizerError.
 * Follows Jest's standard `.toThrow()` pattern.
 */
export const toThrowRabbitOptimizerError = (
  received: () => void,
  expectedCode: string,
  expected: ExpectedRabbitOptimizerError,
): jest.CustomMatcherResult => {
  let caughtError: unknown;

  try {
    received();
  } catch (error) {
    caughtError = error;
  }

  if (caughtError === undefined) {
    return {
      pass: false,
      message: () =>
        `Expected function to throw RabbitOptimizerError with code "${expectedCode}", but nothing was thrown`,
    };
  }

  return toBeRabbitOptimizerError(caughtError, expectedCode, expected);
};

/**
 * Custom Jest matcher for testing asynchronous functions that throw RabbitOptimizerError.
 * Async version of toThrowRabbitOptimizerError.
 */
export const toThrowRabbitOptimizerErrorAsync = async (
  received: () => Promise<void>,
  expectedCode: string,
  expected: ExpectedRabbitOptimizerError,
): Promise<jest.CustomMatcherResult> => {
  let caughtError: unknown;

  try {
    await received();
  } catch (error) {
    caughtError = error;
  }

  if (caughtError === undefined) {
    return {
      pass: false,
      message: () =>
        `Expected async function to throw RabbitOptimizerError with code "${expectedCode}", but nothing was thrown`,
    };
  }

  return toBeRabbitOptimizerError(caughtError, expectedCode, expected);
};
