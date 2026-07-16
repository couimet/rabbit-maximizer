import { SoftDeleteConfig } from '../../../../src/external-deps/couimet/prisma-extension-soft-delete/src/SoftDeleteConfig.js';
import { BasePrismaRepository } from '../../../../src/external-deps/couimet/prisma-repo/BasePrismaRepository.js';
import { PrismaFieldTypeMismatchError } from '../../../../src/external-deps/couimet/prisma-repo/PrismaFieldTypeMismatchError.js';
import { PrismaRecordNotFoundError } from '../../../../src/external-deps/couimet/prisma-repo/PrismaRecordNotFoundError.js';
import { createMockPrismaClient } from '../../../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type PrismaClient } from '@prisma/client';

const MODEL_NAME = 'testModel';
const FUNCTION_NAME = 'TestRepo.testMethod';
const MOCK_RESULT = 'result';

class TestRepo extends BasePrismaRepository {
  constructor(prisma: PrismaClient, log: Logger) {
    super(prisma, MODEL_NAME as unknown as Prisma.ModelName, log);
  }

  doUpdate<T>(operation: () => Promise<T>): Promise<T> {
    return this.withPrismaErrorHandling(operation, FUNCTION_NAME);
  }

  doEnforceTx<T>(tx: Prisma.TransactionClient | undefined, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.enforceTx(tx, fn);
  }

  exposeClient(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return this.client(tx);
  }
}

