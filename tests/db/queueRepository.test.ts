import { type QueueRepository, QueueRepositoryImpl } from '../../src/db/queueRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import { ProbeFactory } from '../../src/probes/ProbeFactory.js';
import { QueueStatus, TriggerSource } from '../../src/types/index.js';
import { createMockObservationContextProvider, createMockPrismaClient, createResolvedMock } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Prisma, type PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

interface RowOverrides {
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
  retrigger_comment_url?: string | null;
  retriggered_at?: Date | null;
  failed_at?: Date | null;
  reviewed_at?: Date | null;
  pull_request_id?: number | null;
}

const makeRow = (over: RowOverrides = {}) => {
  const commentId = getUniqueInt();
  return {
    id: over.id ?? getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: over.repo_full_name ?? getUniqueGitHubRepoRef().fullName,
    pr_number: over.pr_number ?? getUniqueInt(),
    pr_title: over.pr_title ?? 'Test PR title',
    status: over.status ?? 'pending',
    not_before: over.not_before ?? getUniqueDate(),
    attempts: over.attempts ?? 0,
    source_comment_url: over.source_comment_url ?? `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`,
    source_comment_id: over.source_comment_id ?? commentId,
    trigger_source: over.trigger_source ?? null,
    retrigger_comment_url: over.retrigger_comment_url ?? null,
    retriggered_at: over.retriggered_at ?? null,
    failed_at: over.failed_at ?? null,
    reviewed_at: over.reviewed_at ?? null,
    pull_request_id: over.pull_request_id ?? getUniqueInt(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
  };
};

const toExpectedItem = (row: ReturnType<typeof makeRow>) => ({
  id: row.id,
  uuid: row.uuid,
  repo_full_name: row.repo_full_name,
  pr_number: row.pr_number,
  pr_title: row.pr_title,
  status: row.status as QueueStatus,
  not_before: row.not_before,
  attempts: row.attempts,
  source_comment_url: row.source_comment_url,
  source_comment_id: row.source_comment_id!,
  trigger_source: row.trigger_source as TriggerSource,
  retrigger_comment_url: row.retrigger_comment_url ?? undefined,
  retriggered_at: row.retriggered_at ?? undefined,
  failed_at: row.failed_at ?? undefined,
  reviewed_at: row.reviewed_at ?? undefined,
  pull_request_id: row.pull_request_id!,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

describe('QueueRepositoryImpl', () => {
  let frozenNow: Date;
  let logger: Logger;
  let observation: ReturnType<typeof createMockObservationContextProvider>;
  let observationContext: ReturnType<ReturnType<typeof createMockObservationContextProvider>['current']>;
  let probeEvents: { record: jest.Mock<any>; listForPr: jest.Mock<any> };
  let probeFactory: ProbeFactory;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    logger = createMockLogger();
    observation = createMockObservationContextProvider();
    observationContext = observation.current();
    probeEvents = { record: jest.fn<any>().mockResolvedValue({ uuid: getUuid() }), listForPr: jest.fn<any>() };
    probeFactory = new ProbeFactory(probeEvents as any, observation as any, logger);
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  describe('enqueue', () => {
    it('creates a pending row, records enqueued event, inserts queue_order, and returns it', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const notBefore = getUniqueDate();
      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const pullRequestId = getUniqueInt();
      const obs = observationContext;
      const row = makeRow({ repo_full_name: repo, pr_number: pr, source_comment_url: sourceUrl });

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(row) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const { item: result, created } = await sut.enqueue(
        { repo, pr, prTitle: 'Test PR title', notBefore, sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId },
        obs,
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: repo,
          pr_number: pr,
          pr_title: 'Test PR title',
          not_before: notBefore,
          source_comment_url: sourceUrl,
          source_comment_id: commentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: row.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(toExpectedItem(row));
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const { item: result, created } = await sut.enqueue(
        {
          repo,
          pr,
          prTitle: 'Test PR title',
          notBefore: existing.not_before,
          sourceCommentUrl: sourceUrl,
          sourceCommentId: commentId,
          newWait,
          pullRequestId: getUniqueInt(),
        },
        observationContext,
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({ where: { repo_full_name: repo, pr_number: pr, status: 'pending' } });
      expect(created).toBe(false);
      expect(result).toStrictEqual(toExpectedItem(existing));
    });

    it('updates not_before on the existing pending item when re-detected with a different value', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const originalNotBefore = getUniqueDate();
      const newNotBefore = new Date(originalNotBefore.getTime() - 600_000);
      const existing = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.pending, not_before: originalNotBefore });
      const updated = { ...existing, not_before: newNotBefore };
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.8.0' });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: {
          findFirst: jest.fn<any>().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
          create: jest.fn<any>().mockRejectedValue(p2002),
          update: jest.fn<any>().mockResolvedValue(updated),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const { item: result, created } = await sut.enqueue(
        {
          repo,
          pr,
          prTitle: 'Test PR title',
          notBefore: newNotBefore,
          sourceCommentUrl: sourceUrl,
          sourceCommentId: commentId,
          newWait,
          pullRequestId: getUniqueInt(),
        },
        observationContext,
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: existing.id }, data: { not_before: newNotBefore } });
      expect(created).toBe(false);
      expect(result).toStrictEqual(toExpectedItem(updated));
    });

    it('returns the existing retriggered item when a recent retriggered row exists (within cooldown)', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const recentRetriggered = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.retriggered, not_before: new Date(Date.now() + 3_600_000) });

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(recentRetriggered) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const notBefore = getUniqueDate();
      const { item: result, created } = await sut.enqueue(
        { repo, pr, prTitle: 'Test PR title', notBefore, sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId: getUniqueInt() },
        observationContext,
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'retriggered', not_before: { gt: frozenNow } },
      });
      expect(reviewQueue.create).not.toHaveBeenCalled();
      expect(created).toBe(false);
      expect(result).toStrictEqual(toExpectedItem(recentRetriggered));
    });

    it('creates a new pending row when the cooldown has expired', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const newRow = makeRow({ repo_full_name: repo, pr_number: pr, status: QueueStatus.pending });
      const notBefore = getUniqueDate();

      const { prisma, reviewQueue, queueOrder } = createMockPrismaClient({
        reviewQueue: { findFirst: createResolvedMock(null), create: createResolvedMock(newRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const commentId = getUniqueInt();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      const pullRequestId = getUniqueInt();
      const { item: result, created } = await sut.enqueue(
        { repo, pr, prTitle: 'Test PR title', notBefore, sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId },
        observationContext,
        prisma as unknown as Prisma.TransactionClient,
      );

      expect(reviewQueue.findFirst).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr, status: 'retriggered', not_before: { gt: frozenNow } },
      });
      expect(reviewQueue.create).toHaveBeenCalledWith({
        data: {
          pull_request_id: pullRequestId,
          repo_full_name: repo,
          pr_number: pr,
          pr_title: 'Test PR title',
          not_before: notBefore,
          source_comment_url: sourceUrl,
          source_comment_id: commentId,
          trigger_source: 'scheduler',
        },
      });
      expect(queueOrder.create).toHaveBeenCalledWith({ data: { queue_item_id: newRow.id } });
      expect(created).toBe(true);
      expect(result).toStrictEqual(toExpectedItem(newRow));
    });
  });

  describe('markRetriggered', () => {
    const COMMENT_URL = 'https://github.com/owner/repo/pull/1#issuecomment-123';

    it('updates the row to retriggered with cooldown', async () => {
      const cooldownUntil = getUniqueDate();
      const row = makeRow({ status: QueueStatus.retriggered });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.markRetriggered(row.id, cooldownUntil, COMMENT_URL, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { status: 'retriggered', retriggered_at: frozenNow, retrigger_comment_url: COMMENT_URL, not_before: cooldownUntil },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
      const result = await sut.markFailed(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'failed', failed_at: frozenNow } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markFailed', id: row.id }, 'Marked review failed');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
      const result = await sut.markReviewed(row.id, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { status: 'reviewed', reviewed_at: frozenNow } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.markReviewed', id: row.id }, 'Marked review reviewed');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
      const COMMENT_URL = 'https://gh/c/retriggered-123';
      const row = makeRow({ status: QueueStatus.retriggered, retrigger_comment_url: COMMENT_URL });
      const completedRow = { ...row, status: QueueStatus.reviewed, reviewed_at: frozenNow };
      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.markReviewedByUuid(row.uuid, prisma as unknown as Prisma.TransactionClient);

      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { uuid: row.uuid },
        data: { status: 'reviewed', reviewed_at: frozenNow },
      });
      expect(result).toStrictEqual(toExpectedItem(completedRow));
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.markReviewedByUuid(row.uuid, prisma as unknown as Prisma.TransactionClient);

      expect(result).toStrictEqual(toExpectedItem(completedRow));
    });

    it('returns undefined when UUID is not found', async () => {
      const { prisma } = createMockPrismaClient({
        reviewQueue: {
          update: jest.fn<any>().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' })),
        },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      await expect(sut.markReviewedByUuid('some-uuid', prisma as unknown as Prisma.TransactionClient)).rejects.toThrow('DB down');
    });

    it('wraps in a transaction when called without tx', async () => {
      const row = makeRow({ status: QueueStatus.retriggered });
      const completedRow = { ...row, status: QueueStatus.reviewed, reviewed_at: frozenNow };
      const { prisma } = createMockPrismaClient({
        reviewQueue: { update: createResolvedMock(completedRow) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.markReviewedByUuid(row.uuid);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toStrictEqual(toExpectedItem(completedRow));
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'MarkQueueItemReviewedProbe.queueItemMarkedReviewed', uuid: row.uuid, id: row.id },
        'Marked review reviewed by UUID',
      );
    });
  });

  describe('reschedule', () => {
    it('increments attempts, sets new not_before, and updates source comment fields', async () => {
      const newDate = getUniqueDate();
      const newCommentId = getUniqueInt();
      const newCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const row = makeRow({ attempts: 2 });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
      const result = await sut.reschedule(
        row.id,
        newDate,
        { commentId: newCommentId, commentUrl: newCommentUrl },
        prisma as unknown as Prisma.TransactionClient,
      );
      expect(reviewQueue.update).toHaveBeenCalledWith({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, not_before: newDate, source_comment_id: newCommentId, source_comment_url: newCommentUrl },
      });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.reschedule', id: row.id }, 'Rescheduled review');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const newDate = getUniqueDate();
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      await expect(
        sut.reschedule(
          getUniqueInt(),
          newDate,
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
    it('increments attempts and sets new not_before without touching source comment fields', async () => {
      const newDate = getUniqueDate();
      const row = makeRow({ attempts: 2 });
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { update: createResolvedMock(row) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
      const result = await sut.backoff(row.id, newDate, prisma as unknown as Prisma.TransactionClient);
      expect(reviewQueue.update).toHaveBeenCalledWith({ where: { id: row.id }, data: { attempts: { increment: 1 }, not_before: newDate } });
      expect(result).toStrictEqual(toExpectedItem(row));
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'QueueRepositoryImpl.backoff', id: row.id }, 'Backoff applied');
    });

    it('wraps P2025 errors in PrismaRecordNotFoundError', async () => {
      const newDate = getUniqueDate();
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.8.0' });
      const { prisma, reviewQueue: _reviewQueue } = createMockPrismaClient({
        reviewQueue: { update: jest.fn<any>().mockRejectedValue(p2025) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      await expect(sut.backoff(getUniqueInt(), newDate, prisma as unknown as Prisma.TransactionClient)).rejects.toBeDetailedError(
        'PRISMA_RECORD_NOT_FOUND_P2025',
        {
          message: "Record not found in table 'ReviewQueue'",
          functionName: 'QueueRepositoryImpl.backoff',
          details: { tableName: 'ReviewQueue' },
          cause: p2025,
        },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.backoff', modelName: 'ReviewQueue', prismaCode: 'P2025' },
        'Prisma record not found, throwing typed error',
      );
    });
  });

  describe('getPendingQueue', () => {
    it('returns all pending items sorted by not_before', async () => {
      const rows = [makeRow({ status: QueueStatus.pending }), makeRow({ status: QueueStatus.pending })];
      const { prisma, reviewQueue } = createMockPrismaClient({ reviewQueue: { findMany: createResolvedMock(rows) } });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);
      const result = await sut.getOldestPending();
      expect(result).toBeNull();
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const commentId = getUniqueInt();
      const notBefore = getUniqueDate();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      await expect(() =>
        sut.enqueue(
          { repo, pr, prTitle: 'Test PR title', notBefore, sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId: getUniqueInt() },
          observationContext,
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const commentId = getUniqueInt();
      const notBefore = getUniqueDate();
      const sourceUrl = `https://gh/c/${getUniqueInt()}#issuecomment-${commentId}`;
      const newWait = getUniqueInt();
      await expect(() =>
        sut.enqueue(
          { repo, pr, prTitle: 'Test PR title', notBefore, sourceCommentUrl: sourceUrl, sourceCommentId: commentId, newWait, pullRequestId: getUniqueInt() },
          observationContext,
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

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
        { status: QueueStatus.reviewed, _count: { status: 1 } },
      ];

      const { prisma, reviewQueue } = createMockPrismaClient({
        reviewQueue: { groupBy: createResolvedMock(rows) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.getCountsByStatus();

      expect(reviewQueue.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _count: { status: true },
      });
      expect(result).toStrictEqual({ pending: 7, retriggered: 3, reviewed: 1, failed: 0 });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'QueueRepositoryImpl.getCountsByStatus', counts: { pending: 7, retriggered: 3, reviewed: 1, failed: 0 } },
        'Fetched queue counts by status',
      );
    });
  });

  describe('getTriggered', () => {
    const toTriggeredItem = (row: ReturnType<typeof makeRow>) => ({ ...toExpectedItem(row), last_coderabbit_acknowledged_at: undefined });

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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.getTriggered(since, 0, 50, false);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
        include: { pullRequest: { select: { last_coderabbit_acknowledged_at: true } } },
        orderBy: { retriggered_at: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
      });
      expect(result).toStrictEqual({ items: [toTriggeredItem(row2), toTriggeredItem(row1)], total: 2 });
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.getTriggered(since, 0, 50, true);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered', 'reviewed'] } },
        include: { pullRequest: { select: { last_coderabbit_acknowledged_at: true } } },
        orderBy: { retriggered_at: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered', 'reviewed'] } },
      });
      expect(result.items).toStrictEqual([toTriggeredItem(row), toTriggeredItem(completedRow)]);
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
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.getTriggered(since, 1, 2, false);

      expect(reviewQueue.findMany).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
        include: { pullRequest: { select: { last_coderabbit_acknowledged_at: true } } },
        orderBy: { retriggered_at: 'desc' },
        skip: 1,
        take: 2,
      });
      expect(reviewQueue.count).toHaveBeenCalledWith({
        where: { retriggered_at: { gte: since }, status: { in: ['retriggered'] } },
      });
      expect(result).toStrictEqual({ items: [toTriggeredItem(row1), toTriggeredItem(row2)], total: 4 });
    });

    it('includes last_coderabbit_acknowledged_at from pull_request when available', async () => {
      const since = getUniqueDate();
      const acknowledgedAt = getUniqueDate();
      const row = {
        ...makeRow({ status: QueueStatus.retriggered, retriggered_at: new Date(since.getTime() + 1000) }),
        pullRequest: { last_coderabbit_acknowledged_at: acknowledgedAt },
      };
      const { prisma } = createMockPrismaClient({
        reviewQueue: { findMany: createResolvedMock([row]), count: createResolvedMock(1) },
      });
      const sut = new QueueRepositoryImpl(prisma, probeFactory, logger);

      const result = await sut.getTriggered(since, 0, 50, false);

      expect(result.items[0].last_coderabbit_acknowledged_at).toStrictEqual(acknowledgedAt);
    });
  });

  describe('toQueueItem null timestamp mapping', () => {
    it('returns existing rows with NULL timestamps', () => {
      const row = makeRow({ retriggered_at: null, failed_at: null, reviewed_at: null });
      const expected = toExpectedItem(row);
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
      container.bind<QueueRepository>(TYPES.QueueRepository).to(QueueRepositoryImpl);
      expect(container.get<QueueRepository>(TYPES.QueueRepository)).toBeInstanceOf(QueueRepositoryImpl);
    });
  });
});
