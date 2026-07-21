import { RabbitMaximizerError } from '../../src/errors/RabbitMaximizerError.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { SchedulerProbe } from '../../src/probes/SchedulerProbe.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateObservationContextHydrationData, generateQueueItemHydrationData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 3_600_000;

describe('SchedulerProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: ReturnType<typeof createMockLogger>;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = generateObservationContextHydrationData();
  });

  const createProbe = () => new SchedulerProbe(BASE_BACKOFF_MS, MAX_BACKOFF_MS, events, observation, logger);

  describe('pruningCompleted', () => {
    it('logs debug', () => {
      const probe = createProbe();
      probe.pruningCompleted();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'SchedulerProbe.pruningCompleted' }, 'Pruning completed');
    });
  });

  describe('schedulerPaused', () => {
    it('logs debug', () => {
      const probe = createProbe();
      probe.schedulerPaused();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'SchedulerProbe.schedulerPaused' }, 'Scheduler is paused; skipping tick');
    });
  });

  describe('tickSkippedAwaitingAcknowledgement', () => {
    it('logs info', () => {
      const probe = createProbe();
      probe.tickSkippedAwaitingAcknowledgement();
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.tickSkippedAwaitingAcknowledgement' },
        'Awaiting CodeRabbit acknowledgement; skipping tick',
      );
    });
  });

  describe('noItemsDue', () => {
    it('logs debug', () => {
      const probe = createProbe();
      probe.noItemsDue();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'SchedulerProbe.noItemsDue' }, 'No items due for retrigger');
    });
  });

  describe('withItem', () => {
    it('switches item context for subsequent probe calls', async () => {
      const firstRef = generateReviewRef();
      const firstItem = generateQueueItemHydrationData({ repo_full_name: firstRef.repoFullName, pr_number: firstRef.prNumber });
      const firstRescheduleEarliest = getUniqueDate();
      const secondRef = generateReviewRef();
      const secondItem = generateQueueItemHydrationData({ repo_full_name: secondRef.repoFullName, pr_number: secondRef.prNumber });
      const secondRescheduleEarliest = getUniqueDate();
      const probe = createProbe();

      probe.withItem(firstItem);
      const firstError = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'test',
        functionName: 'test',
        details: { rescheduleEarliest: firstRescheduleEarliest.toISOString(), sourceComment: { commentId: 1, commentUrl: 'https://gh/c/1' } },
      });
      await probe.triggerFailed(firstError, createMockTx());
      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: 'SchedulerProbe.rescheduled',
          repo: firstRef.repoFullName,
          pr: firstRef.prNumber,
          queueId: firstItem.id,
          rescheduleEarliest: firstRescheduleEarliest,
          error: firstError,
        },
        'Stale source comment replaced; rescheduled with updated time',
      );

      probe.withItem(secondItem);
      const secondError = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'test',
        functionName: 'test',
        details: { rescheduleEarliest: secondRescheduleEarliest.toISOString(), sourceComment: { commentId: 2, commentUrl: 'https://gh/c/2' } },
      });
      await probe.triggerFailed(secondError, createMockTx());
      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: 'SchedulerProbe.rescheduled',
          repo: secondRef.repoFullName,
          pr: secondRef.prNumber,
          queueId: secondItem.id,
          rescheduleEarliest: secondRescheduleEarliest,
          error: secondError,
        },
        'Stale source comment replaced; rescheduled with updated time',
      );
    });
  });

  describe('retriggered', () => {
    it('records event and logs info', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const retriggeredCommentUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.retriggered(retriggeredCommentUrl, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'retriggered',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { source_comment_url: item.source_comment_url, retriggered_comment_url: retriggeredCommentUrl },
        },
        tx,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.retriggered', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id },
        'Review retriggered',
      );
    });
  });

  describe('prClosedOrMerged', () => {
    it('records event and logs info', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const status = getUniqueInt();
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.prClosedOrMerged(status, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'failed',
          repo_full_name: ref.repoFullName,
          pr_number: ref.prNumber,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { reason: 'PR closed or merged' },
        },
        tx,
      );
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.prClosedOrMerged', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, status },
        'PR closed or merged; marked failed',
      );
    });
  });

  describe('backedOff', () => {
    it('logs warn without recording event', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const backoffMs = getUniqueInt();
      const attempts = getUniqueInt();
      const error = getUniqueString({ prefix: 'err-' });
      const tx = createMockTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.backedOff(backoffMs, attempts, error, tx);
      expect(events.record as jest.Mock<any>).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.backedOff', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, backoffMs, attempts, error },
        'Post retrigger failed; rescheduled with backoff',
      );
    });
  });

  describe('triggerFailed', () => {
    it('calls rescheduled on RETRIGGER_STALE_COMMENT_RESCHEDULE', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const rescheduleEarliest = getUniqueDate();
      const newComment = { commentId: getUniqueInt(), commentUrl: getUniqueString({ prefix: 'https://gh/c/' }) };
      const tx = createMockTx();
      const error = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'test',
        functionName: 'test',
        details: { rescheduleEarliest: rescheduleEarliest.toISOString(), sourceComment: newComment },
      });
      const probe = createProbe();
      probe.withItem(item);
      await probe.triggerFailed(error, tx);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.rescheduled', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, rescheduleEarliest, error },
        'Stale source comment replaced; rescheduled with updated time',
      );
    });

    it('backs off on non-RESCHEDULE error code', async () => {
      const ref = generateReviewRef();
      const item = generateQueueItemHydrationData({ repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const tx = createMockTx();
      const error = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_SKIP' as any,
        message: 'test',
        functionName: 'test',
      });
      const probe = createProbe();
      probe.withItem(item);
      await probe.triggerFailed(error, tx);
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.skipped', repo: ref.repoFullName, pr: ref.prNumber, queueId: item.id, backoffMs: BASE_BACKOFF_MS, error },
        `Stale source comment with no replacement; rescheduled with backoff (code: RETRIGGER_STALE_COMMENT_SKIP)`,
      );
    });
  });

  describe('tickFailed', () => {
    it('logs warn with error', () => {
      const error = getUniqueString({ prefix: 'err-' });
      const probe = createProbe();
      probe.tickFailed(error);
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'SchedulerProbe.tickFailed', error }, 'executeTick failed before item was fetched');
    });
  });
});
