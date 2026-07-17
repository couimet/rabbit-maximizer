import { RabbitMaximizerError } from '../../src/errors/RabbitMaximizerError.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { SchedulerProbe } from '../../src/probes/SchedulerProbe.js';
import type { QueueItem } from '../../src/types/index.js';
import { createMockEventRepo, createMockObservationContext } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 3_600_000;

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;
const makeItem = (repo: string, pr: number): QueueItem =>
  ({
    id: getUniqueInt(),
    repo_full_name: repo,
    pr_number: pr,
    attempts: 0,
    source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  }) as unknown as QueueItem;

describe('SchedulerProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = createMockObservationContext();
  });

  const createProbe = () => new SchedulerProbe(BASE_BACKOFF_MS, MAX_BACKOFF_MS, events, observation, logger);

  describe('pruningCompleted', () => {
    it('logs debug', () => {
      const probe = createProbe();
      probe.pruningCompleted();
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'SchedulerProbe.pruningCompleted' }, 'Pruning completed');
    });
  });

  describe('schedulerPaused', () => {
    it('logs debug', () => {
      const probe = createProbe();
      probe.schedulerPaused();
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'SchedulerProbe.schedulerPaused' }, 'Scheduler is paused; skipping tick');
    });
  });

  describe('tickSkippedAwaitingAcknowledgement', () => {
    it('logs info', () => {
      const probe = createProbe();
      probe.tickSkippedAwaitingAcknowledgement();
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.tickSkippedAwaitingAcknowledgement' },
        'Awaiting CodeRabbit acknowledgement; skipping tick',
      );
    });
  });

  describe('noItemsDue', () => {
    it('logs debug', () => {
      const probe = createProbe();
      probe.noItemsDue();
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'SchedulerProbe.noItemsDue' }, 'No items due for retrigger');
    });
  });

  describe('withItem', () => {
    it('switches item context for subsequent probe calls', async () => {
      const { fullName: firstRepo } = getUniqueGitHubRepoRef();
      const firstPr = getUniqueInt();
      const firstItem = makeItem(firstRepo, firstPr);
      const firstNotBefore = getUniqueDate();
      const { fullName: secondRepo } = getUniqueGitHubRepoRef();
      const secondPr = getUniqueInt();
      const secondItem = makeItem(secondRepo, secondPr);
      const secondNotBefore = getUniqueDate();
      const probe = createProbe();

      probe.withItem(firstItem);
      const firstError = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'test',
        functionName: 'test',
        details: { notBefore: firstNotBefore.toISOString(), sourceComment: { commentId: 1, commentUrl: 'https://gh/c/1' } },
      });
      await probe.triggerFailed(firstError, makeTx());
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.rescheduled', repo: firstRepo, pr: firstPr, queueId: firstItem.id, newNotBefore: firstNotBefore, error: firstError },
        'Stale source comment replaced; rescheduled with updated not_before',
      );

      probe.withItem(secondItem);
      const secondError = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'test',
        functionName: 'test',
        details: { notBefore: secondNotBefore.toISOString(), sourceComment: { commentId: 2, commentUrl: 'https://gh/c/2' } },
      });
      await probe.triggerFailed(secondError, makeTx());
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.rescheduled', repo: secondRepo, pr: secondPr, queueId: secondItem.id, newNotBefore: secondNotBefore, error: secondError },
        'Stale source comment replaced; rescheduled with updated not_before',
      );
    });
  });

  describe('retriggered', () => {
    it('records event and logs info', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const retriggeredCommentUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      const tx = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.retriggered(retriggeredCommentUrl, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'retriggered',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { source_comment_url: item.source_comment_url, retriggered_comment_url: retriggeredCommentUrl },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'SchedulerProbe.retriggered', repo, pr, queueId: item.id }, 'Review retriggered');
    });
  });

  describe('prClosedOrMerged', () => {
    it('records event and logs info', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const STATUS = getUniqueInt();
      const tx = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.prClosedOrMerged(STATUS, tx);
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'failed',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { reason: 'PR closed or merged' },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.prClosedOrMerged', repo, pr, queueId: item.id, status: STATUS },
        'PR closed or merged; marked failed',
      );
    });
  });

  describe('backedOff', () => {
    it('logs warn without recording event', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const BACKOFF_MS = getUniqueInt();
      const ATTEMPTS = getUniqueInt();
      const ERROR = getUniqueString({ prefix: 'err-' });
      const TX = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      await probe.backedOff(BACKOFF_MS, ATTEMPTS, ERROR, TX);
      expect(events.record as jest.Mock<any>).not.toHaveBeenCalled();
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.backedOff', repo, pr, queueId: item.id, backoffMs: BACKOFF_MS, attempts: ATTEMPTS, error: ERROR },
        'Post retrigger failed; rescheduled with backoff',
      );
    });
  });

  describe('triggerFailed', () => {
    it('calls rescheduled on RETRIGGER_STALE_COMMENT_RESCHEDULE', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const NOT_BEFORE = getUniqueDate();
      const NEW_COMMENT = { commentId: getUniqueInt(), commentUrl: getUniqueString({ prefix: 'https://gh/c/' }) };
      const tx = makeTx();
      const error = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'test',
        functionName: 'test',
        details: { notBefore: NOT_BEFORE.toISOString(), sourceComment: NEW_COMMENT },
      });
      const probe = createProbe();
      probe.withItem(item);
      await probe.triggerFailed(error, tx);
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.rescheduled', repo, pr, queueId: item.id, newNotBefore: NOT_BEFORE, error },
        'Stale source comment replaced; rescheduled with updated not_before',
      );
    });

    it('backs off on non-RESCHEDULE error code', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tx = makeTx();
      const error = new RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_SKIP' as any,
        message: 'test',
        functionName: 'test',
      });
      const probe = createProbe();
      probe.withItem(item);
      await probe.triggerFailed(error, tx);
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.skipped', repo, pr, queueId: item.id, backoffMs: BASE_BACKOFF_MS, error },
        `Stale source comment with no replacement; rescheduled with backoff (code: RETRIGGER_STALE_COMMENT_SKIP)`,
      );
    });
  });

  describe('tickFailed', () => {
    it('logs warn with error', () => {
      const ERROR = getUniqueString({ prefix: 'err-' });
      const probe = createProbe();
      probe.tickFailed(ERROR);
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'SchedulerProbe.tickFailed', error: ERROR },
        'executeTick failed before item was fetched',
      );
    });
  });
});
