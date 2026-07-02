import type { RabbitMaximizerErrorCodes } from './RabbitMaximizerErrorCodes.js';

import { DetailedError, type ErrorOptions, SharedErrorCodes } from '@couimet/detailed-error';

/**
 * Base error class for all Rabbit Maximizer errors.
 *
 * Extends DetailedError to provide structured error information with:
 * - Typed error codes (RabbitMaximizerErrorCodes | SharedErrorCodes)
 * - Function name tracking
 * - Contextual details object
 * - Cause chaining
 */
export class RabbitMaximizerError extends DetailedError<RabbitMaximizerErrorCodes | SharedErrorCodes> {
  constructor(options: ErrorOptions<RabbitMaximizerErrorCodes | SharedErrorCodes>) {
    super(options);
    this.name = 'RabbitMaximizerError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RabbitMaximizerError);
    }
  }
}
