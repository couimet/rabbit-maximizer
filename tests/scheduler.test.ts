import type { Config } from '../src/config.js';
import type { QueueOrderRepository, QueueRepository } from '../src/db/index.js';
import { RabbitResult } from '../src/domain.js';
import type { ProbeFactory } from '../src/probes/index.js';
import { type Pruner, ReviewTrigger, Scheduler } from '../src/services.js';

import {
  createMockProbeFactory,
  createMockPruner,
  createMockPullRequestRepo,
  createMockQueueOrderRepo,
  createMockQueueRepo,
  createMockSchedulerProbe,
  createMockSystemStateRepository,
  drainMicrotasks,
  generateQueueItemHydrationData,
} from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

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
}

const setup = (): MockSchedulerDeps => {
  const queueOrder = createMockQueueOrderRepo();
  const queue = createMockQueueRepo();
  const reviewTrigger = { trigger: jest.fn() } as unknown as jest.Mocked<ReviewTrigger>;

  const tx = {} as Prisma.TransactionClient;

  const prisma = {
    $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)),
  } as unknown as PrismaClient;

  const logger = createMockLogger();

  const pruner = createMockPruner();

  const mockProbe = createMockSchedulerProbe();
  const probeFactory = createMockProbeFactory({ createSchedulerProbe: jest.fn<any>().mockReturnValue(mockProbe) });

  const systemState = createMockSystemStateRepository();

  const pullRequests = createMockPullRequestRepo();

  const config: Config = {
    DETECTION_MODE: 'poll',
    GITHUB_API_TIMEOUT_SEC: 10,
    GITHUB_PAT: 'test-pat',
    PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: 1800,
    PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: 900,
    POLL_INTERVAL_SEC: 90,
    PR_SCANNER_INTERVAL_SEC: 300,
    REPO_FILTER: [{ pattern: 'test-owner/*', scope: 'user' }],
    DATABASE_URL: 'file:./data/test.db',
    WEB_PORT: 3000,
    SCHEDULER_POST_COOLDOWN_SEC: 3600,
    SCHEDULER_RETRIGGER_SPACING_SEC: 180,
    SCHEDULER_RETRY_BACKOFF_BASE_SEC: 60,
    SCHEDULER_RETRY_BACKOFF_MAX_SEC: 3600,
    SCHEDULER_STALE_TICK_MULTIPLIER: 4,
    REVIEW_LIMIT_BUFFER_SEC: 60,
    REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600,
    SCHEDULER_TICK_INTERVAL_SEC: TICK_INTERVAL_MS / 1000,
  };

  return { config, queueOrder, queue, prisma, tx, logger, pruner, reviewTrigger, probeFactory, mockProbe, systemState, pullRequests };
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
      deps.logger,
    );

  const awaitTick = (scheduler: Scheduler) => scheduler['tickPromise'];

  describe('tick', () => {
    const makeTriggerOk = () => RabbitResult.ok({ retriggeredCommentUrl: getUniqueString() });

    it('delegates to ReviewTrigger on success', async () => {
      const item = generateQueueItemHydrationData();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.reviewTrigger.trigger).toHaveBeenCalledWith(item, 'scheduler' as any);
      expect(deps.systemState.setLastSchedulerTickAt).toHaveBeenCalledWith(expect.any(Date));

      await stop();
    });

    it('reschedules when ReviewTrigger returns stale reschedule', async () => {
      const item = generateQueueItemHydrationData();
      const newComment = { commentId: getUniqueInt(), commentUrl: getUniqueString() };
      const staleErr = new (await import('../src/errors/RabbitMaximizerError.js')).RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_RESCHEDULE' as any,
        message: 'stale',
        functionName: 'test',
        details: { rescheduleEarliest: new Date(frozenNow.getTime() + 60_000).toISOString(), sourceComment: newComment },
      });
      const triggerResult = RabbitResult.err(staleErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.reschedule).toHaveBeenCalledWith(item.id, newComment, deps.tx);

      await stop();
    });

    it('backs off when ReviewTrigger returns stale skip', async () => {
      const item = generateQueueItemHydrationData();
      const staleErr = new (await import('../src/errors/RabbitMaximizerError.js')).RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_SKIP' as any,
        message: 'gone',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(staleErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('backs off when ReviewTrigger returns stale replacement deleted', async () => {
      const item = generateQueueItemHydrationData();
      const staleErr = new (await import('../src/errors/RabbitMaximizerError.js')).RabbitMaximizerError({
        code: 'RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED' as any,
        message: 'gone',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(staleErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('backs off on unexpected error code from ReviewTrigger', async () => {
      const item = generateQueueItemHydrationData();
      const unexpectedErr = new (await import('../src/errors/RabbitMaximizerError.js')).RabbitMaximizerError({
        code: 'UNKNOWN_CODE' as any,
        message: 'unexpected',
        functionName: 'test',
      });
      const triggerResult = RabbitResult.err(unexpectedErr);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(triggerResult);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.triggerFailed).toHaveBeenCalledWith(triggerResult.error, deps.tx);
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('marks failed and records failed event on HTTP 404 from trigger', async () => {
      const item = generateQueueItemHydrationData();
      const notFoundError = { status: 404 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(notFoundError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.prClosedOrMerged).toHaveBeenCalledWith(404, deps.tx);
      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('marks failed on HTTP 410 from trigger', async () => {
      const item = generateQueueItemHydrationData();
      const goneError = { status: 410 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(goneError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.prClosedOrMerged).toHaveBeenCalledWith(410, deps.tx);
      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);

      await stop();
    });

    it('backs off on unknown error from trigger', async () => {
      const item = generateQueueItemHydrationData();
      const networkError = new Error('Network timeout');
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockRejectedValue(networkError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.prClosedOrMerged).not.toHaveBeenCalled();
      expect(deps.mockProbe.backedOff).toHaveBeenCalledWith(BASE_BACKOFF_MS, 0, networkError, deps.tx);

      await stop();
    });

    it('returns early when no items are due', async () => {
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([]);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.reviewTrigger.trigger).not.toHaveBeenCalled();

      await stop();
    });

    it('skips processing when scheduler is paused', async () => {
      const item = generateQueueItemHydrationData();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(true);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.schedulerPaused).toHaveBeenCalled();
      expect(deps.queueOrder.getEffectiveOrder).not.toHaveBeenCalled();
      expect(deps.systemState.setLastSchedulerTickAt).toHaveBeenCalledWith(expect.any(Date));

      await stop();
    });

    it('prunes before checking pause state', async () => {
      deps.systemState.isSchedulerPaused.mockResolvedValue(true);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.pruner.prune).toHaveBeenCalled();
      expect(deps.systemState.isSchedulerPaused).toHaveBeenCalled();

      await stop();
    });

    it('skips the tick when a PR is awaiting acknowledgement within the spacing window', async () => {
      const ackId = getUniqueInt();
      const ackRepo = getUniqueGitHubRepoRef().fullName;
      const ackPr = getUniqueInt();
      const pendingAck = { id: ackId, repo_full_name: ackRepo, pr_number: ackPr, last_review_requested_at: new Date(frozenNow.getTime() - 30_000) };
      deps.pullRequests.findPendingAcknowledgement.mockResolvedValue(pendingAck);
      const scheduler = createScheduler();
      const { stop } = scheduler.start();
      await awaitTick(scheduler);
      expect(deps.mockProbe.tickSkippedAwaitingAcknowledgement).toHaveBeenCalled();
      expect(deps.queueOrder.getEffectiveOrder).not.toHaveBeenCalled();
      await stop();
    });

    it('proceeds normally when schedulerStatus is running', async () => {
      const item = generateQueueItemHydrationData();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(false);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.reviewTrigger.trigger).toHaveBeenCalled();

      await stop();
    });

    it('logs error when heartbeat persistence fails', async () => {
      const item = generateQueueItemHydrationData();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.reviewTrigger.trigger.mockResolvedValue(makeTriggerOk());
      const heartbeatError = new Error('DB write failed');
      deps.systemState.setLastSchedulerTickAt.mockRejectedValue(heartbeatError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.error).toHaveBeenCalledWith({ fn: 'Scheduler.executeTick', error: heartbeatError }, 'Failed to persist scheduler heartbeat');

      await stop();
    });

    it('logs warning when getEffectiveOrder rejects', async () => {
      const dbError = new Error('DB connection lost');
      deps.queueOrder.getEffectiveOrder.mockRejectedValue(dbError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.tickFailed).toHaveBeenCalledWith(dbError);

      await stop();
    });

    it('logs warning when getEffectiveOrder rejects a non-Error', async () => {
      deps.queueOrder.getEffectiveOrder.mockRejectedValue('raw string failure');

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.mockProbe.tickFailed).toHaveBeenCalledWith('raw string failure');

      await stop();
    });

    it('logs start and stop messages', async () => {
      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.start', tickIntervalMs: TICK_INTERVAL_MS }, 'Starting scheduler');

      await stop();
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
    });

    it('does not throw when stop is called multiple times', async () => {
      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await stop();
      await stop();

      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
    });
  });
});
