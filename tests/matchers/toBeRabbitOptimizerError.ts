import type { ErrorDetails } from '../../src/errors/detailedError.js';
import { RabbitOptimizerError } from '../../src/errors/RabbitOptimizerError.js';

import { expect } from '@jest/globals';

interface CustomMatcherResult {
  pass: boolean;
  message(): string;
}

// Error code is passed as a separate string parameter to enforce string literal usage.
export interface ExpectedRabbitOptimizerError {
  message: string;
  functionName: string;
  details?: ErrorDetails;
  cause?: Error;
}

export const toBeRabbitOptimizerError = (received: unknown, expectedCode: string, expected: ExpectedRabbitOptimizerError): CustomMatcherResult => {
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
    failures.push(`  Message:\n    expected: "${expected.message}"\n    received: "${error.message}"`);
  }

  if (error.functionName !== expected.functionName) {
    failures.push(`  Function name: expected "${expected.functionName}", received "${error.functionName || 'undefined'}"`);
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
      const expectedCauseMsg = expected.cause instanceof Error ? expected.cause.message : 'undefined';
      const receivedCauseMsg = error.cause instanceof Error ? (error.cause as Error).message : 'undefined';
      failures.push(`  Cause: expected ${expectedCauseMsg}, received ${receivedCauseMsg}`);
    }
  } else if (error.cause !== undefined) {
    const causeMsg = error.cause instanceof Error ? (error.cause as Error).message : String(error.cause);
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

export const toThrowRabbitOptimizerError = (received: () => void, expectedCode: string, expected: ExpectedRabbitOptimizerError): CustomMatcherResult => {
  let caughtError: unknown;

  try {
    received();
  } catch (error) {
    caughtError = error;
  }

  if (caughtError === undefined) {
    return {
      pass: false,
      message: () => `Expected function to throw RabbitOptimizerError with code "${expectedCode}", but nothing was thrown`,
    };
  }

  return toBeRabbitOptimizerError(caughtError, expectedCode, expected);
};

export const toThrowRabbitOptimizerErrorAsync = async (
  received: () => Promise<void>,
  expectedCode: string,
  expected: ExpectedRabbitOptimizerError,
): Promise<CustomMatcherResult> => {
  let caughtError: unknown;

  try {
    await received();
  } catch (error) {
    caughtError = error;
  }

  if (caughtError === undefined) {
    return {
      pass: false,
      message: () => `Expected async function to throw RabbitOptimizerError with code "${expectedCode}", but nothing was thrown`,
    };
  }

  return toBeRabbitOptimizerError(caughtError, expectedCode, expected);
};
