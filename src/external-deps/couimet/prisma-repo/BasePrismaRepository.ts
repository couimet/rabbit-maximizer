import { PrismaFieldTypeMismatchError } from './PrismaFieldTypeMismatchError.js';
import { PrismaRecordNotFoundError } from './PrismaRecordNotFoundError.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';

export abstract class BasePrismaRepository {
  constructor(
    private readonly prisma: PrismaClient,
    protected readonly log: Logger,
  ) {}

  protected client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prisma;
  }

  /**
   * Ensures the callback always receives a {@link Prisma.TransactionClient}.
   *
   * When {@link tx} is provided it is passed through. When {@link tx} is
   * undefined the callback runs inside {@link PrismaClient.$transaction}.
   * Eliminates the guard that every method with optional `tx` would otherwise
   * need to ensure all operations share a transaction.
   */
  protected enforceTx<T>(tx: Prisma.TransactionClient | undefined, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (tx) {
      return fn(tx);
    }
    return this.prisma.$transaction((tx) => fn(tx));
  }

  /**
   * Executes a Prisma operation and maps known P-codes to typed errors.
   *
   * The {@link operation} callback receives no arguments and must close over
   * the transaction client. This preserves full Prisma type inference through
   * the generic `T` while centralizing the error mapping in one place.
   */
  protected async withPrismaErrorHandling<T>(modelName: string, operation: () => Promise<T>, functionName: string): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
          case 'P2025':
            this.log.debug({ fn: functionName, modelName, prismaCode: err.code }, 'Prisma record not found, throwing typed error');
            throw new PrismaRecordNotFoundError({ tableName: modelName, functionName, cause: err });
          case 'P2005':
            this.log.debug({ fn: functionName, modelName, prismaCode: err.code }, 'Prisma field type mismatch, throwing typed error');
            throw new PrismaFieldTypeMismatchError({ tableName: modelName, functionName, cause: err });
          default:
            this.log.warn({ fn: functionName, modelName, prismaCode: err.code, error: err }, 'Unrecognized Prisma error code, rethrowing original');
            throw err;
        }
      }
      throw err;
    }
  }
}
