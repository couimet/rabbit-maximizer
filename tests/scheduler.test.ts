import type { Config } from '../src/config.js';
import type { QueueOrderRepository, QueueRepository } from '../src/db/index.js';
import { QueueStatus, RabbitResult } from '../src/domain.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../src/errors/index.js';
import type { ProbeFactory } from '../src/probes/index.js';
import { type Pruner, ReviewTrigger, Scheduler } from '../src/services.js';
import type { PRState } from '../src/types/index.js';

import {
  createMockProbeFactory,
  createMockPRStateFetcher,
  createMockPruner,
  createMockPullRequestRepo,
  createMockQueueOrderRepo,
  createMockQueueRepo,
  createMockSchedulerProbe,
  createMockSystemStateRepository,
  drainMicrotasks,
  generateQueueItemHydrationData,
  generateReviewRef,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const pendingItem = (overrides?: Parameters<typeof generateQueueItemHydrationData>[0]) =>
  generateQueueItemHydrationData({ status: QueueStatus.pending, ...overrides });

const TICK_INTERVAL_MS = 10_000;
const SHORT_DRAIN = 5;
const BASE_BACKOFF_MS = 60_000;

interface MockSchedulerDeps {
  config: Config;
  queueOrder: jest.Mocked<QueueOrderRepository>;
  queue: jest.Mocked<QueueRepository>;
  prisma: PrismaClient;
  tx: Prisma.TransactionClient;
  logger: Logger;
  pruner: jest.Mocked<Pruner>;
  probeFactory: jest.Mocked<ProbeFactory>;
  mockProbe: ReturnType<typeof createMockSchedulerProbe>;
  reviewTrigger: jest.Mocked<ReviewTrigger>;
  systemState: ReturnType<typeof createMockSystemStateRepository>;
  pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  prStateFetcher: ReturnType<typeof createMockPRStateFetcher>;
}

const setup = (): MockSchedulerDeps => {
  const queueOrder = createMockQueueOrderRepo();
  const queue = createMockQueueRepo();
  const reviewTrigger = { trigger: jest.fn() } as unknown as jest.Mocked<ReviewTrigger>;

  const tx = { reviewQueue: { update: jest.fn() } } as unknown as Prisma.TransactionClient;

  const prisma = {
    $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)),
  } as unknown as PrismaClient;

  const logger = createMockLogger();

  const pruner = createMockPruner();

  const mockProbe = createMockSchedulerProbe();
  const probeFactory = createMockProbeFactory({ createSchedulerProbe: jest.fn<any>().mockReturnValue(mockProbe) });

  const systemState = createMockSystemStateRepository();

  const pullRequests = createMockPullRequestRepo();

  const prStateFetcher = createMockPRStateFetcher();

  const config: Config = {
    CODERABBIT_ACCOUNT_COOLDOWN_SEC: 3600,
    DETECTION_MODE: 'poll',
    GITHUB_API_TIMEOUT_SEC: 10,
    GITHUB_PAT: 'test-pat',
    MAX_RETRIGGER_ATTEMPTS: 10,
    PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: 1800,
    PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: 900,
    POLL_INTERVAL_SEC: 90,
    PR_SCANNER_INTERVAL_SEC: 300,
    REPO_FILTER: [{ pattern: 'test-owner/*', scope: 'user' }],
    REVIEW_DETECTION_LOOKBACK_SEC: 7200,
    DATABASE_URL: 'file:./data/test.db',
    WEB_PORT: 3000,
    SCHEDULER_RETRIGGER_SPACING_SEC: 180,
    SCHEDULER_RETRY_BACKOFF_BASE_SEC: 60,
    SCHEDULER_RETRY_BACKOFF_MAX_SEC: 3600,
    SCHEDULER_STALE_TICK_MULTIPLIER: 4,
    REVIEW_LIMIT_BUFFER_SEC: 60,
    REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600,
    SCHEDULER_MAX_RETRIGGER_AGE_SEC: 259200,
    SCHEDULER_TICK_INTERVAL_SEC: TICK_INTERVAL_MS / 1000,
  };

  return { config, queueOrder, queue, prisma, tx, logger, pruner, reviewTrigger, probeFactory, mockProbe, systemState, pullRequests, prStateFetcher };
};

