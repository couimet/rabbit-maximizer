import { type QueueOrderRepository, QueueOrderRepositoryImpl } from '../../src/db/queueOrderRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import { type QueueItem, QueueStatus } from '../../src/types/index.js';
import { createMockLogger, createMockPrismaClient, createResolvedMock, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

interface MakeRowOverrides {
  id?: number;
  repo_full_name?: string;
  pr_number?: number;
  status?: string;
  not_before?: Date;
  attempts?: number;
  source_comment_url?: string | null;
  posted_at?: Date | null;
  failed_at?: Date | null;
  completed_at?: Date | null;
}

const makeRow = (over: MakeRowOverrides = {}, qoOver: { id?: number; position?: number | null } = {}) => ({
  id: over.id ?? getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: over.repo_full_name ?? makeUniqueRepoName().fullName,
  pr_number: over.pr_number ?? getUniqueInt(),
  status: over.status ?? 'pending',
  not_before: over.not_before ?? new Date(Date.now() - 60_000),
  attempts: over.attempts ?? 0,
  source_comment_url: over.source_comment_url ?? null,
  posted_at: over.posted_at ?? null,
  failed_at: over.failed_at ?? null,
  completed_at: over.completed_at ?? null,
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
  queueOrder: {
    id: qoOver.id ?? getUniqueInt(),
    queue_item_id: over.id ?? 0,
    position: qoOver.position ?? null,
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
  },
});

const toExpectedItem = (row: ReturnType<typeof makeRow>): QueueItem => ({
  id: row.id,
  uuid: row.uuid,
  repo_full_name: row.repo_full_name,
  pr_number: row.pr_number,
  status: row.status as QueueStatus,
  not_before: row.not_before,
  attempts: row.attempts,
  source_comment_url: row.source_comment_url ?? undefined,
  posted_at: row.posted_at ?? undefined,
  failed_at: row.failed_at ?? undefined,
  completed_at: row.completed_at ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

describe('QueueOrderRepositoryImpl', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('getEffectiveOrder', () => {
    it('returns explicit-position items before unordered items, and unordered items sorted by queue_order id ASC', async () => {
      const itemOrdered = makeRow({}, { position: 2 });
      const itemNoPos1 = makeRow({}, { position: null, id: 5 });
      const itemNoPos2 = makeRow({}, { position: null, id: 3 });
      const rows = [itemNoPos1, itemOrdered, itemNoPos2];

      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.getEffectiveOrder();

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'pending', not_before: { lte: expect.any(Date) } },
        include: { queueOrder: true },
        orderBy: [{ queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.getEffectiveOrder', count: 3 }, 'Fetched effective order');
    });

    it('only returns pending items with not_before <= now', async () => {
      const eligible = makeRow({ not_before: new Date(Date.now() - 60_000) });
      const rows = [eligible];

      const { prisma } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.getEffectiveOrder();

      expect(result).toStrictEqual([toExpectedItem(eligible)]);
    });

    it('returns empty array when nothing eligible', async () => {
      const { prisma } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock([]) } });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.getEffectiveOrder();

      expect(result).toStrictEqual([]);
    });
  });

  describe('moveItems', () => {
    const makeMoveRow = (id: number, position?: number | null) => makeRow({ id }, { position: position ?? null, id: getUniqueInt() });

    it('moves a single item up (swaps with previous)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemC, itemB]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([3], 'up');

      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('UPDATE queue_order SET position = position + 10000 WHERE position IS NOT NULL');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 3 } });

      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemC), toExpectedItem(itemB)]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.moveItems', ids: [3], direction: 'up' }, 'Moved items in queue order');
    });

    it('moves a single item down (swaps with next)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemB, itemA, itemC]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([1], 'down');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 3 } });

      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemA), toExpectedItem(itemC)]);
    });

    it('moves multi-select adjacent items as a block (up)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);
      const itemD = makeMoveRow(4, 4);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC, itemD])
            .mockResolvedValueOnce([itemA, itemB, itemC, itemD])
            .mockResolvedValueOnce([itemB, itemC, itemA, itemD]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([2, 3], 'up');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 3 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemD.queueOrder.id }, data: { position: 4 } });

      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemC), toExpectedItem(itemA), toExpectedItem(itemD)]);
    });

    it('moves multi-select adjacent items as a block (down)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);
      const itemD = makeMoveRow(4, 4);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC, itemD])
            .mockResolvedValueOnce([itemA, itemB, itemC, itemD])
            .mockResolvedValueOnce([itemA, itemD, itemB, itemC]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([2, 3], 'down');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemD.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 3 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 4 } });

      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemD), toExpectedItem(itemB), toExpectedItem(itemC)]);
    });

    it('skips selected item IDs not found in effective order', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest.fn<any>().mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      await sut.moveItems([1, 999], 'up');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
    });

    it('deduplicates repeated ids so each item moves only one position', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemB, itemA, itemC]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([2, 2], 'up');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 3 } });
      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemA), toExpectedItem(itemC)]);
    });

    it('does not swap when the neighbor is also selected (blocks at boundary)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([1, 2], 'up');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 3 } });
      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemB), toExpectedItem(itemC)]);
    });

    it('keeps item at the top when moving up', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest.fn<any>().mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([1], 'up');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemB)]);
    });

    it('keeps item at the bottom when moving down', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest.fn<any>().mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([2], 'down');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemB)]);
    });

    it('normalize-all assigns positions 1, 2, 3... after a move', async () => {
      const itemA = makeMoveRow(1, 5);
      const itemB = makeMoveRow(2, 10);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemC, itemB]),
        },
        $executeRawUnsafe: jest.fn<any>().mockResolvedValue(undefined),
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      await sut.moveItems([3], 'up');

      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 3 } });
    });
  });

  describe('container binding', () => {
    it('resolves QueueOrderRepository from the container', () => {
      const { prisma } = createMockPrismaClient();
      const container = new Container();
      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<QueueOrderRepository>(TYPES.QueueOrderRepository).to(QueueOrderRepositoryImpl);
      expect(container.get<QueueOrderRepository>(TYPES.QueueOrderRepository)).toBeInstanceOf(QueueOrderRepositoryImpl);
    });
  });
});
