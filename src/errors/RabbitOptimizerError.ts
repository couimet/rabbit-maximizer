import { DetailedError, ErrorOptions } from "./detailedError.js";
import type { RabbitOptimizerErrorCodes } from "./RabbitOptimizerErrorCodes.js";

/**
 * Base error class for all Rabbit Optimizer errors.
 *
 * Extends DetailedError to provide structured error information with:
 * - Typed error codes (RabbitOptimizerErrorCodes enum)
 * - Function name tracking
 * - Contextual details object
 * - Cause chaining
 */
export class RabbitOptimizerError extends DetailedError<RabbitOptimizerErrorCodes> {
  constructor(options: ErrorOptions<RabbitOptimizerErrorCodes>) {
    super(options);
    this.name = "RabbitOptimizerError";

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RabbitOptimizerError);
    }
  }
}
