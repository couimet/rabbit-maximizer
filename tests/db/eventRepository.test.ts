import { type EventRepository, EventRepositoryImpl, type NewEvent } from '../../src/db/eventRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import { EventType } from '../../src/types/index.js';
import { createMockPrismaClient, createResolvedMock } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueIntsNamed, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

describe('EventRepositoryImpl', () => {
  const EXPECTED_EVENT_COUNT = 2;

  describe('record', () => {
    it('inserts a detected event and returns the parsed entry', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
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
        repo_full_name: repo,
        pr_number: pr,
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
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        payload: { source_comment_url: sourceCommentUrl },
      };
      const result = await sut.record(input, prisma as unknown as Prisma.TransactionClient);

      expect(event.create).toHaveBeenCalledWith({
        data: {
          type: 'detected',
          repo_full_name: repo,
          pr_number: pr,
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
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: correlationId,
        request_id: requestId,
        version,
        metadata: undefined,
        payload: { source_comment_url: sourceCommentUrl },
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'EventRepositoryImpl.record', type: 'detected', repo, pr }, 'Event recorded');
    });

    it('writes through the transaction client and serializes metadata', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
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
        repo_full_name: repo,
        pr_number: pr,
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
          repo_full_name: repo,
          pr_number: pr,
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
          repo_full_name: repo,
          pr_number: pr,
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
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'EventRepositoryImpl.record', type: 'failed', repo, pr }, 'Event recorded');
    });
  });

  describe('listForPr', () => {
    it('returns events for a PR ordered by ts', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const detectedUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const scheduledFor = getUniqueDate();

      const detectedRow = {
        id: getUniqueInt(),
        uuid: getUuid(),
        ts: getUniqueDate(),
        type: 'detected',
        repo_full_name: repo,
        pr_number: pr,
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
        repo_full_name: repo,
        pr_number: pr,
        correlation_id: getUuid(),
        request_id: null,
        version: getUniqueString(),
        payload: JSON.stringify({
          not_before: scheduledFor.toISOString(),
          new_wait: 60,
        }),
        metadata: null,
      };

      const { prisma, event } = createMockPrismaClient({
        event: { findMany: createResolvedMock([detectedRow, enqueuedRow]) },
      });
      const logger = createMockLogger();
      const sut = new EventRepositoryImpl(prisma, logger);

      const result = await sut.listForPr(repo, pr);

      expect(event.findMany).toHaveBeenCalledWith({
        where: { repo_full_name: repo, pr_number: pr },
        orderBy: { ts: 'asc' },
      });
      expect(result).toStrictEqual([
        {
          id: detectedRow.id,
          uuid: detectedRow.uuid,
          ts: detectedRow.ts,
          repo_full_name: repo,
          pr_number: pr,
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
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: enqueuedRow.correlation_id,
          request_id: undefined,
          version: enqueuedRow.version,
          metadata: undefined,
          type: 'enqueued',
          payload: {
            not_before: scheduledFor,
            new_wait: 60,
          },
        },
      ]);
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'EventRepositoryImpl.listForPr',
          repo,
          pr,
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
      const repo = getUniqueGitHubRepoRef().fullName;
      const pr = getUniqueInt();
      const sourceCommentUrl = getUniqueString();
      const retriggeredCommentUrl = getUniqueString();
      const rows = [
        {
          id: getUniqueInt(),
          uuid: getUuid(),
          ts: getUniqueDate(),
          type: 'retriggered',
          repo_full_name: repo,
          pr_number: pr,
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
          repo_full_name: repo,
          pr_number: pr,
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
      const { detectedCnt, enqueuedCnt, retriggeredCnt, bypassedCnt, approvedCnt, changesReqCnt, skippedCnt, failedCnt } = getUniqueIntsNamed([
        'detectedCnt',
        'enqueuedCnt',
        'retriggeredCnt',
        'bypassedCnt',
        'approvedCnt',
        'changesReqCnt',
        'skippedCnt',
        'failedCnt',
      ]);
      const rows = [
        { type: 'detected', _count: { type: detectedCnt } },
        { type: 'enqueued', _count: { type: enqueuedCnt } },
        { type: 'retriggered', _count: { type: retriggeredCnt } },
        { type: 'bypassed', _count: { type: bypassedCnt } },
        { type: 'coderabbit_review_approved', _count: { type: approvedCnt } },
        { type: 'coderabbit_review_changes_requested', _count: { type: changesReqCnt } },
        { type: 'coderabbit_review_skipped', _count: { type: skippedCnt } },
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
        bypassed: bypassedCnt,
        coderabbit_review_approved: approvedCnt,
        coderabbit_review_changes_requested: changesReqCnt,
        coderabbit_review_skipped: skippedCnt,
        detected: detectedCnt,
        enqueued: enqueuedCnt,
        failed: failedCnt,
        retriggered: retriggeredCnt,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'EventRepositoryImpl.countByType',
          counts: {
            bypassed: bypassedCnt,
            coderabbit_review_approved: approvedCnt,
            coderabbit_review_changes_requested: changesReqCnt,
            coderabbit_review_skipped: skippedCnt,
            detected: detectedCnt,
            enqueued: enqueuedCnt,
            failed: failedCnt,
            retriggered: retriggeredCnt,
          },
        },
        'Counted events by type',
      );
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
