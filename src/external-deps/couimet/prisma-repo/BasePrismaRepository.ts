import { SoftDeleteConfig } from '../prisma-extension-soft-delete/src/index.js';

import { PrismaFieldTypeMismatchError } from './PrismaFieldTypeMismatchError.js';
import { PrismaRecordNotFoundError } from './PrismaRecordNotFoundError.js';
import { PrismaUniqueConstraintViolationError } from './PrismaUniqueConstraintViolationError.js';
import { SoftDeleteNotConfiguredError } from './SoftDeleteNotConfiguredError.js';

import type { Logger } from '@couimet/logger-contract';
import { Prisma, type PrismaClient } from '@prisma/client';

export interface RepositoryOptions {
  readonly softDelete?: SoftDeleteConfig | true;
}

export abstract class BasePrismaRepository {
  protected readonly softDelete: SoftDeleteConfig | undefined;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly modelName: Prisma.ModelName,
    protected readonly log: Logger,
    opts?: RepositoryOptions,
  ) {
    if (opts?.softDelete === true) {
      this.softDelete = new SoftDeleteConfig();
    } else if (opts?.softDelete instanceof SoftDeleteConfig) {
      this.softDelete = opts.softDelete;
    }
  }

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
  protected async withPrismaErrorHandling<T>(operation: () => Promise<T>, functionName: string): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
          case 'P2025':
            this.log.debug({ fn: functionName, modelName: this.modelName, prismaCode: err.code }, 'Prisma record not found, throwing typed error');
            throw new PrismaRecordNotFoundError({ tableName: this.modelName, functionName, cause: err });
          case 'P2002':
            this.log.debug({ fn: functionName, modelName: this.modelName, prismaCode: err.code }, 'Unique constraint violation, throwing typed error');
            throw new PrismaUniqueConstraintViolationError({ tableName: this.modelName, functionName, cause: err });
          case 'P2005':
            this.log.debug({ fn: functionName, modelName: this.modelName, prismaCode: err.code }, 'Prisma field type mismatch, throwing typed error');
            throw new PrismaFieldTypeMismatchError({ tableName: this.modelName, functionName, cause: err });
          default:
            this.log.warn(
              { fn: functionName, modelName: this.modelName, prismaCode: err.code, error: err },
              'Unrecognized Prisma error code, rethrowing original',
            );
            throw err;
        }
      }
      throw err;
    }
  }

  /**
   * Soft-deletes an active row by setting the configured soft-delete columns.
   *
   * The {@link where} clause identifies the row (e.g. `{ comment_id: 42 }`).
   * The base class merges it with the active-record filter before applying the
   * soft-delete marker so only a non-deleted row is affected.
   */

  protected async softDeleteRow(where: Record<string, unknown>, tx?: Prisma.TransactionClient): Promise<void> {
    if (!this.softDelete) {
      throw new SoftDeleteNotConfiguredError({ tableName: this.modelName, functionName: 'softDeleteRow' });
    }
    const db = this.client(tx);
    const delegateName = String(this.modelName).charAt(0).toLowerCase() + String(this.modelName).slice(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (db as any)[delegateName];
    await delegate.updateMany({
      where: { ...where, ...this.softDelete.activeFilter },
      data: this.softDelete.softDeleteMarker(),
    });
    this.log.debug({ fn: 'BasePrismaRepository.softDeleteRow', modelName: this.modelName }, 'Deactivated row');
  }
}
