/**
 * Rabbit Maximizer error codes.
 *
 * Architecture principles:
 * - No ERR_ prefix: If defined here, it's an error
 * - Values are descriptive strings (same as keys) for clear context in logs
 * - Core errors stay English (industry standard — like TypeScript/Git/JavaScript)
 *
 * Please keep alphabetical order for ease of maintenance.
 */
export enum RabbitMaximizerErrorCodes {
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',

  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  GITHUB_AUTH_ERROR = 'GITHUB_AUTH_ERROR',
  GITHUB_NOT_FOUND = 'GITHUB_NOT_FOUND',
  GITHUB_RATE_LIMITED = 'GITHUB_RATE_LIMITED',
  PRISMA_CONNECTION_METHOD_NOT_SUPPORTED = 'PRISMA_CONNECTION_METHOD_NOT_SUPPORTED',

  QUEUE_ITEM_NOT_FOUND = 'QUEUE_ITEM_NOT_FOUND',

  RESULT_ERROR_ACCESS_ON_SUCCESS = 'RESULT_ERROR_ACCESS_ON_SUCCESS',
  RESULT_INVALID_STATE = 'RESULT_INVALID_STATE',
  RESULT_VALUE_ACCESS_ON_ERROR = 'RESULT_VALUE_ACCESS_ON_ERROR',

  SERVER_ADDRESS_NOT_AVAILABLE = 'SERVER_ADDRESS_NOT_AVAILABLE',

  TOKEN_VALIDATION_EMPTY_FILTER = 'TOKEN_VALIDATION_EMPTY_FILTER',
}
