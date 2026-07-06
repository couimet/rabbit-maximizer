import { type QueueRepository, QueueRepositoryImpl } from '../../src/db/queueRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { QueueStatus } from '../../src/types/index.js';
import { createMockLogger, createMockPrismaClient, createResolvedMock, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

interface RowOverrides {
  id?: number;
  repo_full_name?: string;
  pr_number?: number;
  status?: string;
  not_before?: Date;
  attempts?: number;
  source_comment_url?: string | null;
  retriggered_at?: Date | null;
  failed_at?: Date | null;
  completed_at?: Date | null;
}

const makeRow = (over: RowOverrides = {}) => ({
  id: over.id ?? getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: over.repo_full_name ?? makeUniqueRepoName().fullName,
  pr_number: over.pr_number ?? getUniqueInt(),
  status: over.status ?? 'pending',
  not_before: over.not_before ?? getUniqueDate(),
  attempts: over.attempts ?? 0,
  source_comment_url: over.source_comment_url ?? null,
  retriggered_at: over.retriggered_at ?? null,
  failed_at: over.failed_at ?? null,
  completed_at: over.completed_at ?? null,
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
});

const toExpectedItem = (row: ReturnType<typeof makeRow>) => ({
  id: row.id,
  uuid: row.uuid,
  repo_full_name: row.repo_full_name,
  pr_number: row.pr_number,
  status: row.status as QueueStatus,
  not_before: row.not_before,
  attempts: row.attempts,
  source_comment_url: row.source_comment_url ?? undefined,
  retriggered_at: row.retriggered_at ?? undefined,
  failed_at: row.failed_at ?? undefined,
  completed_at: row.completed_at ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const makeObservation = (): ObservationContext => ({
  correlationId: getUniqueString({ prefix: 'corr-' }),
  requestId: getUniqueString({ prefix: 'req-' }),
  version: '1.0.0-test',
});

describe('QueueRepositoryImpl', () => {
  let frozenNow: Date;
  let logger: Logger;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe('enqueue', () => {
    it('creates a pending row, records enqueued event, inserts queue_order, and returns it', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const notBefore = getUniqueDate();
      const sourceUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const newWait = 330;
      const obs = makeObservation();
      const row = makeRow({ repo_full_name: repo, pr_number: pr, source_comment_url: sourceUrl });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const { item: result, created } = await sut.enqueue(repo, pr, notBefore, sourceUrl, newWait, obs, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: { repo_full_name: repo, pr_number: pr, not_before: notBefore, source_comment_url: sourceUrl },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: row.id } });
      expect(events.record).toHaveBeenCalledWith(
        {
          type: 'enqueued',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: obs.correlationId,
          request_id: obs.requestId,
          version: obs.version,
          payload: { not_before: notBefore, new_wait: newWait },
        },
        prisma,
      );
      expect(created).toBe(true);
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'Enqueued review');
    });

    it('returns the existing pending row when the PR is already queued (P2002)', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const existing = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.pending });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
          create: jest.fn<any>().mockRejectedValue(p2002),
        },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const { item: result, created } = await sut.enqueue(
        repo,
        pr,
        getUniqueDate(),
        getUniqueString({ prefix: 'https://gh/c/' }),
        60,
        makeObservation(),
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { repo_full_name: repo, pr_number: pr, status: { in: ['pending', 'retriggered'] } } });
      expect(created).toBe(false);
      expect(result).toStrictEqual(toExpectedItem(existing));
      expect(events.record).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, status: 'pending' }, 'Already queued; returning existing row');
    });

    it('returns the existing retriggered item when a recent retriggered row exists (within cooldown)', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const recentRetriggered = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.retriggered, not_before: new Date(Date.now() + 3_600_000) });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(recentRetriggered) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const { item: result, created } = await sut.enqueue(
        repo,
        pr,
        getUniqueDate(),
        getUniqueString({ prefix: 'https://gh/c/' }),
        60,
        makeObservation(),
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'retriggered', not_before: { gt: expect.any(Date) } },
      });
      expect(reviewQueue.create).not.toHaveBeenCalled();
      expect(created).toBe(false);
      expect(result).toStrictEqual(toExpectedItem(recentRetriggered));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'PR was recently retriggered; skipping');
    });

    it('creates a new pending row when the cooldown has expired', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const newRow = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.pending });
      const notBefore = getUniqueDate();

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(newRow) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const { item: result, created } = await sut.enqueue(
        repo,
        pr,
        notBefore,
        getUniqueString({ prefix: 'https://gh/c/' }),
        60,
        makeObservation(),
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'retriggered', not_before: { gt: expect.any(Date) } },
      });
      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: { repo_full_name: repo, pr_number: pr, not_before: notBefore, source_comment_url: expect.any(String) },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: newRow.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(toExpectedItem(newRow));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'Enqueued review');
    });
  });

  describe('markRetriggered', () => {
    it('updates the row to retriggered', async () => {
      const row = makeRow({ status: QueueStatus.retriggered });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markRetriggered(row.id, undefined, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'retriggered', retriggered_at: expect.any(Date) } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markRetriggered', id: row.id, cooldownUntil: undefined },
        'Marked review retriggered',
      );
    });

    it('writes not_before when cooldownUntil is provided', async () => {
      const cooldownUntil = getUniqueDate();
      const row = makeRow({ status: QueueStatus.retriggered });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markRetriggered(row.id, cooldownUntil, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: 'retriggered', retriggered_at: expect.any(Date), not_before: cooldownUntil },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markRetriggered', id: row.id, cooldownUntil }, 'Marked review retriggered');
    });
  });

  describe('markFailed', () => {
    it('updates the row to failed', async () => {
      const row = makeRow({ status: QueueStatus.failed });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markFailed(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'failed', failed_at: expect.any(Date) } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markFailed', id: row.id }, 'Marked review failed');
    });
  });

  describe('markCompleted', () => {
    it('updates the row to completed', async () => {
      const row = makeRow({ status: QueueStatus.completed });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markCompleted(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'completed', completed_at: expect.any(Date) } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markCompleted', id: row.id }, 'Marked review completed');
    });
  });

  describe('reschedule', () => {
    it('increments attempts and sets new not_before', async () => {
      const newDate = getUniqueDate();
      const row = makeRow({ attempts: 2 });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.reschedule(row.id, newDate, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { attempts: { increment: 1 }, not_before: newDate } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.reschedule', id: row.id }, 'Rescheduled review');
    });
  });

  describe('getPendingQueue', () => {
    it('returns all pending items sorted by not_before', async () => {
      const rows = [makeRow({ status: QueueStatus.pending }), makeRow({ status: QueueStatus.pending })];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getPendingQueue();
      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { not_before: 'asc' },
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getPendingQueue', count: 2 }, 'Fetched pending queue');
    });
  });

  describe('getRetriggeredQueue', () => {
    it('returns all retriggered items sorted by retriggered_at', async () => {
      const rows = [makeRow({ status: QueueStatus.retriggered }), makeRow({ status: QueueStatus.retriggered })];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getRetriggeredQueue();
      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'retriggered' },
        orderBy: { retriggered_at: 'asc' },
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getRetriggeredQueue', count: 2 }, 'Fetched retriggered queue');
    });
  });

  describe('getOldestPending', () => {
    it('returns the oldest pending item', async () => {
      const row = makeRow({ status: QueueStatus.pending });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getOldestPending();
      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { not_before: 'asc' },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getOldestPending', found: true }, 'Fetched oldest pending item');
    });

    it('returns null when no pending items exist', async () => {
      const { prisma } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(null) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getOldestPending();
      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getOldestPending', found: false }, 'Fetched oldest pending item');
    });
  });

  describe('enqueue error paths', () => {
    it('logs warning and rethrows when a non-P2002 error occurs', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const networkError = new Error('Connection lost');
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: jest.fn<any>().mockRejectedValue(networkError) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      await expect(() =>
        sut.enqueue(
          repo,
          pr,
          getUniqueDate(),
          getUniqueString({ prefix: 'https://gh/c/' }),
          60,
          makeObservation(),
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('Connection lost');

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: networkError }, 'Enqueue failed; rethrowing');
    });

    it('logs warning and rethrows when P2002 fires but no pending row exists', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { create: jest.fn<any>().mockRejectedValue(p2002), findFirst: createResolvedMock(null) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      await expect(() =>
        sut.enqueue(
          repo,
          pr,
          getUniqueDate(),
          getUniqueString({ prefix: 'https://gh/c/' }),
          60,
          makeObservation(),
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('Unique constraint');

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: p2002 }, 'Enqueue failed; rethrowing');
    });
  });

  describe('getAll', () => {
    it('returns paginated queue items sorted by not_before ascending, with total count', async () => {
      const skip = 0;
      const take = 20;
      const rows = [makeRow({ status: QueueStatus.pending }), makeRow({ status: QueueStatus.retriggered })];
      const total = 5;

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findMany: createResolvedMock(rows),
          count: createResolvedMock(total),
        },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const result = await sut.getAll(skip, take);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        orderBy: { not_before: 'asc' },
        skip,
        take,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith();
      expect(result).toStrictEqual({ items: rows.map(toExpectedItem), total });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getAll', count: rows.length, total }, 'Fetched all queue items');
    });
  });

  describe('getCountsByStatus', () => {
    it('returns counts keyed by QueueStatus, initializing missing statuses to 0', async () => {
      const rows = [
        { status: QueueStatus.pending, _count: { status: 7 } },
        { status: QueueStatus.retriggered, _count: { status: 3 } },
        { status: QueueStatus.completed, _count: { status: 1 } },
      ];

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { groupBy: createResolvedMock(rows) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const result = await sut.getCountsByStatus();

      expect(reviewQueue.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: { status: true },
      });
      expect(result).toStrictEqual({ pending: 7, retriggered: 3, completed: 1, failed: 0 });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.getCountsByStatus', counts: { pending: 7, retriggered: 3, completed: 1, failed: 0 } },
        'Fetched queue counts by status',
      );
    });
  });

  describe('toQueueItem null timestamp mapping', () => {
    it('returns existing rows with NULL timestamps', () => {
      const row = makeRow({ retriggered_at: null, failed_at: null, completed_at: null });
      const expected = toExpectedItem(row);
      expect(expected.retriggered_at).toBeUndefined();
      expect(expected.failed_at).toBeUndefined();
      expect(expected.completed_at).toBeUndefined();
    });
  });

  describe('container binding', () => {
    it('resolves QueueRepository from the container', () => {
      const { prisma } = createMockPrismaClient();
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const container = new Container();
      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind(TYPES.EventRepository).toConstantValue(events);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<QueueRepository>(TYPES.QueueRepository).to(QueueRepositoryImpl);
      expect(container.get<QueueRepository>(TYPES.QueueRepository)).toBeInstanceOf(QueueRepositoryImpl);
    });
  });
});
