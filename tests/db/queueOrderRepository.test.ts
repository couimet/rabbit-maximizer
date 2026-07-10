import { type QueueOrderRepository, QueueOrderRepositoryImpl } from '../../src/db/queueOrderRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import { type QueueItem, QueueStatus, TriggerSource } from '../../src/types/index.js';
import { createMockPrismaClient, createResolvedMock } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

interface MakeRowOverrides {
  id?: number;
  repo_full_name?: string;
  pr_number?: number;
  pr_title?: string;
  status?: string;
  not_before?: Date;
  attempts?: number;
  source_comment_url?: string;
  source_comment_id?: number;
  trigger_source?: string | null;
  retriggered_at?: Date | null;
  failed_at?: Date | null;
  completed_at?: Date | null;
}

const makeRow = (over: MakeRowOverrides = {}, qoOver: { id?: number; position?: number | null } = {}) => {
  const commentId = getUniqueInt();
  return {
    id: over.id ?? getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: over.repo_full_name ?? getUniqueGitHubRepoRef().fullName,
    pr_number: over.pr_number ?? getUniqueInt(),
    pr_title: over.pr_title ?? 'Test PR title',
    status: over.status ?? 'pending',
    not_before: over.not_before ?? new Date(Date.now() - 60_000),
    attempts: over.attempts ?? 0,
    source_comment_url: over.source_comment_url ?? `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`,
    source_comment_id: over.source_comment_id ?? commentId,
    trigger_source: over.trigger_source ?? null,
    retriggered_at: over.retriggered_at ?? null,
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
  };
};

