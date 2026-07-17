import { PrismaErrorCodes } from './PrismaErrorCodes.js';
import type { PrismaErrorOptions } from './PrismaErrorOptions.js';

import { DetailedError } from '@couimet/detailed-error';

/**
 * A unique constraint was violated in a Prisma operation (P2002).
 *
 * Indicates a duplicate value for a unique column or composite unique
 * constraint. Callers can use {@link instanceof} or check {@link code}
 * against {@link PrismaErrorCodes.PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002}.
 */
export class PrismaUniqueConstraintViolationError extends DetailedError<PrismaErrorCodes.PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002> {
  constructor(options: PrismaErrorOptions) {
    super({
      code: PrismaErrorCodes.PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002,
      message: `Unique constraint violation in table '${options.tableName}'`,
      functionName: options.functionName,
      details: { tableName: options.tableName, ...options.details },
      cause: options.cause,
    });
    this.name = 'PrismaUniqueConstraintViolationError';
  }
}
