import { PrismaErrorCodes } from './PrismaErrorCodes.js';
import type { PrismaErrorOptions } from './PrismaErrorOptions.js';

import { DetailedError } from '@couimet/detailed-error';

/**
 * A field value doesn't match the column type in a Prisma operation (P2005).
 *
 * Indicates a programming error — the wrong TypeScript type was passed to
 * the Prisma client. Callers can use {@link instanceof} or check {@link code}
 * against {@link PrismaErrorCodes.PRISMA_FIELD_TYPE_MISMATCH_P2005}.
 */
export class PrismaFieldTypeMismatchError extends DetailedError<PrismaErrorCodes.PRISMA_FIELD_TYPE_MISMATCH_P2005> {
  constructor(options: PrismaErrorOptions) {
    super({
      code: PrismaErrorCodes.PRISMA_FIELD_TYPE_MISMATCH_P2005,
      message: `Field type mismatch in table '${options.tableName}'`,
      functionName: options.functionName,
      details: { tableName: options.tableName, ...options.details },
      cause: options.cause,
    });
    this.name = 'PrismaFieldTypeMismatchError';
  }
}