const toExpectedItem = (row: ReturnType<typeof makeRow>): QueueItem => ({
  id: row.id,
  uuid: row.uuid,
  repo_full_name: row.repo_full_name,
  pr_number: row.pr_number,
  pr_title: row.pr_title,
  status: row.status as QueueStatus,
  not_before: row.not_before,
  attempts: row.attempts,
  source_comment_url: row.source_comment_url,
  source_comment_id: row.source_comment_id,
  trigger_source: row.trigger_source as TriggerSource,
  retriggered_at: row.retriggered_at ?? undefined,
  failed_at: row.failed_at ?? undefined,
  completed_at: row.completed_at ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

describe('QueueOrderRepositoryImpl', () => {
  let logger: Logger;
  let frozenNow: Date;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
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
        where: { status: 'pending', not_before: { lte: frozenNow } },
        include: { queueOrder: true },
        orderBy: [{ queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.getEffectiveOrder', count: 3, eligibleOnly: true }, 'Fetched effective order');
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

    it('returns all pending items regardless of not_before when eligibleOnly is false', async () => {
      const rows = [makeRow({ not_before: new Date(Date.now() + 3600_000) })];

      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.getEffectiveOrder({ eligibleOnly: false });

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: { queueOrder: true },
        orderBy: [{ queueOrder: { position: { sort: 'asc', nulls: 'last' } } }, { queueOrder: { id: 'asc' } }],
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.getEffectiveOrder', count: 1, eligibleOnly: false }, 'Fetched effective order');
    });
  });

  describe('moveItems', () => {
    const makeMoveRow = (id: number, position?: number | null) => makeRow({ id }, { position: position ?? null, id: getUniqueInt() });

    const setupMoveMocks = (mockItems: ReturnType<typeof makeMoveRow>[], finalItems: ReturnType<typeof makeMoveRow>[]) => {
      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest.fn<any>().mockResolvedValueOnce(mockItems).mockResolvedValueOnce(mockItems).mockResolvedValueOnce(finalItems),
        },
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});
      queueOrderMock.updateMany = jest.fn<any>().mockResolvedValue({ count: 0 });
      return { prisma, queueOrderMock };
    };

    it('moves a single item up (swaps with previous)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB, itemC], [itemA, itemC, itemB]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemC.uuid], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(1, { where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(2, { where: { id: itemC.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(3, { where: { id: itemB.queueOrder.id }, data: { position: 3 } });

      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemC), toExpectedItem(itemB)]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.moveItems', ids: [itemC.uuid], direction: 'up' }, 'Moved items in queue order');
    });

    it('moves a single item down (swaps with next)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB, itemC], [itemB, itemA, itemC]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemA.uuid], 'down');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(1, { where: { id: itemB.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(2, { where: { id: itemA.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(3, { where: { id: itemC.queueOrder.id }, data: { position: 3 } });

      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemA), toExpectedItem(itemC)]);
    });

    it('moves multi-select adjacent items as a block (up)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);
      const itemD = makeMoveRow(4, 4);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB, itemC, itemD], [itemB, itemC, itemA, itemD]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemB.uuid, itemC.uuid], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id, itemD.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(1, { where: { id: itemB.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(2, { where: { id: itemC.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(3, { where: { id: itemA.queueOrder.id }, data: { position: 3 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(4, { where: { id: itemD.queueOrder.id }, data: { position: 4 } });

      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemC), toExpectedItem(itemA), toExpectedItem(itemD)]);
    });

    it('moves multi-select adjacent items as a block (down)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);
      const itemD = makeMoveRow(4, 4);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB, itemC, itemD], [itemA, itemD, itemB, itemC]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemB.uuid, itemC.uuid], 'down');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id, itemD.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(1, { where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(2, { where: { id: itemD.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(3, { where: { id: itemB.queueOrder.id }, data: { position: 3 } });
      expect(queueOrderMock.update).toHaveBeenNthCalledWith(4, { where: { id: itemC.queueOrder.id }, data: { position: 4 } });

      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemD), toExpectedItem(itemB), toExpectedItem(itemC)]);
    });

    it('skips selected item IDs not found in effective order', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB], [itemA, itemB]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      await sut.moveItems([itemA.uuid, '00000000-0000-0000-0000-000000000999'], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
    });

    it('deduplicates repeated ids so each item moves only one position', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma } = setupMoveMocks([itemA, itemB, itemC], [itemB, itemA, itemC]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemC.uuid, itemC.uuid], 'up');

      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemA), toExpectedItem(itemC)]);
    });

    it('does not swap when the neighbor is also selected (blocks at boundary)', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB, itemC], [itemA, itemB, itemC]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemA.uuid, itemB.uuid], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 3 } });
      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemB), toExpectedItem(itemC)]);
    });

    it('keeps item at the top when moving up', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB], [itemA, itemB]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemA.uuid], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemB)]);
    });

    it('keeps item at the bottom when moving down', async () => {
      const itemA = makeMoveRow(1, 1);
      const itemB = makeMoveRow(2, 2);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB], [itemA, itemB]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemB.uuid], 'down');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(result).toStrictEqual([toExpectedItem(itemA), toExpectedItem(itemB)]);
    });

    it('normalize-all assigns positions 1, 2, 3... after a move', async () => {
      const itemA = makeMoveRow(1, 5);
      const itemB = makeMoveRow(2, 10);
      const itemC = makeMoveRow(3, 3);

      const { prisma, queueOrderMock } = setupMoveMocks([itemA, itemB, itemC], [itemA, itemC, itemB]);
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      await sut.moveItems([itemC.uuid], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemC.queueOrder.id }, data: { position: 2 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemB.queueOrder.id }, data: { position: 3 } });
    });

    it('creates queue_order rows for items that lack them (pre-migration backfill)', async () => {
      const itemA = makeRow({ id: 1 }, { position: 1, id: getUniqueInt() });
      const itemB = { ...makeRow({ id: 2 }), queueOrder: null as unknown as ReturnType<typeof makeRow>['queueOrder'] };

      const { prisma, queueOrder: queueOrderMock } = createMockPrismaClient({
        reviewQueue: {
          findMany: jest.fn<any>().mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemB, itemA]),
        },
      });
      queueOrderMock.update = jest.fn<any>().mockResolvedValue({});
      queueOrderMock.updateMany = jest.fn<any>().mockResolvedValue({ count: 0 });
      queueOrderMock.create = jest.fn<any>().mockResolvedValue({ id: getUniqueInt(), position: 2, queue_item_id: 2 });

      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveItems([itemB.uuid], 'up');

      expect(queueOrderMock.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder!.id] } },
        data: { position: null },
      });
      expect(queueOrderMock.create).toHaveBeenCalledWith({ data: { queue_item_id: 2, position: 1 } });
      expect(queueOrderMock.update).toHaveBeenCalledWith({ where: { id: itemA.queueOrder!.id }, data: { position: 2 } });
      expect(result).toStrictEqual([toExpectedItem(itemB), toExpectedItem(itemA)]);
    });
  });

  describe('moveToTop', () => {
    it('moves item to top from middle of the queue', async () => {
      const itemA = makeRow({ id: 1 }, { position: 1, id: getUniqueInt() });
      const itemB = makeRow({ id: 2 }, { position: 2, id: getUniqueInt() });
      const itemC = makeRow({ id: 3 }, { position: 3, id: getUniqueInt() });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockResolvedValue({}),
          findMany: jest
            .fn<any>()
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemA, itemB, itemC])
            .mockResolvedValueOnce([itemB, itemA, itemC]),
        },
        queueOrder: {
          updateMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
          update: jest.fn<any>().mockResolvedValue({}),
        },
      });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveToTop(itemB.uuid, TriggerSource.dashboard_retrigger_now);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: itemB.id },
        data: { not_before: frozenNow, trigger_source: 'dashboard_retrigger_now' },
      });
      expect(queueOrder.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id, itemC.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrder.update).toHaveBeenNthCalledWith(1, { where: { id: itemB.queueOrder.id }, data: { position: 1 } });
      expect(queueOrder.update).toHaveBeenNthCalledWith(2, { where: { id: itemA.queueOrder.id }, data: { position: 2 } });
      expect(queueOrder.update).toHaveBeenNthCalledWith(3, { where: { id: itemC.queueOrder.id }, data: { position: 3 } });

      expect(result).toStrictEqual(toExpectedItem(itemB));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.moveToTop', uuid: itemB.uuid }, 'Moved item to top');
    });

    it('keeps item at position 1 when already at top', async () => {
      const itemA = makeRow({ id: 1 }, { position: 1, id: getUniqueInt() });
      const itemB = makeRow({ id: 2 }, { position: 2, id: getUniqueInt() });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockResolvedValue({}),
          findMany: jest.fn<any>().mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]),
        },
        queueOrder: {
          updateMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
          update: jest.fn<any>().mockResolvedValue({}),
        },
      });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      const result = await sut.moveToTop(itemA.uuid, TriggerSource.dashboard_retrigger_now);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: itemA.id },
        data: { not_before: frozenNow, trigger_source: 'dashboard_retrigger_now' },
      });
      expect(queueOrder.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [itemA.queueOrder.id, itemB.queueOrder.id] } },
        data: { position: null },
      });
      expect(queueOrder.update).toHaveBeenNthCalledWith(1, { where: { id: itemA.queueOrder.id }, data: { position: 1 } });
      expect(queueOrder.update).toHaveBeenNthCalledWith(2, { where: { id: itemB.queueOrder.id }, data: { position: 2 } });
      expect(result).toStrictEqual(toExpectedItem(itemA));
    });

    it('sets trigger_source when passed', async () => {
      const itemA = makeRow({ id: 1 }, { position: 1, id: getUniqueInt() });
      const itemB = makeRow({ id: 2 }, { position: 2, id: getUniqueInt() });

      const {
        prisma,
        reviewQueue,
        queueOrder: _queueOrder,
      } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockResolvedValue({}),
          findMany: jest.fn<any>().mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemA, itemB]).mockResolvedValueOnce([itemB, itemA]),
        },
        queueOrder: {
          updateMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
          update: jest.fn<any>().mockResolvedValue({}),
        },
      });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      await sut.moveToTop(itemB.uuid, TriggerSource.dashboard_retrigger_now);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: itemB.id },
        data: { not_before: expect.any(Date), trigger_source: 'dashboard_retrigger_now' },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueOrderRepositoryImpl.moveToTop', uuid: itemB.uuid }, 'Moved item to top');
    });

    it('throws when item is not found or not pending', async () => {
      const itemA = makeRow({ id: 1 }, { position: 1, id: getUniqueInt() });

      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockResolvedValue({}),
          findMany: jest.fn<any>().mockResolvedValue([itemA]),
        },
      });
      const sut = new QueueOrderRepositoryImpl(prisma, logger);

      await expect(sut.moveToTop('00000000-0000-0000-0000-000000000999', TriggerSource.dashboard_retrigger_now)).rejects.toBeDetailedError(
        'QUEUE_ITEM_NOT_FOUND',
        {
          message: 'Queue item 00000000-0000-0000-0000-000000000999 not found or not pending',
          functionName: 'QueueOrderRepositoryImpl.moveToTop',
          details: { uuid: '00000000-0000-0000-0000-000000000999' },
        },
      );
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
