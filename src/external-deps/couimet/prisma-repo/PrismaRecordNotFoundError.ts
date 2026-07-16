import { PrismaErrorCodes } from './PrismaErrorCodes.js';
import type { PrismaErrorOptions } from './PrismaErrorOptions.js';

import { DetailedError } from '@couimet/detailed-error';

/**
 * A Prisma `update` or `delete` operation matched zero rows (P2025).
 *
 * The record was deleted between fetch and mutation, or the identifier
 * is stale. Callers can use {@link instanceof} or check {@link code}
 * against {@link PrismaErrorCodes.PRISMA_RECORD_NOT_FOUND_P2025}.
 */
export class PrismaRecordNotFoundError extends DetailedError<PrismaErrorCodes.PRISMA_RECORD_NOT_FOUND_P2025> {
  constructor(options: PrismaErrorOptions) {
    super({
      code: PrismaErrorCodes.PRISMA_RECORD_NOT_FOUND_P2025,
      message: `Record not found in table '${options.tableName}'`,
      functionName: options.functionName,
      details: { tableName: options.tableName, ...options.details },
      cause: options.cause,
    });
    this.name = 'PrismaRecordNotFoundError';
  }
}
