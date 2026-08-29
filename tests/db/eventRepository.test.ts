import { type EventRepository, EventRepositoryImpl, type NewEvent } from '../../src/db/index.js';
import { EventType, TYPES } from '../../src/domain.js';
import { createMockPrismaClient, createResolvedMock, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueIntsNamed, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

describe('EventRepositoryImpl', () => {
  const EXPECTED_EVENT_COUNT = 2;

  describe('record', () => {
    it('inserts a detected event standalone through its own client when no tx is passed', async () => {
      const ref = generateReviewRef();
      const correlationId = getUuid();
      const requestId = getUuid();
      const version = getUniqueString({ prefix: 'v' });
      const sourceCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const id = getUniqueInt();
      const uuid = getUuid();
      const ts = getUniqueDate();

      const storedRow = {
        id,
        uuid,
        ts,
        type: 'detected',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: JSON.stringify({ source_comment_url: sourceCommentUrl }),
        metadata: null,
      };

      const { prisma, event } = createMockPrismaClient({
        event: { create: createResolvedMock(storedRow) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const input: NewEvent = {
        type: EventType.detected,
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: { source_comment_url: sourceCommentUrl },
      };
      const result = await sut.record(input, undefined);

      expect(event.create).toHaveBeenCalledWith({
        data: {
          type: 'detected',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: correlationId,
          request_id: requestId,
          version,
          payload: JSON.stringify({ source_comment_url: sourceCommentUrl }),
          metadata: null,
        },
      });
      expect(result).toStrictEqual({
        id,
        uuid,
        ts,
        type: 'detected',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        metadata: undefined,
        payload: { source_comment_url: sourceCommentUrl },
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'EventRepositoryImpl.record', type: 'detected', repo: ref.repoFullName, pr: ref.prNumber },
        'Event recorded',
      );
    });

    it('writes through the transaction client and serializes metadata', async () => {
      const ref = generateReviewRef();
      const correlationId = getUuid();
      const version = getUniqueString({ prefix: 'v' });
      const reason = getUniqueString({ prefix: 'reason-' });
      const metadata = {
        git_sha: getUniqueString(),
        host: getUniqueString(),
      };
      const ts = getUniqueDate();

      const storedRow = {
        id: getUniqueInt(),
        uuid: getUuid(),
        ts,
        type: 'failed',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: correlationId,
        request_id: null,
        version,
        payload: JSON.stringify({ reason }),
        metadata: JSON.stringify(metadata),
      };

      const tx = createMockPrismaClient({
        event: { create: createResolvedMock(storedRow) },
      });
      const base = createMockPrismaClient();
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(base.prisma, logger);

      const result = await sut.record(
        {
          type: EventType.failed,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: correlationId,
          version,
          metadata,
          payload: { reason },
        },
        tx.prisma as unknown as Prisma.TransactionClient,
      );

      expect(tx.event.create).toHaveBeenCalledWith({
        data: {
          type: 'failed',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: correlationId,
          request_id: null,
          version,
          payload: JSON.stringify({ reason }),
          metadata: JSON.stringify(metadata),
        },
      });
      expect(base.event.create).not.toHaveBeenCalled();
      expect(result.metadata).toStrictEqual(metadata);
      expect(result.request_id).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'EventRepositoryImpl.record', type: 'failed', repo: ref.repoFullName, pr: ref.prNumber },
        'Event recorded',
      );
    });
  });

  describe('listForPr', () => {
    it('returns events for a PR ordered by ts', async () => {
      const ref = generateReviewRef();
      const detectedUrl = getUniqueString({ prefix: 'https://gh/c/' });

      const detectedRow = {
        id: getUniqueInt(),
        uuid: getUuid(),
        ts: getUniqueDate(),
        type: 'detected',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: getUuid(),
        request_id: null,
        version: getUniqueString(),
        payload: JSON.stringify({ source_comment_url: detectedUrl }),
        metadata: null,
      };
      const enqueuedRow = {
        id: getUniqueInt(),
        uuid: getUuid(),
        ts: getUniqueDate(),
        type: 'enqueued',
        repo_full_name: ref.repoFullName,
        pr_number: ref.prNumber,
        correlation_id: getUuid(),
        request_id: null,
        version: getUniqueString(),
        payload: JSON.stringify({}),
        metadata: null,
      };

      const { prisma, event } = createMockPrismaClient({
        event: { findMany: createResolvedMock([detectedRow, enqueuedRow]) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const result = await sut.listForPr(ref.repoFullName, ref.prNumber);

      expect(event.findMany).toHaveBeenCalledWith({
        where: { repo_full_name: ref.repoFullName, pr_number: ref.prNumber },
        orderBy: { ts: 'asc' },
      });
      expect(result).toStrictEqual([
        {
          id: detectedRow.id,
          uuid: detectedRow.uuid,
          ts: detectedRow.ts,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: detectedRow.correlation_id,
          request_id: undefined,
          version: detectedRow.version,
          metadata: undefined,
          type: 'detected',
          payload: { source_comment_url: detectedUrl },
        },
        {
          id: enqueuedRow.id,
          uuid: enqueuedRow.uuid,
          ts: enqueuedRow.ts,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: enqueuedRow.correlation_id,
          request_id: undefined,
          version: enqueuedRow.version,
          metadata: undefined,
          type: 'enqueued',
          payload: {},
        },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'EventRepositoryImpl.listForPr',
          repo: ref.repoFullName,
          pr: ref.prNumber,
          count: EXPECTED_EVENT_COUNT,
        },
        'Listed events for PR',
      );
    });
  });

  describe('listRecent', () => {
    it('returns paginated events sorted by ts descending, with total count', async () => {
      const skip = 0;
      const take = 10;
      const ref = generateReviewRef();
      const sourceCommentUrl = getUniqueString();
      const retriggeredCommentUrl = getUniqueString();
      const rows = [
        {
          id: getUniqueInt(),
          uuid: getUuid(),
          ts: getUniqueDate(),
          type: 'retriggered',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: getUuid(),
          request_id: null,
          version: getUniqueString(),
          payload: JSON.stringify({ source_comment_url: sourceCommentUrl, retriggered_comment_url: retriggeredCommentUrl }),
          metadata: null,
        },
      ];
      const total = 15;

      const { prisma, event } = createMockPrismaClient({
        event: { findMany: createResolvedMock(rows), count: createResolvedMock(total) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const result = await sut.listRecent(skip, take);

      expect(event.findMany).toHaveBeenCalledWith({
        orderBy: { ts: 'desc' },
        skip,
        take,
      });
      expect(event.count).toHaveBeenCalledWith();
      expect(result.items).toStrictEqual([
        {
          id: rows[0].id,
          uuid: rows[0].uuid,
          ts: rows[0].ts,
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: rows[0].correlation_id,
          request_id: undefined,
          version: rows[0].version,
          metadata: undefined,
          type: 'retriggered',
          payload: { source_comment_url: sourceCommentUrl, retriggered_comment_url: retriggeredCommentUrl },
        },
      ]);
      expect(result.total).toBe(total);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'EventRepositoryImpl.listRecent', count: rows.length, total }, 'Listed recent events');
    });
  });

  describe('countByType', () => {
    it('returns counts keyed by EventType for events since the given date', async () => {
      const since = getUniqueDate();
      const {
        detectedCnt,
        enqueuedCnt,
        retriggeredCnt,
        dismissedCnt,
        approvedCnt,
        changesReqCnt,
        skippedCnt,
        failedCnt,
        runIdChangedCnt,
        runIdClearedCnt,
        runIdFirstSeenCnt,
      } = getUniqueIntsNamed([
        'detectedCnt',
        'enqueuedCnt',
        'retriggeredCnt',
        'dismissedCnt',
        'approvedCnt',
        'changesReqCnt',
        'skippedCnt',
        'failedCnt',
        'runIdChangedCnt',
        'runIdClearedCnt',
        'runIdFirstSeenCnt',
      ]);
      const rows = [
        { type: 'detected', _count: { type: detectedCnt } },
        { type: 'enqueued', _count: { type: enqueuedCnt } },
        { type: 'retriggered', _count: { type: retriggeredCnt } },
        { type: 'dismissed', _count: { type: dismissedCnt } },
        { type: 'coderabbit_review_approved', _count: { type: approvedCnt } },
        { type: 'coderabbit_review_changes_suggested', _count: { type: changesReqCnt } },
        { type: 'coderabbit_review_skipped', _count: { type: skippedCnt } },
        { type: 'coderabbit_run_id_changed', _count: { type: runIdChangedCnt } },
        { type: 'coderabbit_run_id_cleared', _count: { type: runIdClearedCnt } },
        { type: 'coderabbit_run_id_first_seen', _count: { type: runIdFirstSeenCnt } },
        { type: 'failed', _count: { type: failedCnt } },
      ];

      const { prisma, event } = createMockPrismaClient({
        event: { groupBy: createResolvedMock(rows) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const result = await sut.countByType(since);

      expect(event.groupBy).toHaveBeenCalledWith({
        by: ['type'],
        where: { ts: { gte: since } },
        _count: { type: true },
      });
      expect(result).toStrictEqual({
        dismissed: dismissedCnt,
        coderabbit_review_approved: approvedCnt,
        coderabbit_review_changes_suggested: changesReqCnt,
        coderabbit_review_skipped: skippedCnt,
        coderabbit_run_id_changed: runIdChangedCnt,
        coderabbit_run_id_cleared: runIdClearedCnt,
        coderabbit_run_id_first_seen: runIdFirstSeenCnt,
        detected: detectedCnt,
        enqueued: enqueuedCnt,
        failed: failedCnt,
        retriggered: retriggeredCnt,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'EventRepositoryImpl.countByType',
          counts: {
            dismissed: dismissedCnt,
            coderabbit_review_approved: approvedCnt,
            coderabbit_review_changes_suggested: changesReqCnt,
            coderabbit_review_skipped: skippedCnt,
            coderabbit_run_id_changed: runIdChangedCnt,
            coderabbit_run_id_cleared: runIdClearedCnt,
            coderabbit_run_id_first_seen: runIdFirstSeenCnt,
            detected: detectedCnt,
            enqueued: enqueuedCnt,
            failed: failedCnt,
            retriggered: retriggeredCnt,
          },
        },
        'Counted events by type',
      );
    });

    it('excludes rows with undeclared event types', async () => {
      const since = getUniqueDate();
      const { detectedCnt, enqueuedCnt } = getUniqueIntsNamed(['detectedCnt', 'enqueuedCnt']);
      const unknownCnt = getUniqueInt();
      const rows = [
        { type: 'detected', _count: { type: detectedCnt } },
        { type: 'enqueued', _count: { type: enqueuedCnt } },
        { type: 'undeclared_type', _count: { type: unknownCnt } },
      ];
      const expectedCounts = {
        dismissed: 0,
        coderabbit_review_approved: 0,
        coderabbit_review_changes_suggested: 0,
        coderabbit_review_skipped: 0,
        coderabbit_run_id_changed: 0,
        coderabbit_run_id_cleared: 0,
        coderabbit_run_id_first_seen: 0,
        detected: detectedCnt,
        enqueued: enqueuedCnt,
        failed: 0,
        retriggered: 0,
      };

      const { prisma } = createMockPrismaClient({
        event: { groupBy: createResolvedMock(rows) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const result = await sut.countByType(since);

      expect(result).toStrictEqual(expectedCounts);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'EventRepositoryImpl.countByType', counts: expectedCounts }, 'Counted events by type');
    });
  });

  describe('container binding', () => {
    it('resolves EventRepository from the container', () => {
      const { prisma } = createMockPrismaClient();
      const logger = createMockLogger();
      const container = new Container();

      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<EventRepository>(TYPES.EventRepository).to(EventRepositoryImpl);

      const repo = container.get<EventRepository>(TYPES.EventRepository);
      expect(repo).toBeInstanceOf(EventRepositoryImpl);
    });
  });
});