describe('Scheduler', () => {
  let deps: MockSchedulerDeps;
  let frozenNow: Date;

  beforeEach(() => {
    frozenNow = getUniqueDate();
    deps = setup();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  const createScheduler = () =>
    new Scheduler(
      deps.queueOrder,
      deps.prisma,
      deps.config,
      deps.pruner,
      deps.reviewTrigger,
      deps.queue,
      deps.probeFactory,
      deps.pullRequests,
      deps.systemState,
      deps.prStateFetcher,
      deps.logger,
    );

  const awaitTick = (scheduler: Scheduler) => scheduler['tickPromise'];

  describe('tick', () => {
    const makeTriggerOk = () => RabbitResult.ok({ retriggeredCommentUrl: getUniqueString() });

    it('delegates to ReviewTrigger on success and increments attempts', async () => {
      const item = pendingItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.reviewTrigger.trigger).toHaveBeenCalledWith(item, 'scheduler' as any);
      expect(deps.queue.incrementAttempts).toHaveBeenCalledWith(item.id, 1, deps.tx);
      expect(deps.systemState.setLastSchedulerTickAt).toHaveBeenCalledWith(expect.any(Date));

      await stop();
    });

    it('resolves item when successful retriggers reach MAX_RETRIGGER_ATTEMPTS', async () => {
      const item = pendingItem({ attempts: 9 });
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'failed', expect.any(Object));
      expect(deps.mockProbe.maxRetriggersExceeded).toHaveBeenCalledWith(10, expect.any(Object));
      expect(deps.tx.reviewQueue.update).not.toHaveBeenCalled();

      await stop();
    });

    it('reschedules when ReviewTrigger returns stale reschedule', async () => {
      const item = pendingItem();
      const newComment = { commentId: getUniqueInt(), commentUrl: getUniqueString() };
      const rescheduleEarliest = new Date(frozenNow.getTime() + 60_000).toISOString();
      const staleErr = new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_RESCHEDULE,
        message: 'stale',
        functionName: 'test',
        details: { rescheduleEarliest, sourceComment: newComment },
      });
      const triggerResult = RabbitResult.err(staleErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.reschedule).toHaveBeenCalledWith(item.id, newComment, deps.tx);

      await stop();
    });

    it('resolves as stale comment when ReviewTrigger returns stale skip', async () => {
      const item = pendingItem();
      const staleErr = new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_SKIP,
        message: 'gone',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(staleErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'stale_comment', deps.tx);
      expect(deps.queue.backoff).not.toHaveBeenCalled();

      await stop();
    });

    it('backs off when ReviewTrigger returns stale replacement deleted', async () => {
      const item = pendingItem();
      const staleErr = new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED,
        message: 'gone',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(staleErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('logs warning and skips when ReviewTrigger returns RETRIGGER_ITEM_NOT_PENDING', async () => {
      const item = pendingItem();
      const notPendingErr = new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.RETRIGGER_ITEM_NOT_PENDING,
        message: 'Item is not in pending status',
        functionName: 'ReviewTrigger.trigger',
        details: { status: 'retriggered' },
      });
      const triggerResult = RabbitResult.err(notPendingErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'Scheduler.executeTick', queueId: item.id, error: notPendingErr },
        'Item not pending at trigger time; skipping',
      );
      expect(deps.queue.markResolved).not.toHaveBeenCalled();
      expect(deps.queue.backoff).not.toHaveBeenCalled();
      expect(deps.mockProbe.triggerFailed).not.toHaveBeenCalled();

      await stop();
    });

    it('backs off on unexpected error code from ReviewTrigger', async () => {
      const item = pendingItem();
      const unexpectedErr = new RabbitMaximizerError({
        code: 'UNKNOWN_CODE' as any,
        message: 'unexpected',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(unexpectedErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('marks failed and records failed event on HTTP 404 from trigger', async () => {
      const item = pendingItem();
      const notFoundError = { status: 404 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(notFoundError);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.prDeleted).toHaveBeenCalledWith(404, deps.tx);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'failed', deps.tx);

      await stop();
    });

    it('marks failed on HTTP 410 from trigger', async () => {
      const item = pendingItem();
      const goneError = { status: 410 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(goneError);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.prDeleted).toHaveBeenCalledWith(410, deps.tx);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'failed', deps.tx);

      await stop();
    });

    it('backs off on unknown error from trigger', async () => {
      const item = pendingItem();
      const networkError = new Error('Network timeout');
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(networkError);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.prDeleted).not.toHaveBeenCalled();
      expect(deps.mockProbe.backedOff).toHaveBeenCalledWith(BASE_BACKOFF_MS, 0, networkError, deps.tx);

      await stop();
    });

    it('returns early when no items are due', async () => {
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([]);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.reviewTrigger.trigger).not.toHaveBeenCalled();

      await stop();
    });

    it('skips processing when scheduler is paused', async () => {
      const item = generateQueueItemHydrationData();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(true);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.schedulerPaused).toHaveBeenCalled();
      expect(deps.queueOrder.getEffectiveOrder).not.toHaveBeenCalled();
      expect(deps.systemState.setLastSchedulerTickAt).toHaveBeenCalledWith(expect.any(Date));

      await stop();
    });

    it('skips processing when next_review_available_at is in the future', async () => {
      const item = generateQueueItemHydrationData();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.getNextReviewAvailableAt.mockResolvedValue(new Date(Date.now() + TICK_INTERVAL_MS));

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.tickSkippedCooldown).toHaveBeenCalled();
      expect(deps.queueOrder.getEffectiveOrder).not.toHaveBeenCalled();
      expect(deps.systemState.setLastSchedulerTickAt).toHaveBeenCalledWith(expect.any(Date));

      await stop();
    });

    it('prunes before checking pause state', async () => {
      deps.systemState.isSchedulerPaused.mockResolvedValue(true);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.pruner.prune).toHaveBeenCalled();
      expect(deps.systemState.isSchedulerPaused).toHaveBeenCalled();

      await stop();
    });

    it('resolves stale retriggered items and notifies probe', async () => {
      deps.systemState.isSchedulerPaused.mockResolvedValue(true);
      deps.queue.resolveStaleRetriggered.mockResolvedValue(3);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.resolveStaleRetriggered).toHaveBeenCalledWith(deps.config.SCHEDULER_MAX_RETRIGGER_AGE_SEC * 1000, deps.tx);
      expect(deps.mockProbe.staleRetriggeredResolved).toHaveBeenCalledWith(3);

      await stop();
    });

    it('skips the tick when a PR is awaiting acknowledgement within the spacing window', async () => {
      const ackRef = generateReviewRef();
      const ackId = getUniqueInt();
      const pendingAck = {
        id: ackId,
        repo_full_name: ackRef.repoFullName,
        pr_number: ackRef.prNumber,
        last_review_requested_at: new Date(frozenNow.getTime() - 30_000),
      };
      deps.pullRequests.findPendingAcknowledgement.mockResolvedValue(pendingAck);
      const scheduler = createScheduler();
      const { stop } = await scheduler.start();
      await awaitTick(scheduler);
      expect(deps.mockProbe.tickSkippedAwaitingAcknowledgement).toHaveBeenCalled();
      expect(deps.queueOrder.getEffectiveOrder).not.toHaveBeenCalled();
      await stop();
    });

    it('proceeds normally when schedulerStatus is running', async () => {
      const item = pendingItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(false);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.reviewTrigger.trigger).toHaveBeenCalled();

      await stop();
    });

    it('logs error when heartbeat persistence fails', async () => {
      const item = pendingItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());
      const heartbeatError = new Error('DB write failed');
      deps.systemState.setLastSchedulerTickAt.mockRejectedValue(heartbeatError);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.error).toHaveBeenCalledWith({ fn: 'Scheduler.executeTick', error: heartbeatError }, 'Failed to persist scheduler heartbeat');

      await stop();
    });

    it('logs warning when getEffectiveOrder rejects', async () => {
      const dbError = new Error('DB connection lost');
      deps.queueOrder.getEffectiveOrder.mockRejectedValue(dbError);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.tickFailed).toHaveBeenCalledWith(dbError);

      await stop();
    });

    it('logs warning when getEffectiveOrder rejects a non-Error', async () => {
      deps.queueOrder.getEffectiveOrder.mockRejectedValue('raw string failure');

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.tickFailed).toHaveBeenCalledWith('raw string failure');

      await stop();
    });

    it('logs start and stop messages', async () => {
      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.start', tickIntervalMs: TICK_INTERVAL_MS }, 'Starting scheduler');

      await stop();
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
    });

    it('does not throw when stop is called multiple times', async () => {
      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await stop();
      await stop();

      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
    });

    it('marks failed when attempts >= MAX_RETRIGGER_ATTEMPTS on trigger failure', async () => {
      const item = pendingItem({ attempts: 10 });
      const otherErr = new RabbitMaximizerError({
        code: 'SOME_OTHER_ERROR' as any,
        message: 'gone',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(otherErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'failed', deps.tx);
      expect(deps.queue.backoff).not.toHaveBeenCalled();
      expect(deps.mockProbe.maxRetriggersExceeded).toHaveBeenCalledWith(item.attempts, deps.tx);
      expect(deps.mockProbe.triggerFailed).not.toHaveBeenCalled();

      await stop();
    });

    it('marks failed when attempts >= MAX_RETRIGGER_ATTEMPTS on unexpected exception', async () => {
      const item = pendingItem({ attempts: 10 });
      const networkError = new Error('Network timeout');
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(networkError);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'failed', deps.tx);
      expect(deps.queue.backoff).not.toHaveBeenCalled();
      expect(deps.mockProbe.maxRetriggersExceeded).toHaveBeenCalledWith(item.attempts, deps.tx);
      expect(deps.mockProbe.backedOff).not.toHaveBeenCalled();

      await stop();
    });

    it('backs off normally when attempts is under the ceiling', async () => {
      const item = pendingItem({ attempts: 2 });
      const otherErr = new RabbitMaximizerError({
        code: 'SOME_OTHER_ERROR' as any,
        message: 'gone',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(otherErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = await scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, deps.tx);
      expect(deps.queue.markResolved).not.toHaveBeenCalled();
      expect(deps.mockProbe.maxRetriggersExceeded).not.toHaveBeenCalled();

      await stop();
    });

    describe('PR state scan loop', () => {
      it('selects the first open PR and skips merged PRs', async () => {
        const mergedItem = pendingItem();
        const openItem = pendingItem();
        deps.prStateFetcher.fetch.mockReset();
        deps.prStateFetcher.fetch
          .mockResolvedValueOnce({ state: 'closed', merged_at: '2024-01-01', closed_at: null } satisfies PRState)
          .mockResolvedValueOnce({ state: 'open', merged_at: null, closed_at: null } satisfies PRState);
        deps.queueOrder.getEffectiveOrder.mockResolvedValue([mergedItem, openItem]);
        deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

        const scheduler = createScheduler();
        const { stop } = await scheduler.start();

        await awaitTick(scheduler);

        expect(deps.prStateFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(deps.queue.markResolved).toHaveBeenCalledWith(mergedItem.id, 'pr_merged', deps.tx);
        expect(deps.mockProbe.prClosedDuringScan).toHaveBeenCalledWith(mergedItem.repo_full_name, mergedItem.pr_number, 'merged', deps.tx);
        expect(deps.reviewTrigger.trigger).toHaveBeenCalledWith(openItem, 'scheduler' as any);

        await stop();
      });

      it('skips items whose PR state fetch fails', async () => {
        const failedItem = pendingItem();
        const openItem = pendingItem();
        deps.prStateFetcher.fetch.mockReset();
        deps.prStateFetcher.fetch.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ state: 'open', merged_at: null, closed_at: null } satisfies PRState);
        deps.queueOrder.getEffectiveOrder.mockResolvedValue([failedItem, openItem]);
        deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

        const scheduler = createScheduler();
        const { stop } = await scheduler.start();

        await awaitTick(scheduler);

        expect(deps.prStateFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(deps.queue.markResolved).not.toHaveBeenCalled();
        expect(deps.reviewTrigger.trigger).toHaveBeenCalledWith(openItem, 'scheduler' as any);

        await stop();
      });

      it('resolves closed-without-merge PR and continues to next item', async () => {
        const closedItem = pendingItem();
        const openItem = pendingItem();
        deps.prStateFetcher.fetch.mockReset();
        deps.prStateFetcher.fetch
          .mockResolvedValueOnce({ state: 'closed', merged_at: null, closed_at: null } satisfies PRState)
          .mockResolvedValueOnce({ state: 'open', merged_at: null, closed_at: null } satisfies PRState);
        deps.queueOrder.getEffectiveOrder.mockResolvedValue([closedItem, openItem]);
        deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

        const scheduler = createScheduler();
        const { stop } = await scheduler.start();

        await awaitTick(scheduler);

        expect(deps.prStateFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(deps.queue.markResolved).toHaveBeenCalledWith(closedItem.id, 'pr_closed_without_merge', deps.tx);
        expect(deps.mockProbe.prClosedDuringScan).toHaveBeenCalledWith(closedItem.repo_full_name, closedItem.pr_number, 'closed', deps.tx);
        expect(deps.reviewTrigger.trigger).toHaveBeenCalledWith(openItem, 'scheduler' as any);

        await stop();
      });

      it('calls noItemsDue when all candidates are merged or closed', async () => {
        const mergedItem = pendingItem();
        const closedItem = pendingItem();
        deps.prStateFetcher.fetch.mockReset();
        deps.prStateFetcher.fetch
          .mockResolvedValueOnce({ state: 'closed', merged_at: '2024-01-01', closed_at: null } satisfies PRState)
          .mockResolvedValueOnce({ state: 'closed', merged_at: null, closed_at: null } satisfies PRState);
        deps.queueOrder.getEffectiveOrder.mockResolvedValue([mergedItem, closedItem]);

        const scheduler = createScheduler();
        const { stop } = await scheduler.start();

        await awaitTick(scheduler);

        expect(deps.prStateFetcher.fetch).toHaveBeenCalledTimes(2);
        expect(deps.queue.markResolved).toHaveBeenCalledWith(mergedItem.id, 'pr_merged', deps.tx);
        expect(deps.queue.markResolved).toHaveBeenCalledWith(closedItem.id, 'pr_closed_without_merge', deps.tx);
        expect(deps.reviewTrigger.trigger).not.toHaveBeenCalled();
        expect(deps.mockProbe.noItemsDue).toHaveBeenCalled();

        await stop();
      });

      it('resolves without unnecessary transaction when single item is merged', async () => {
        const mergedItem = pendingItem();
        deps.prStateFetcher.fetch.mockReset();
        deps.prStateFetcher.fetch.mockResolvedValue({ state: 'closed', merged_at: '2024-01-01', closed_at: null } satisfies PRState);
        deps.queueOrder.getEffectiveOrder.mockResolvedValue([mergedItem]);

        const scheduler = createScheduler();
        const { stop } = await scheduler.start();

        await awaitTick(scheduler);

        expect(deps.prStateFetcher.fetch).toHaveBeenCalledTimes(1);
        expect(deps.queue.markResolved).toHaveBeenCalledWith(mergedItem.id, 'pr_merged', deps.tx);
        expect(deps.reviewTrigger.trigger).not.toHaveBeenCalled();

        await stop();
      });
    });
  });
});
