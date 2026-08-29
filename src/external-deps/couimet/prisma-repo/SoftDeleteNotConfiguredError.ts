import { PrismaErrorCodes } from './PrismaErrorCodes.js';
import type { PrismaErrorOptions } from './PrismaErrorOptions.js';

import { DetailedError } from '@couimet/detailed-error';

/**
 * `deactivate()` was called on a repository that did not opt into soft-delete
 * via `{ softDelete: true }` in the constructor options.
 */
export class SoftDeleteNotConfiguredError extends DetailedError<PrismaErrorCodes.SOFT_DELETE_NOT_CONFIGURED> {
  constructor(options: PrismaErrorOptions) {
    super({
      code: PrismaErrorCodes.SOFT_DELETE_NOT_CONFIGURED,
      message: `deactivate() called on '${options.tableName}' but soft-delete is not configured`,
      functionName: options.functionName,
      details: { tableName: options.tableName, ...options.details },
    });
    this.name = 'SoftDeleteNotConfiguredError';
  }
}
