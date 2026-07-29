import { type QueueRepository, QueueRepositoryImpl } from '../../src/db/index.js';
import { QueueStatus, Resolution, TYPES } from '../../src/domain.js';
import { PrismaUniqueConstraintViolationError } from '../../src/external-deps/couimet/prisma-repo/index.js';
import { buildCommentUrl } from '../../src/github/index.js';
import { ReviewQueueToQueueItemMapper } from '../../src/mappers/index.js';
import { ProbeFactory } from '../../src/probes/index.js';
import {
  createMockObservationContextProvider,
  createMockPrismaClient,
  createResolvedMock,
  generateCreateSkippedData,
  generateReviewQueueHydrationData,
  generateReviewRef,
} from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueIntsNamed, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

describe('QueueRepositoryImpl', () => {
  let frozenNow: Date;
  let correlationId: string;
  let logger: ReturnType<typeof createMockLogger>;
  let observation: ReturnType<typeof createMockObservationContextProvider>;
  let probeEvents: { record: jest.Mock<any>; listForPr: jest.Mock<any> };
  let probeFactory: ProbeFactory;
  let requestId: string;
  let mapper: ReviewQueueToQueueItemMapper;
  let version: string;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    correlationId = getUuid();
    requestId = getUuid();
    version = '1.0.0-test';
    logger = createMockLogger();
    observation = createMockObservationContextProvider({
      current: jest.fn<any>().mockReturnValue({ correlationId, requestId, version }),
    });
    probeEvents = { record: jest.fn<any>().mockResolvedValue({ uuid: getUuid() }), listForPr: jest.fn<any>() };
    probeFactory = new ProbeFactory(probeEvents as any, observation as any, logger);
    mapper = new ReviewQueueToQueueItemMapper();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe('enqueue', () => {
    it('creates a pending row, records enqueued event, inserts queue_order, and returns it', async () => {
      const ref = generateReviewRef();
      const pullRequestId = getUniqueInt();
      const row = generateReviewQueueHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber, source_comment_url: ref.commentUrl });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: ref.commentId,

          pullRequestId,
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          pr_title: 'Test PR title',
          source_comment_url: ref.commentUrl,
          source_comment_id: ref.commentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: row.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
    });

    it('returns the existing pending row when the PR is already queued (P2002)', async () => {
      const ref = generateReviewRef();
      const existing = generateReviewQueueHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber, status: QueueStatus.pending });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
          create: jest.fn<any>().mockRejectedValue(p2002),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: ref.commentId,

          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenNthCalledWith(3, { where: { repo_full_name: ref.repoFullName, pr_number: ref.prNumber, status: 'pending' } });
      expect(created).toBe(false);
      expect(result).toStrictEqual(mapper.fromReviewQueue(existing));
    });

    it('returns the existing retriggered item when a recent retriggered row exists with the same source_comment_id', async () => {
      const ref = generateReviewRef();
      const recentRetriggered = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        status: QueueStatus.retriggered,
        source_comment_id: ref.commentId,
      });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(recentRetriggered) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: ref.commentId,

          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: ref.repoFullName, pr_number: ref.prNumber, status: 'retriggered' },
      });
      expect(reviewQueue.create).not.toHaveBeenCalled();
      expect(created).toBe(false);
      expect(result).toStrictEqual(mapper.fromReviewQueue(recentRetriggered));
    });

    it('marks old retriggered item as resolved and creates a new pending item when source_comment_id differs', async () => {
      const ref = generateReviewRef();
      const oldCommentId = getUniqueInt();
      const newCommentId = getUniqueInt();
      const oldRetriggered = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        status: QueueStatus.retriggered,
        source_comment_id: oldCommentId,
      });
      const newRow = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        status: QueueStatus.pending,
        source_comment_id: newCommentId,
      });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(oldRetriggered).mockResolvedValueOnce(null),
          create: createResolvedMock(newRow),
          update: createResolvedMock({}),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const newCommentUrl = buildCommentUrl(ref.repoFullName, ref.prNumber, newCommentId);
      const pullRequestId = getUniqueInt();

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: newCommentUrl,
          sourceCommentId: newCommentId,

          pullRequestId,
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: oldRetriggered.id },
        data: { status: 'resolved', resolution: 'review_completed', resolved_at: frozenNow },
      });
      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          pr_title: 'Test PR title',
          source_comment_url: newCommentUrl,
          source_comment_id: newCommentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: newRow.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(newRow));
      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: 'EnqueueProbe.retriggeredReplaced',
          repo: ref.repoFullName,
          pr: ref.prNumber,
          oldCommentId,
          newCommentId,
        },
        'Recycled review-limit comment replaced stale retriggered item; marking old item reviewed',
      );
    });

    it('creates a new pending row when the cooldown has expired', async () => {
      const ref = generateReviewRef();
      const newRow = generateReviewQueueHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber, status: QueueStatus.pending });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(newRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const pullRequestId = getUniqueInt();
      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: ref.commentId,
          pullRequestId,
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: ref.repoFullName, pr_number: ref.prNumber, status: 'retriggered' },
      });
      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          pr_title: 'Test PR title',
          source_comment_url: ref.commentUrl,
          source_comment_id: ref.commentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: newRow.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(newRow));
    });

    it('returns the existing resolved item when the same source_comment_id was recently resolved (completed-entry guard)', async () => {
      const ref = generateReviewRef();
      const recentResolved = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        status: QueueStatus.resolved,
        source_comment_id: ref.commentId,
        resolved_at: frozenNow,
      });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(recentResolved),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: ref.commentId,
          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledTimes(2);
      expect(reviewQueue.create).not.toHaveBeenCalled();
      expect(created).toBe(false);
      expect(result).toStrictEqual(mapper.fromReviewQueue(recentResolved));
      expect(logger.warn).toHaveBeenCalledWith(
        {
          fn: 'EnqueueProbe.recentlyResolved',
          repo: ref.repoFullName,
          pr: ref.prNumber,
          existingUuid: recentResolved.uuid,
          sourceCommentId: ref.commentId,
          elapsedMs: expect.any(Number) as number,
        },
        'Loop detected: same source_comment_id re-enqueued within guard window',
      );
    });

    it('creates a new pending item when the resolved item is outside the guard window', async () => {
      const ref = generateReviewRef();
      const newRow = generateReviewQueueHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber, status: QueueStatus.pending });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          findFirst: createResolvedMock(null),
          create: createResolvedMock(newRow),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const pullRequestId = getUniqueInt();
      const { created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: ref.commentId,
          pullRequestId,
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.create).toHaveBeenCalled();
      expect(queueOrder.create).toHaveBeenCalled();
      expect(created).toBe(true);
    });

    it('re-enqueues a resolved review_completed item when the comment was edited', async () => {
      const ref = generateReviewRef();
      const commentId = getUniqueInt();
      const tenMinAgo = new Date(frozenNow.getTime() - TEN_MINUTES_MS);
      const existingResolved = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_comment_id: commentId,
        status: QueueStatus.resolved,
        resolution: Resolution.ReviewCompleted,
        created_at: tenMinAgo,
        resolved_at: tenMinAgo,
      });
      const updatedRow = {
        ...existingResolved,
        status: QueueStatus.pending as const,
        resolution: null,
        resolved_at: null,
      };
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(existingResolved),
          create: jest.fn<any>().mockRejectedValue(p2002),
          update: createResolvedMock(updatedRow),
        },
        queueOrder: { findUnique: createResolvedMock({ queue_item_id: existingResolved.id }) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Re-enqueued PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: commentId,
          commentUpdatedAt: frozenNow,
          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: existingResolved.id },
        data: { status: 'pending', resolution: null, resolved_at: null, pr_title: 'Re-enqueued PR title' },
      });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(updatedRow));
      const [recordedEvent, recordedTx] = probeEvents.record.mock.lastCall!;
      expect(recordedEvent).toStrictEqual({
        type: 'enqueued',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: {},
      });
      expect(recordedTx).toBe(prisma);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.resolvedReEnqueued', repo: ref.repoFullName, pr: ref.prNumber, sourceCommentId: commentId },
        'Resolved item re-enqueued after comment edit',
      );
      expect(queueOrder.findUnique).toHaveBeenCalledWith({ where: { queue_item_id: existingResolved.id } });
      expect(queueOrder.create).not.toHaveBeenCalled();
    });

    it('re-enqueues a resolved failed item when the comment was edited', async () => {
      const ref = generateReviewRef();
      const commentId = getUniqueInt();
      const tenMinAgo = new Date(frozenNow.getTime() - TEN_MINUTES_MS);
      const existingResolved = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_comment_id: commentId,
        status: QueueStatus.resolved,
        resolution: Resolution.Failed,
        created_at: tenMinAgo,
        resolved_at: tenMinAgo,
      });
      const updatedRow = {
        ...existingResolved,
        status: QueueStatus.pending as const,
        resolution: null,
        resolved_at: null,
      };
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(existingResolved),
          create: jest.fn<any>().mockRejectedValue(p2002),
          update: createResolvedMock(updatedRow),
        },
        queueOrder: { findUnique: createResolvedMock({ queue_item_id: existingResolved.id }) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Re-enqueued PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: commentId,
          commentUpdatedAt: frozenNow,
          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: existingResolved.id },
        data: { status: 'pending', resolution: null, resolved_at: null, pr_title: 'Re-enqueued PR title' },
      });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(updatedRow));
      expect(queueOrder.findUnique).toHaveBeenCalledWith({ where: { queue_item_id: existingResolved.id } });
      expect(queueOrder.create).not.toHaveBeenCalled();
    });

    it('returns existing resolved item with created:false when the comment was NOT edited', async () => {
      const ref = generateReviewRef();
      const commentId = getUniqueInt();
      const tenMinAgo = new Date(frozenNow.getTime() - TEN_MINUTES_MS);
      const commentUpdatedAt = new Date(tenMinAgo.getTime() - FIVE_MINUTES_MS); // Before resolved_at
      const existingResolved = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_comment_id: commentId,
        status: QueueStatus.resolved,
        resolution: Resolution.ReviewCompleted,
        created_at: tenMinAgo,
        resolved_at: tenMinAgo,
      });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(existingResolved),
          create: jest.fn<any>().mockRejectedValue(p2002),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Test PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: commentId,
          commentUpdatedAt,
          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(created).toBe(false);
      expect(result).toStrictEqual(mapper.fromReviewQueue(existingResolved));
      expect(reviewQueue.update).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.resolvedNotEdited', repo: ref.repoFullName, pr: ref.prNumber, sourceCommentId: commentId },
        'Resolved item exists for source comment; comment not edited',
      );
    });

    it('re-enqueues a resolved skipped item and creates queueOrder when comment was edited', async () => {
      const ref = generateReviewRef();
      const commentId = getUniqueInt();
      const tenMinAgo = new Date(frozenNow.getTime() - TEN_MINUTES_MS);
      const existingResolved = generateReviewQueueHydrationData({
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        source_comment_id: commentId,
        status: QueueStatus.resolved,
        resolution: Resolution.Skipped,
        created_at: tenMinAgo,
        resolved_at: tenMinAgo,
      });
      const updatedRow = {
        ...existingResolved,
        status: QueueStatus.pending as const,
        resolution: null,
        resolved_at: null,
      };
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(existingResolved),
          create: jest.fn<any>().mockRejectedValue(p2002),
          update: createResolvedMock(updatedRow),
        },
        queueOrder: { findUnique: createResolvedMock(null) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const { item: result, created } = await sut.enqueue(
        {
          repo: ref.repoFullName,
          pr: ref.prNumber,
          prTitle: 'Re-enqueued PR title',
          sourceCommentUrl: ref.commentUrl,
          sourceCommentId: commentId,
          commentUpdatedAt: frozenNow,
          pullRequestId: getUniqueInt(),
        },
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: existingResolved.id },
        data: { status: 'pending', resolution: null, resolved_at: null, pr_title: 'Re-enqueued PR title' },
      });
      expect(queueOrder.findUnique).toHaveBeenCalledWith({ where: { queue_item_id: existingResolved.id } });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: existingResolved.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(mapper.fromReviewQueue(updatedRow));
    });
  });

  describe('markRetriggered', () => {
    const COMMENT_URL = 'https://github.com/owner/repo/pull/1#issuecomment-123';

    it('updates the row to retriggered with cooldown', async () => {
      const cooldownUntil = getUniqueDate();
      const row = generateReviewQueueHydrationData({ status: QueueStatus.retriggered });
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

  describe('markResolved', () => {
    it('updates the row to resolved', async () => {
      const row = generateReviewQueueHydrationData({ status: QueueStatus.resolved });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const result = await sut.markResolved(row.id, Resolution.Failed, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: 'resolved', resolution: 'failed', resolved_at: frozenNow },
      });
      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markResolved', id: row.id, resolution: 'failed' }, 'Marked review resolved');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.markResolved(getUniqueInt(), Resolution.Failed, prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError(
        'PRISMA_RECORD_NOT_FOUND_P2025',
        {
          message: "Record not found in table 'ReviewQueue'",
          functionName: 'QueueRepositoryImpl.markResolved',
          details: { tableName: 'ReviewQueue' },
          cause: p2025,
        },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.markResolved', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('markResolvedByUuid', () => {
    it('finds by UUID, marks the row resolved, and logs the event', async () => {
      const commentUrl = 'https://gh/c/retriggered-123';
      const row = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retrigger_comment_url: commentUrl });
      const completedRow = { ...row, status: QueueStatus.resolved, resolution: Resolution.ReviewCompleted, resolved_at: frozenNow };
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markResolvedByUuid(row.uuid, Resolution.ReviewCompleted, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { uuid: row.uuid },
        data: { status: 'resolved', resolution: 'review_completed', resolved_at: frozenNow },
      });
      expect(result).toStrictEqual(mapper.fromReviewQueue(completedRow));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'MarkQueueItemReviewedProbe.queueItemMarkedReviewed', uuid: row.uuid, id: row.id },
        'Marked review reviewed by UUID',
      );
    });

    it('handles null retrigger_comment_url', async () => {
      const row = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retrigger_comment_url: null });
      const completedRow = { ...row, status: QueueStatus.resolved, resolution: Resolution.ReviewCompleted, resolved_at: frozenNow };
      const { prisma } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markResolvedByUuid(row.uuid, Resolution.ReviewCompleted, prisma as unknown as Prisma.TransactionClient);

      expect(result).toStrictEqual(mapper.fromReviewQueue(completedRow));
    });

    it('returns undefined when UUID is not found', async () => {
      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' })),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markResolvedByUuid('missing-uuid', Resolution.ReviewCompleted, prisma as unknown as Prisma.TransactionClient);

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

      await expect(sut.markResolvedByUuid('some-uuid', Resolution.ReviewCompleted, prisma as unknown as Prisma.TransactionClient)).rejects.toThrow('DB down');
    });

    it('wraps in a transaction when called without tx', async () => {
      const row = generateReviewQueueHydrationData({ status: QueueStatus.retriggered });
      const completedRow = { ...row, status: QueueStatus.resolved, resolution: Resolution.ReviewCompleted, resolved_at: frozenNow };
      const { prisma } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.markResolvedByUuid(row.uuid, Resolution.ReviewCompleted);

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
      const row = generateReviewQueueHydrationData();
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

    it('marks current item as resolved when source_comment_id collides with an existing resolved row', async () => {
      const row = generateReviewQueueHydrationData();
      const commentId = getUniqueInt();
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const existingResolved = generateReviewQueueHydrationData({ status: QueueStatus.resolved, source_comment_id: commentId });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockRejectedValueOnce(p2002).mockResolvedValueOnce({}),
          findFirst: createResolvedMock(existingResolved),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.reschedule(row.id, { commentId, commentUrl }, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledTimes(2);
      expect(reviewQueue.update).toHaveBeenNthCalledWith(2, {
        where: { id: row.id },
        data: { status: 'resolved', resolution: 'review_completed', resolved_at: frozenNow },
      });
      expect(result).toStrictEqual(mapper.fromReviewQueue(existingResolved));
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.reschedule', id: row.id, existingId: existingResolved.id, sourceCommentId: commentId },
        'Reschedule collision: source_comment_id already exists on a resolved row; marking current item as resolved',
      );
    });

    it('rethrows PrismaUniqueConstraintViolationError when findFirst returns a non-resolved row', async () => {
      const row = generateReviewQueueHydrationData();
      const commentId = getUniqueInt();
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });
      const nonResolvedRow = generateReviewQueueHydrationData({ status: QueueStatus.pending, source_comment_id: commentId });

      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockRejectedValueOnce(p2002),
          findFirst: createResolvedMock(nonResolvedRow),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.reschedule(row.id, { commentId, commentUrl }, prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError(
        'PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002',
        {
          message: "Unique constraint violation in table 'ReviewQueue'",
          functionName: 'QueueRepositoryImpl.reschedule',
          details: { tableName: 'ReviewQueue' },
          cause: p2002,
        },
      );
      expect(logger.error).toHaveBeenCalledWith(
        {
          fn: 'QueueRepositoryImpl.reschedule',
          id: row.id,
          sourceCommentId: commentId,
          error: expect.any(PrismaUniqueConstraintViolationError) as PrismaUniqueConstraintViolationError,
        },
        'Reschedule failed with no existing row to recover; rethrowing',
      );
    });

    it('rethrows PrismaUniqueConstraintViolationError when no existing row has the conflicting source_comment_id', async () => {
      const row = generateReviewQueueHydrationData();
      const commentId = getUniqueInt();
      const commentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockRejectedValueOnce(p2002),
          findFirst: createResolvedMock(null),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(sut.reschedule(row.id, { commentId, commentUrl }, prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError(
        'PRISMA_UNIQUE_CONSTRAINT_VIOLATION_P2002',
        {
          message: "Unique constraint violation in table 'ReviewQueue'",
          functionName: 'QueueRepositoryImpl.reschedule',
          details: { tableName: 'ReviewQueue' },
          cause: p2002,
        },
      );
      expect(logger.error).toHaveBeenCalledWith(
        {
          fn: 'QueueRepositoryImpl.reschedule',
          id: row.id,
          sourceCommentId: commentId,
          error: expect.any(PrismaUniqueConstraintViolationError) as PrismaUniqueConstraintViolationError,
        },
        'Reschedule failed with no existing row to recover; rethrowing',
      );
    });
  });

  describe('backoff', () => {
    it('increments attempts, logs, and returns updated item', async () => {
      const row = generateReviewQueueHydrationData();
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(row) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.backoff(row.id, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, status: 'retriggered' },
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
      const rows = [
        generateReviewQueueHydrationData({ status: QueueStatus.retriggered }),
        generateReviewQueueHydrationData({ status: QueueStatus.retriggered }),
      ];
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

  describe('resolveStaleRetriggered', () => {
    it('resolves retriggered items older than maxAgeMs', async () => {
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { updateMany: createResolvedMock({ count: 2 }) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);
      const maxAgeMs = 1000;

      const result = await sut.resolveStaleRetriggered(maxAgeMs, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.updateMany).toHaveBeenCalledWith({
        where: { status: 'retriggered', retriggered_at: { lt: expect.any(Date) as Date } },
        data: { status: 'resolved', resolution: 'failed', resolved_at: frozenNow },
      });
      expect(result).toBe(2);
    });

    it('returns 0 when no stale items exist', async () => {
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { updateMany: createResolvedMock({ count: 0 }) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.resolveStaleRetriggered(1000, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.updateMany).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('getOldestPending', () => {
    it('returns the oldest pending item', async () => {
      const row = generateReviewQueueHydrationData({ status: QueueStatus.pending });
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
      const ref = generateReviewRef();
      const networkError = new Error('Connection lost');
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: jest.fn<any>().mockRejectedValue(networkError) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(() =>
        sut.enqueue(
          {
            repo: ref.repoFullName,
            pr: ref.prNumber,
            prTitle: 'Test PR title',
            sourceCommentUrl: ref.commentUrl,
            sourceCommentId: ref.commentId,
            pullRequestId: getUniqueInt(),
          },
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('Connection lost');

      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.enqueue', repo: ref.repoFullName, pr: ref.prNumber, error: networkError },
        'Enqueue failed; rethrowing',
      );
    });

    it('logs warning and rethrows when P2002 fires but no pending row exists', async () => {
      const ref = generateReviewRef();
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { create: jest.fn<any>().mockRejectedValue(p2002), findFirst: createResolvedMock(null) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      await expect(() =>
        sut.enqueue(
          {
            repo: ref.repoFullName,
            pr: ref.prNumber,
            prTitle: 'Test PR title',
            sourceCommentUrl: ref.commentUrl,
            sourceCommentId: ref.commentId,
            pullRequestId: getUniqueInt(),
          },
          prisma as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('Unique constraint');

      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.enqueue', repo: ref.repoFullName, pr: ref.prNumber, error: expect.any(PrismaUniqueConstraintViolationError) },
        'Enqueue failed; rethrowing',
      );
    });
  });

  describe('getPendingQueue', () => {
    it('returns pending items ordered by id', async () => {
      const rows = [generateReviewQueueHydrationData({ status: QueueStatus.pending }), generateReviewQueueHydrationData({ status: QueueStatus.pending })];
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
      const rows = [generateReviewQueueHydrationData(), generateReviewQueueHydrationData()];
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
      const { pendingCnt, retriggeredCnt, resolvedCnt } = getUniqueIntsNamed(['pendingCnt', 'retriggeredCnt', 'resolvedCnt']);
      const rows = [
        { status: QueueStatus.pending, _count: { status: pendingCnt } },
        { status: QueueStatus.retriggered, _count: { status: retriggeredCnt } },
        { status: QueueStatus.resolved, _count: { status: resolvedCnt } },
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
        pending: pendingCnt,
        retriggered: retriggeredCnt,
        resolved: resolvedCnt,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'QueueRepositoryImpl.getCountsByStatus',
          counts: {
            pending: pendingCnt,
            retriggered: retriggeredCnt,
            resolved: resolvedCnt,
          },
        },
        'Fetched queue counts by status',
      );
    });
  });

  describe('getSkippedItems', () => {
    it('returns resolved skipped items ordered by created_at desc, limited to 50', async () => {
      const rows = [
        generateReviewQueueHydrationData({ status: QueueStatus.resolved, resolution: Resolution.Skipped }),
        generateReviewQueueHydrationData({ status: QueueStatus.resolved, resolution: Resolution.Skipped }),
      ];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getSkippedItems();

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'resolved', resolution: 'skipped' },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
      expect(result).toStrictEqual(rows.map((row) => mapper.fromReviewQueue(row)));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getSkippedItems', count: 2 }, 'Fetched skipped items');
    });

    it('returns empty array when no skipped items exist', async () => {
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock([]) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getSkippedItems();

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { status: 'resolved', resolution: 'skipped' },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
      expect(result).toHaveLength(0);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.getSkippedItems', count: 0 }, 'Fetched skipped items');
    });
  });

  describe('getTriggered', () => {
    it('returns retriggered items since date ordered by retriggered_at desc', async () => {
      const since = getUniqueDate();
      const row1 = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 1000) });
      const row2 = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 2000) });
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
        { fn: 'QueueRepositoryImpl.getTriggered', since, skip: 0, take: 50, includeResolved: false, count: 2, total: 2 },
        'Fetched triggered queue',
      );
    });

    it('includes resolved items when includeResolved is true', async () => {
      const since = getUniqueDate();
      const row = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retriggered_at: since });
      const resolvedRow = generateReviewQueueHydrationData({ status: QueueStatus.resolved, retriggered_at: since });
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findMany: createResolvedMock([row, resolvedRow]),
          count: createResolvedMock(2),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.getTriggered(since, 0, 50, true);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered', 'resolved'] } },
        orderBy: { retriggered_at: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered', 'resolved'] } },
      });
      expect(result.items).toStrictEqual([mapper.fromReviewQueue(row), mapper.fromReviewQueue(resolvedRow)]);
    });

    it('respects skip and take for pagination', async () => {
      const since = getUniqueDate();
      const row1 = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 4000) });
      const row2 = generateReviewQueueHydrationData({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 3000) });
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
      const row = generateReviewQueueHydrationData();
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
      const row = generateReviewQueueHydrationData({ retriggered_at: null, failed_at: null, reviewed_at: null });
      const { prisma } = createMockPrismaClient({ reviewQueue: { findFirst: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, mapper, logger);

      const result = await sut.findBySourceCommentId(row.source_comment_id);

      expect(result).toStrictEqual(mapper.fromReviewQueue(row));
    });
  });

  describe('createSkipped', () => {
    it('creates a row with resolved status / skipped resolution and returns item with created: true', async () => {
      const row = generateReviewQueueHydrationData({ status: QueueStatus.resolved, resolution: Resolution.Skipped, resolved_at: frozenNow });
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
          status: 'resolved',
          resolution: 'skipped',
          resolved_at: frozenNow,
        },
      });
      expect(result).toStrictEqual({ item: mapper.fromReviewQueue(row), created: true });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.createSkipped', repo: data.repo, pr: data.pr, commentId: data.sourceCommentId },
        'Created skipped entry',
      );
    });

    it('returns existing row with created: false on unique constraint violation', async () => {
      const existingRow = generateReviewQueueHydrationData({ status: QueueStatus.resolved, resolution: Resolution.Skipped });
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
      const row = generateReviewQueueHydrationData({ retriggered_at: null, failed_at: null, reviewed_at: null });
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