describe('BasePrismaRepository', () => {
  let logger: Logger;
  let repo: TestRepo;

  beforeEach(() => {
    logger = createMockLogger();
    const { prisma } = createMockPrismaClient();
    repo = new TestRepo(prisma, logger);
  });

  describe('client', () => {
    it('returns the root prisma client when no tx is passed', () => {
      const { prisma } = createMockPrismaClient();
      const r = new TestRepo(prisma, logger);
      expect(r.exposeClient()).toBe(prisma);
    });

    it('returns the transaction client when tx is passed', () => {
      const tx = {} as Prisma.TransactionClient;
      expect(repo.exposeClient(tx)).toBe(tx);
    });
  });

  describe('withPrismaErrorHandling', () => {
    it('returns the operation result on success', async () => {
      const value = getUniqueInt();
      const result = await repo.doUpdate(() => Promise.resolve(value));
      expect(result).toBe(value);
    });

    it('maps P2025 to PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });

      await expect(repo.doUpdate(() => Promise.reject(p2025))).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: `Record not found in table '${MODEL_NAME}'`,
        functionName: FUNCTION_NAME,
        details: { tableName: MODEL_NAME },
        cause: p2025,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, modelName: MODEL_NAME, prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );

      try {
        await repo.doUpdate(() => Promise.reject(p2025));
      } catch (err) {
        expect(err).toBeInstanceOf(PrismaRecordNotFoundError);
      }
    });

    it('maps P2005 to PrismaFieldTypeMismatchError', async () => {
      const p2005 = new Prisma.PrismaClientKnownRequestError('Field type mismatch', { code: 'P2005', clientVersion: '7.8.0' });

      await expect(repo.doUpdate(() => Promise.reject(p2005))).rejects.toBeDetailedError('PRISMA_FIELD_TYPE_MISMATCH_P2005', {
        message: `Field type mismatch in table '${MODEL_NAME}'`,
        functionName: FUNCTION_NAME,
        details: { tableName: MODEL_NAME },
        cause: p2005,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, modelName: MODEL_NAME, prismaCode: 'P2005' },
        'Prisma field type mismatch, throwing typed error',
      );

      try {
        await repo.doUpdate(() => Promise.reject(p2005));
      } catch (err) {
        expect(err).toBeInstanceOf(PrismaFieldTypeMismatchError);
      }
    });

    it('rethrows unrecognized Prisma error codes unmodified', async () => {
      const p9999 = new Prisma.PrismaClientKnownRequestError('Unknown', { code: 'P9999', clientVersion: '7.8.0' });

      await expect(repo.doUpdate(() => Promise.reject(p9999))).rejects.toThrow(p9999);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: FUNCTION_NAME, modelName: MODEL_NAME, prismaCode: 'P9999', error: p9999 },
        'Unrecognized Prisma error code, rethrowing original',
      );
    });

    it('rethrows non-Prisma errors unmodified', async () => {
      const genericError = new Error(getUniqueString());

      await expect(repo.doUpdate(() => Promise.reject(genericError))).rejects.toThrow(genericError);
    });
  });

  describe('softDelete', () => {
    class SoftDeleteRepo extends BasePrismaRepository {
      constructor(prisma: PrismaClient, log: Logger, customConfig?: SoftDeleteConfig) {
        super(prisma, Prisma.ModelName.CoderabbitComment, log, { softDelete: customConfig ?? true });
      }

      // eslint-disable-next-line require-await
      async doSoftDeleteRow(where: Record<string, unknown>, tx?: Prisma.TransactionClient): Promise<void> {
        return this.softDeleteRow(where, tx);
      }
    }

    it('instantiates SoftDeleteConfig with defaults when softDelete: true', () => {
      const { prisma } = createMockPrismaClient();
      const repo = new SoftDeleteRepo(prisma, logger);
      expect(repo['softDelete']).toBeInstanceOf(SoftDeleteConfig);
    });

    it('accepts a custom SoftDeleteConfig instance', () => {
      const { prisma } = createMockPrismaClient();
      const customConfig = new SoftDeleteConfig('archived', 'archived_at');
      const repo = new SoftDeleteRepo(prisma, logger, customConfig);
      expect(repo['softDelete']).toBe(customConfig);
    });

    it('throws SoftDeleteNotConfiguredError when softDeleteRow is called without config', async () => {
      const { prisma } = createMockPrismaClient();
      const repo = new TestRepo(prisma, logger);

      await expect((repo as any).softDeleteRow({ id: 1 })).rejects.toBeDetailedError('SOFT_DELETE_NOT_CONFIGURED', {
        message: `deactivate() called on '${MODEL_NAME}' but soft-delete is not configured`,
        functionName: 'softDeleteRow',
        details: { tableName: MODEL_NAME },
      });
    });

    it('calls updateMany with the active filter and soft-delete marker', async () => {
      const frozenNow = getUniqueDate();
      jest.useFakeTimers();
      jest.setSystemTime(frozenNow);
      const { prisma, coderabbitComment } = createMockPrismaClient();
      const repo = new SoftDeleteRepo(prisma, logger);
      const ID = getUniqueInt();
      const where = { id: ID };

      await repo.doSoftDeleteRow(where);

      expect(coderabbitComment.updateMany).toHaveBeenCalledWith({
        where: { id: ID, is_deleted: false },
        data: { is_deleted: true, deleted_at: frozenNow },
      });
    });
  });

  describe('enforceTx', () => {
    it('passes the provided tx through directly', async () => {
      const tx = {} as Prisma.TransactionClient;
      const fn = jest.fn<any>().mockResolvedValue(MOCK_RESULT);

      const result = await repo.doEnforceTx(tx, fn);

      expect(result).toBe(MOCK_RESULT);
      expect(fn).toHaveBeenCalledWith(tx);
    });

    it('wraps in $transaction when tx is undefined', async () => {
      const { prisma } = createMockPrismaClient();
      const r = new TestRepo(prisma, logger);
      const fn = jest.fn<any>().mockResolvedValue(MOCK_RESULT);

      const result = await r.doEnforceTx(undefined, fn);

      expect(result).toBe(MOCK_RESULT);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('propagates errors from the callback', async () => {
      const error = new Error(getUniqueString());

      await expect(repo.doEnforceTx({} as Prisma.TransactionClient, () => Promise.reject(error))).rejects.toThrow(error);
    });
  });
});
