import { type QueueRepository, QueueRepositoryImpl } from '../../src/db/index.js';
import { QueueStatus, TYPES } from '../../src/domain.js';
import { PrismaUniqueConstraintViolationError } from '../../src/external-deps/couimet/prisma-repo/index.js';
import { ReviewQueueToQueueItemMapper } from '../../src/mappers/index.js';
import { ProbeFactory } from '../../src/probes/index.js';
import {
  createMockObservationContextProvider,
  createMockPrismaClient,
  createResolvedMock,
  generateCreateSkippedData,
  generateReviewQueueHydrationData as makeRow,
} from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueIntsNamed, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

describe('QueueRepositoryImpl', () => {
  let frozenNow: Date;
  let logger: ReturnType<typeof createMockLogger>;
  let observation: ReturnType<typeof createMockObservationContextProvider>;
  let probeEvents: { record: jest.Mock<any>; listForPr: jest.Mock<any> };
  let probeFactory: ProbeFactory;
  let mapper: ReviewQueueToQueueItemMapper;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    observation = createMockObservationContextProvider();
    probeEvents = { record: jest.fn<any>().mockResolvedValue({ uuid: getUuid() }), listForPr: jest.fn<any>() };
    probeFactory = new ProbeFactory(probeEvents as any, observation as any, logger);
    mapper = new ReviewQueueToQueueItemMapper();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe('enqueue', () => {
    it('creates a pending row, records enqueued event, inserts queue_order, and returns it', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const pullRequestId = getUniqueInt();
      const row = makeRow({ repo_full_name: repo, pr_number: pr, source_comment_url: sourceUrl });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        { repo, pr, prTitle: 'Test PR title', sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: repo,
          pr_number: pr,
          pr_title: 'Test PR title',
          source_comment_url: sourceUrl,
          source_comment_id: commentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: row.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
    });

    it('returns the existing pending row when the PR is already queued (P2002)', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const existing = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.pending });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
          create: jest.fn<any>().mockRejectedValue(p2002),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const { item: result, created } = await sut.enqueue(
        {
          repo,
          pr,
          prTitle: 'Test PR title',
          sourceCommentUrl: sourceUrl,
          sourceCommentId: commentId,
          newWait,
          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { repo_full_name: repo, pr_number: pr, status: 'pending' } });
      expect(created).toBe(false);
      expect(result).toStrictEqual(mapper.fromReviewQueue(existing));
    });

    it('returns the existing retriggered item when a recent retriggered row exists (within cooldown)', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const recentRetriggered = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.retriggered });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(recentRetriggered) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();

      const { item: result, created } = await sut.enqueue(
        { repo, pr, prTitle: 'Test PR title', sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId: getUniqueInt() },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'retriggered' },
      });
      expect(reviewQueue.create).not.toHaveBeenCalled();
      expect(created).toBe(false);
      expect(result).toStrictEqual(mapper.fromReviewQueue(recentRetriggered));
    });

    it('creates a new pending row when the cooldown has expired', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const newRow = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.pending });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(newRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const pullRequestId = getUniqueInt();
      const { item: result, created } = await sut.enqueue(
        { repo, pr, prTitle: 'Test PR title', sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'retriggered' },
      });
      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: repo,
          pr_number: pr,
          pr_title: 'Test PR title',
          source_comment_url: sourceUrl,
          source_comment_id: commentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: newRow.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(newRow));
    });
  });

  describe('markRetriggered', () => {
    const COMMENT_URL = 'https://github.com/owner/repo/pull/1#issuecomment-123';

    it('updates the row to retriggered with cooldown', async () => {
      const cooldownUntil = getUniqueDate();
      const row = makeRow({ status: QueueStatus.retriggered });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markRetriggered(row.id, cooldownUntil, COMMENT_URL, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: 'retriggered', retriggered_at: frozenNow, retrigger_comment_url: COMMENT_URL },
      });
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markRetriggered', id: row.id, cooldownUntil, retriggerCommentUrl: COMMENT_URL },
        'Marked review retriggered',
      );
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const cooldownUntil = getUniqueDate();
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markRetriggered(getUniqueInt(), cooldownUntil, COMMENT_URL, prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError(
        'PRISMA_RECORD_NOT_FOUND_P2025',
        {
          message: "Record not found in table 'ReviewQueue'",
          functionName: 'QueueRepositoryImpl.markRetriggered',
          details: { tableName: 'ReviewQueue' },
          cause: p2025,
        },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markRetriggered', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });

    it('wraps P2005 errors in PrismaFieldTypeMismatchError', async () => {
      const cooldownUntil = getUniqueDate();
      const p2005 = new Prisma.PrismaClientKnownRequestError('Field type mismatch', { code: 'P2005', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2005) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markRetriggered(getUniqueInt(), cooldownUntil, COMMENT_URL, prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError(
        'PRISMA_FIELD_TYPE_MISMATCH_P2005',
        {
          message: "Field type mismatch in table 'ReviewQueue'",
          functionName: 'QueueRepositoryImpl.markRetriggered',
          details: { tableName: 'ReviewQueue' },
          cause: p2005,
        },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markRetriggered', modelName: 'ReviewQueue', prismaCode: 'P2005' },
        'Prisma field type mismatch, throwing typed error',
      );
    });

    it('rethrows unrecognized Prisma errors', async () => {
      const cooldownUntil = getUniqueDate();
      const unrecognizedError = new Prisma.PrismaClientKnownRequestError('Something unexpected', { code: 'P9999', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(unrecognizedError) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markRetriggered(getUniqueInt(), cooldownUntil, COMMENT_URL, prisma as unknown as Prisma.TransactionClient)).rejects.toThrow(
        unrecognizedError,
      );
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markRetriggered', modelName: 'ReviewQueue', prismaCode: 'P9999', error: unrecognizedError },
        'Unrecognized Prisma error code, rethrowing original',
      );
    });
  });

  describe('markFailed', () => {
    it('updates the row to failed', async () => {
      const row = makeRow({ status: QueueStatus.failed });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const result = await sut.markFailed(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'failed', failed_at: frozenNow } });
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markFailed', id: row.id }, 'Marked review failed');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markFailed(getUniqueInt(), prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'ReviewQueue'",
        functionName: 'QueueRepositoryImpl.markFailed',
        details: { tableName: 'ReviewQueue' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markFailed', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('markReviewed', () => {
    it('updates the row to reviewed', async () => {
      const row = makeRow({ status: QueueStatus.reviewed });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const result = await sut.markReviewed(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'reviewed', reviewed_at: frozenNow } });
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markReviewed', id: row.id }, 'Marked review reviewed');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markReviewed(getUniqueInt(), prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'ReviewQueue'",
        functionName: 'QueueRepositoryImpl.markReviewed',
        details: { tableName: 'ReviewQueue' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markReviewed', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('markReviewedByUuid', () => {
    it('finds by UUID, marks the row reviewed, and logs the event', async () => {
      const commentUrl = 'https://gh/c/retriggered-123';
      const row = makeRow({ status: QueueStatus.retriggered, retrigger_comment_url: commentUrl });
      const completedRow = { ...row, status: QueueStatus.reviewed, reviewed_at: frozenNow };
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markReviewedByUuid(row.uuid, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { uuid: row.uuid },
        data: { status: 'reviewed', reviewed_at: frozenNow },
      });
      expect(result).toStrictEqual(mapper.fromReviewQueue(completedRow));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'MarkQueueItemReviewedProbe.queueItemMarkedReviewed', uuid: row.uuid, id: row.id },
        'Marked review reviewed by UUID',
      );
    });

    it('handles null retrigger_comment_url', async () => {
      const row = makeRow({ status: QueueStatus.retriggered, retrigger_comment_url: null });
      const completedRow = { ...row, status: QueueStatus.reviewed, reviewed_at: frozenNow };
      const { prisma } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markReviewedByUuid(row.uuid, prisma as unknown as Prisma.TransactionClient);

      expect(result).toStrictEqual(mapper.fromReviewQueue(completedRow));
    });

    it('returns undefined when UUID is not found', async () => {
      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' })),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markReviewedByUuid('missing-uuid', prisma as unknown as Prisma.TransactionClient);

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'MarkQueueItemReviewedProbe.queueItemNotFound', uuid: 'missing-uuid' },
        'Queue item not found for mark-reviewed',
      );
    });

    it('rethrows non-PrismaRecordNotFoundError errors from the update', async () => {
      const genericError = new Error('DB down');
      const { prisma } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(genericError) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markReviewedByUuid('some-uuid', prisma as unknown as Prisma.TransactionClient)).rejects.toThrow('DB down');
    });

    it('wraps in a transaction when called without tx', async () => {
      const row = makeRow({ status: QueueStatus.retriggered });
      const completedRow = { ...row, status: QueueStatus.reviewed, reviewed_at: frozenNow };
      const { prisma } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markReviewedByUuid(row.uuid);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toStrictEqual(mapper.fromReviewQueue(completedRow));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'MarkQueueItemReviewedProbe.queueItemMarkedReviewed', uuid: row.uuid, id: row.id },
        'Marked review reviewed by UUID',
      );
    });
  });

  describe('reschedule', () => {
    it('updates attempts and source comment, logs, and returns updated item', async () => {
      const row = makeRow();
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const commentId = getUniqueInt();
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });

      const result = await sut.reschedule(row.id, { commentId, commentUrl }, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, source_comment_id: commentId, source_comment_url: commentUrl },
      });
      expect(result.id).toBe(row.id);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.reschedule', id: row.id }, 'Rescheduled review');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(
        sut.reschedule(
          getUniqueInt(),
          { commentId: getUniqueInt(), commentUrl: getUniqueString({ prefix: 'https://gh/c/' }) },
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'ReviewQueue'",
        functionName: 'QueueRepositoryImpl.reschedule',
        details: { tableName: 'ReviewQueue' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.reschedule', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('backoff', () => {
    it('increments attempts, logs, and returns updated item', async () => {
      const row = makeRow();
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.backoff(row.id, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      expect(result.id).toBe(row.id);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.backoff', id: row.id }, 'Backoff applied');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.backoff(getUniqueInt(), prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError('PRISMA_RECORD_NOT_FOUND_P2025', {
        message: "Record not found in table 'ReviewQueue'",
        functionName: 'QueueRepositoryImpl.backoff',
        details: { tableName: 'ReviewQueue' },
        cause: p2025,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.backoff', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('getRetriggeredQueue', () => {
    it('returns all retriggered items sorted by retriggered_at', async () => {
      const rows = [makeRow({ status: QueueStatus.retriggered }), makeRow({ status: QueueStatus.retriggered })];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const result = await sut.getRetriggeredQueue();
      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'retriggered' },
        orderBy: { retriggered_at: 'asc' },
      });
      expect(result).toStrictEqual(rows.map((row) => mapper.fromReviewQueue(row)));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getRetriggeredQueue', count: 2 }, 'Fetched retriggered queue');
    });
  });

  describe('getOldestPending', () => {
    it('returns the oldest pending item', async () => {
      const row = makeRow({ status: QueueStatus.pending });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const result = await sut.getOldestPending();
      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: { id: 'asc' },
      });
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getOldestPending', found: true }, 'Fetched oldest pending item');
    });

    it('returns undefined when no pending items exist', async () => {
      const { prisma } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(null) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const result = await sut.getOldestPending();
      expect(result).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getOldestPending', found: false }, 'Fetched oldest pending item');
    });
  });

  describe('enqueue error paths', () => {
    it('logs warning and rethrows when a non-P2002 error occurs', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const networkError = new Error('Connection lost');
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: jest.fn<any>().mockRejectedValue(networkError) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const commentId = getUniqueInt();

      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      await expect(() =>
        sut.enqueue(
          { repo, pr, prTitle: 'Test PR title', sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId: getUniqueInt() },
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('Connection lost');

      expect(logger.warn).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: networkError }, 'Enqueue failed; rethrowing');
    });

    it('logs warning and rethrows when P2002 fires but no pending row exists', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { create: jest.fn<any>().mockRejectedValue(p2002), findFirst: createResolvedMock(null) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const commentId = getUniqueInt();

      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      await expect(() =>
        sut.enqueue(
          { repo, pr, prTitle: 'Test PR title', sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId: getUniqueInt() },
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('Unique constraint');

      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.enqueue', repo, pr, error: expect.any(PrismaUniqueConstraintViolationError) },
        'Enqueue failed; rethrowing',
      );
    });
  });

  describe('getPendingQueue', () => {
    it('returns pending items ordered by id', async () => {
      const rows = [makeRow({ status: QueueStatus.pending }), makeRow({ status: QueueStatus.pending })];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getPendingQueue();

      expect(reviewQueue.findMany).toHaveBeenCalledWith({ where: { status: 'pending' }, orderBy: { id: 'asc' } });
      expect(result).toHaveLength(2);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getPendingQueue', count: 2 }, 'Fetched pending queue');
    });
  });

  describe('getAll', () => {
    it('returns paginated items with total count', async () => {
      const rows = [makeRow(), makeRow()];
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findMany: createResolvedMock(rows), count: jest.fn<any>().mockResolvedValue(5) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getAll(0, 10);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({ orderBy: { id: 'asc' }, skip: 0, take: 10 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getAll', count: 2, total: 5 }, 'Fetched all queue items');
    });
  });

  describe('getCountsByStatus', () => {
    it('returns counts keyed by QueueStatus, initializing missing statuses to 0', async () => {
      const { pendingCnt, retriggeredCnt, reviewedCnt, skippedCnt, failedCnt } = getUniqueIntsNamed([
        'pendingCnt',
        'retriggeredCnt',
        'reviewedCnt',
        'skippedCnt',
        'failedCnt',
      ]);
      const rows = [
        { status: QueueStatus.pending, _count: { status: pendingCnt } },
        { status: QueueStatus.retriggered, _count: { status: retriggeredCnt } },
        { status: QueueStatus.reviewed, _count: { status: reviewedCnt } },
        { status: QueueStatus.coderabbit_skipped, _count: { status: skippedCnt } },
        { status: QueueStatus.failed, _count: { status: failedCnt } },
      ];

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { groupBy: createResolvedMock(rows) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getCountsByStatus();

      expect(reviewQueue.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: { status: true },
      });
      expect(result).toStrictEqual({
        coderabbit_skipped: skippedCnt,
        failed: failedCnt,
        pending: pendingCnt,
        retriggered: retriggeredCnt,
        reviewed: reviewedCnt,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'QueueRepositoryImpl.getCountsByStatus',
          counts: {
            coderabbit_skipped: skippedCnt,
            failed: failedCnt,
            pending: pendingCnt,
            retriggered: retriggeredCnt,
            reviewed: reviewedCnt,
          },
        },
        'Fetched queue counts by status',
      );
    });
  });

  describe('getTriggered', () => {
    it('returns retriggered items since date ordered by retriggered_at desc', async () => {
      const since = getUniqueDate();
      const row1 = makeRow({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 1000) });
      const row2 = makeRow({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 2000) });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findMany: createResolvedMock([row2, row1]),
          count: createResolvedMock(2),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getTriggered(since, 0, 50, false);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
        orderBy: { retriggered_at: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
      });
      expect(result).toStrictEqual({ items: [mapper.fromReviewQueue(row2), mapper.fromReviewQueue(row1)], total: 2 });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.getTriggered', since, skip: 0, take: 50, includeReviewed: false, count: 2, total: 2 },
        'Fetched triggered queue',
      );
    });

    it('includes reviewed items when includeReviewed is true', async () => {
      const since = getUniqueDate();
      const row = makeRow({ status: QueueStatus.retriggered, retriggered_at: since });
      const completedRow = makeRow({ status: QueueStatus.reviewed, retriggered_at: since });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findMany: createResolvedMock([row, completedRow]),
          count: createResolvedMock(2),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getTriggered(since, 0, 50, true);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered', 'reviewed'] } },
        orderBy: { retriggered_at: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered', 'reviewed'] } },
      });
      expect(result.items).toStrictEqual([mapper.fromReviewQueue(row), mapper.fromReviewQueue(completedRow)]);
    });

    it('respects skip and take for pagination', async () => {
      const since = getUniqueDate();
      const row1 = makeRow({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 4000) });
      const row2 = makeRow({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 3000) });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findMany: createResolvedMock([row1, row2]),
          count: createResolvedMock(4),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getTriggered(since, 1, 2, false);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
        orderBy: { retriggered_at: 'desc' },
        skip: 1,
        take: 2,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
      });
      expect(result).toStrictEqual({ items: [mapper.fromReviewQueue(row1), mapper.fromReviewQueue(row2)], total: 4 });
    });
  });

  describe('findBySourceCommentId', () => {
    it('returns the QueueItem when a matching row exists', async () => {
      const row = makeRow();
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.findBySourceCommentId(row.source_comment_id);

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { source_comment_id: row.source_comment_id } });
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
    });

    it('returns undefined when no matching row exists', async () => {
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(null) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const commentId = getUniqueInt();

      const result = await sut.findBySourceCommentId(commentId);

      expect(result).toBeUndefined();
      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { source_comment_id: commentId } });
    });

    it('maps null timestamps to undefined', async () => {
      const row = makeRow({ retriggered_at: null, failed_at: null, reviewed_at: null });
      const { prisma } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.findBySourceCommentId(row.source_comment_id);

      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
    });
  });

  describe('createSkipped', () => {
    it('creates a row with coderabbit_skipped status and returns item with created: true', async () => {
      const row = makeRow({ status: 'coderabbit_skipped' });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { create: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const data = generateCreateSkippedData({
        repo: row.repo_full_name,
        pr: row.pr_number,
        prTitle: row.pr_title,
        sourceCommentUrl: row.source_comment_url,
        sourceCommentId: row.source_comment_id,
        pullRequestId: row.pull_request_id!,
      });

      const result = await sut.createSkipped(data, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: data.pullRequestId,
          repo_full_name: data.repo,
          pr_number: data.pr,
          pr_title: data.prTitle,
          source_comment_url: data.sourceCommentUrl,
          source_comment_id: data.sourceCommentId,
          status: 'coderabbit_skipped',
        },
      });
      expect(result).toStrictEqual({ item: mapper.fromReviewQueue(row), created: true });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.createSkipped', repo: data.repo, pr: data.pr, commentId: data.sourceCommentId },
        'Created coderabbit skipped entry',
      );
    });

    it('returns existing row with created: false on unique constraint violation', async () => {
      const existingRow = makeRow({ status: 'coderabbit_skipped' });
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
        code: 'P2002',
        clientVersion: '7.8.0',
        meta: { target: ['source_comment_id'] },
      });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          create: jest.fn<any>().mockRejectedValue(prismaError),
          findFirst: createResolvedMock(existingRow),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const data = generateCreateSkippedData({
        repo: existingRow.repo_full_name,
        pr: existingRow.pr_number,
        prTitle: existingRow.pr_title,
        sourceCommentUrl: existingRow.source_comment_url,
        sourceCommentId: existingRow.source_comment_id,
        pullRequestId: existingRow.pull_request_id!,
      });

      const result = await sut.createSkipped(data, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { source_comment_id: data.sourceCommentId } });
      expect(result).toStrictEqual({ item: mapper.fromReviewQueue(existingRow), created: false });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.createSkipped', repo: data.repo, pr: data.pr, commentId: data.sourceCommentId, status: existingRow.status },
        'Skipped entry already exists for this source comment',
      );
    });

    it('rethrows errors that are not unique constraint violations', async () => {
      const error = new Error('connection lost');
      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          create: jest.fn<any>().mockRejectedValue(error),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const data = generateCreateSkippedData();

      await expect(sut.createSkipped(data, prisma as unknown as Prisma.TransactionClient)).rejects.toThrow('connection lost');
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.createSkipped', repo: data.repo, pr: data.pr, error },
        'Create skipped failed; rethrowing',
      );
    });
  });

  describe('toQueueItem null timestamp mapping', () => {
    it('returns existing rows with NULL timestamps', () => {
      const row = makeRow({ retriggered_at: null, failed_at: null, reviewed_at: null });
      const expected = mapper.fromReviewQueue(row);
      expect(expected.retriggered_at).toBeUndefined();
      expect(expected.failed_at).toBeUndefined();
      expect(expected.reviewed_at).toBeUndefined();
    });
  });

  describe('container binding', () => {
    it('resolves QueueRepository from the container', () => {
      const { prisma } = createMockPrismaClient();
      const container = new Container();
      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind(TYPES.EventRepository).toConstantValue({ record: jest.fn(), listForPr: jest.fn() });
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind(TYPES.ProbeFactory).toConstantValue(probeFactory);
      container.bind(TYPES.ReviewQueueToQueueItemMapper).to(ReviewQueueToQueueItemMapper);
      container.bind<QueueRepository>(TYPES.QueueRepository).to(QueueRepositoryImpl);
      expect(container.get<QueueRepository>(TYPES.QueueRepository)).toBeInstanceOf(QueueRepositoryImpl);
    });
  });
});
