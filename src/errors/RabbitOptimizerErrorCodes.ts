/**
 * Rabbit Optimizer error codes.
 *
 * Architecture principles:
 * - No ERR_ prefix: If defined here, it's an error
 * - Values are descriptive strings (same as keys) for clear context in logs
 * - Core errors stay English (industry standard — like TypeScript/Git/JavaScript)
 *
 * Please keep alphabetical order for ease of maintenance.
 */
export enum RabbitOptimizerErrorCodes {
  //
  // Config errors
  //
  CONFIG_VALIDATION_FAILED = "CONFIG_VALIDATION_FAILED",

  //
  // Result type errors
  //
  RESULT_ERROR_ACCESS_ON_SUCCESS = "RESULT_ERROR_ACCESS_ON_SUCCESS",
  RESULT_INVALID_STATE = "RESULT_INVALID_STATE",
  RESULT_VALUE_ACCESS_ON_ERROR = "RESULT_VALUE_ACCESS_ON_ERROR",
}
