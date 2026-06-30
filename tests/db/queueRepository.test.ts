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
  scheduled_for?: Date;
  attempts?: number;
  source_comment_url?: string | null;
}

const makeRow = (over: RowOverrides = {}) => ({
  id: over.id ?? getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: over.repo_full_name ?? makeUniqueRepoName().fullName,
  pr_number: over.pr_number ?? getUniqueInt(),
  status: over.status ?? 'pending',
  scheduled_for: over.scheduled_for ?? getUniqueDate(),
  attempts: over.attempts ?? 0,
  source_comment_url: over.source_comment_url ?? null,
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
});

const toExpectedItem = (row: ReturnType<typeof makeRow>) => ({
  id: row.id,
  uuid: row.uuid,
  repo_full_name: row.repo_full_name,
  pr_number: row.pr_number,
  status: row.status as QueueStatus,
  scheduled_for: row.scheduled_for,
  attempts: row.attempts,
  source_comment_url: row.source_comment_url ?? undefined,
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
    it('creates a pending row, records enqueued event, and returns it', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const scheduledFor = getUniqueDate();
      const sourceUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const newWait = 330;
      const obs = makeObservation();
      const row = makeRow({ repo_full_name: repo, pr_number: pr, source_comment_url: sourceUrl });

      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const result = await sut.enqueue(repo, pr, scheduledFor, sourceUrl, newWait, obs, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: { repo_full_name: repo, pr_number: pr, scheduled_for: scheduledFor, source_comment_url: sourceUrl },
      });
      expect(events.record).toHaveBeenCalledWith(
        {
          type: 'enqueued',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: obs.correlationId,
          request_id: obs.requestId,
          version: obs.version,
          payload: { scheduled_for: scheduledFor, new_wait: newWait },
        },
        prisma,
      );
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'Enqueued review');
    });

    it('returns the existing pending row when the PR is already queued (P2002)', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const existing = makeRow({ repo_full_name: repo, pr_number: pr, status: 'pending' });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
          create: jest.fn<any>().mockRejectedValue(p2002),
        },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const result = await sut.enqueue(
        repo,
        pr,
        getUniqueDate(),
        getUniqueString({ prefix: 'https://gh/c/' }),
        60,
        makeObservation(),
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { repo_full_name: repo, pr_number: pr, status: 'pending' } });
      expect(result).toStrictEqual(toExpectedItem(existing));
      expect(events.record).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'Already queued; returning existing pending row');
    });

    it('returns the existing posted item when a recent posted row exists (within cooldown)', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const recentPosted = makeRow({ repo_full_name: repo, pr_number: pr, status: 'posted', scheduled_for: new Date(Date.now() + 3_600_000) });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(recentPosted) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const result = await sut.enqueue(
        repo,
        pr,
        getUniqueDate(),
        getUniqueString({ prefix: 'https://gh/c/' }),
        60,
        makeObservation(),
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'posted', scheduled_for: { gt: expect.any(Date) } },
      });
      expect(reviewQueue.create).not.toHaveBeenCalled();
      expect(result).toStrictEqual(toExpectedItem(recentPosted));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr }, 'PR was recently retriggered; skipping');
    });

    it('creates a new pending row when the cooldown has expired', async () => {
      const { fullName: repo } = makeUniqueRepoName();
      const pr = getUniqueInt();
      const newRow = makeRow({ repo_full_name: repo, pr_number: pr, status: 'pending' });
      const scheduledFor = getUniqueDate();

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(newRow) },
      });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);

      const result = await sut.enqueue(
        repo,
        pr,
        scheduledFor,
        getUniqueString({ prefix: 'https://gh/c/' }),
        60,
        makeObservation(),
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'posted', scheduled_for: { gt: expect.any(Date) } },
      });
      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: { repo_full_name: repo, pr_number: pr, scheduled_for: scheduledFor, source_comment_url: expect.any(String) },
      });
      expect(result).toStrictEqual(toExpectedItem(newRow));
    });
  });

  describe('getNextDue', () => {
    it('returns the earliest due pending item', async () => {
      const row = makeRow({ status: 'pending' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getNextDue();
      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { status: 'pending', scheduled_for: { lte: frozenNow } },
        orderBy: { scheduled_for: 'asc' },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getNextDue', found: true }, 'Fetched next due review');
    });

    it('returns null when no pending items are due', async () => {
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(null) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getNextDue();
      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getNextDue', found: false }, 'Fetched next due review');
    });
  });

  describe('markPosted', () => {
    it('updates the row to posted', async () => {
      const row = makeRow({ status: 'posted' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markPosted(row.id, undefined, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'posted' } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markPosted', id: row.id, cooldownUntil: undefined }, 'Marked review posted');
    });

    it('writes scheduled_for when cooldownUntil is provided', async () => {
      const cooldownUntil = getUniqueDate();
      const row = makeRow({ status: 'posted' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markPosted(row.id, cooldownUntil, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'posted', scheduled_for: cooldownUntil } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markPosted', id: row.id, cooldownUntil }, 'Marked review posted');
    });
  });

  describe('markFailed', () => {
    it('updates the row to failed', async () => {
      const row = makeRow({ status: 'failed' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markFailed(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'failed' } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markFailed', id: row.id }, 'Marked review failed');
    });
  });

  describe('markCompleted', () => {
    it('updates the row to completed', async () => {
      const row = makeRow({ status: 'completed' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.markCompleted(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'completed' } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markCompleted', id: row.id }, 'Marked review completed');
    });
  });

  describe('reschedule', () => {
    it('increments attempts and sets new scheduled_for', async () => {
      const newDate = getUniqueDate();
      const row = makeRow({ attempts: 2 });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.reschedule(row.id, newDate, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { attempts: { increment: 1 }, scheduled_for: newDate } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.reschedule', id: row.id }, 'Rescheduled review');
    });
  });

  describe('getPendingQueue', () => {
    it('returns all pending items sorted by scheduled_for', async () => {
      const rows = [makeRow({ status: 'pending' }), makeRow({ status: 'pending' })];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getPendingQueue();
      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { scheduled_for: 'asc' },
      });
      expect(result).toStrictEqual(rows.map(toExpectedItem));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getPendingQueue', count: 2 }, 'Fetched pending queue');
    });
  });

  describe('getOldestPending', () => {
    it('returns the oldest pending item', async () => {
      const row = makeRow({ status: 'pending' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const events = { record: jest.fn<any>(), listForPr: jest.fn<any>() };
      const sut = new QueueRepositoryImpl(prisma, events as any, logger);
      const result = await sut.getOldestPending();
      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { scheduled_for: 'asc' },
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
    it('returns paginated queue items sorted by scheduled_for ascending, with total count', async () => {
      const skip = 0;
      const take = 20;
      const rows = [makeRow({ status: 'pending' }), makeRow({ status: 'posted' })];
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
        orderBy: { scheduled_for: 'asc' },
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
        { status: 'pending', _count: { status: 7 } },
        { status: 'posted', _count: { status: 3 } },
        { status: 'completed', _count: { status: 1 } },
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
      expect(result).toStrictEqual({ pending: 7, posted: 3, completed: 1, failed: 0 });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.getCountsByStatus', counts: { pending: 7, posted: 3, completed: 1, failed: 0 } },
        'Fetched queue counts by status',
      );
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
