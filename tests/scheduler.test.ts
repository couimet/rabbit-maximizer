import type { Config } from '../src/config.js';
import type { EventRepository, NewEvent } from '../src/db/eventRepository.js';
import type { QueueOrderRepository } from '../src/db/queueOrderRepository.js';
import type { QueueRepository } from '../src/db/queueRepository.js';
import type { SystemStateRepository } from '../src/db/systemStateRepository.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { Pruner } from '../src/Pruner.js';
import { Scheduler } from '../src/scheduler.js';
import type { SourceCommentValidator } from '../src/SourceCommentValidator.js';
import { TriggerSource } from '../src/types/index.js';
import { QueueStatus } from '../src/types/QueueStatus.js';

import {
  createMockCoderabbitGitHubClient,
  createMockEventRepo,
  createMockObservationContextProvider,
  createMockPruner,
  createMockQueueOrderRepo,
  createMockQueueRepo,
  createMockSourceCommentValidator,
  createMockSystemStateRepository,
  drainMicrotasks,
  makeUniqueRepoName,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const TICK_INTERVAL_MS = 10_000;
const SHORT_DRAIN = 5;
const SINGLE_TICK = 1;
const BASE_BACKOFF_MS = 60_000;
const BACKOFF_TOLERANCE_MS = 5_000;
const POST_COOLDOWN_MS = 3_600_000;

interface QueueItemStub {
  id: number;
  uuid: string;
  repo_full_name: string;
  pr_number: number;
  status: QueueStatus;
  not_before: Date;
  attempts: number;
  source_comment_url: string;
  source_comment_id: number;
  trigger_source: TriggerSource;
  created_at: Date;
  updated_at: Date;
}

interface MockSchedulerDeps {
  config: Config;
  queue: jest.Mocked<QueueRepository>;
  queueOrder: jest.Mocked<QueueOrderRepository>;
  github: jest.Mocked<CoderabbitGitHubClient>;
  events: jest.Mocked<EventRepository>;
  observation: jest.Mocked<ObservationContextProvider>;
  prisma: PrismaClient;
  tx: Prisma.TransactionClient;
  logger: Logger;
  pruner: jest.Mocked<Pruner>;
  commentValidator: jest.Mocked<SourceCommentValidator>;
  systemState: jest.Mocked<SystemStateRepository>;
}

const makeItem = (over: Partial<QueueItemStub> = {}): QueueItemStub => {
  const commentId = getUniqueInt();
  return {
    id: over.id ?? getUniqueInt(),
    uuid: over.uuid ?? getUniqueString({ prefix: 'uuid-' }),
    repo_full_name: over.repo_full_name ?? makeUniqueRepoName().fullName,
    pr_number: over.pr_number ?? getUniqueInt(),
    status: over.status ?? QueueStatus.pending,
    not_before: over.not_before ?? new Date(Date.now() - 60_000),
    attempts: over.attempts ?? 0,
    source_comment_url: over.source_comment_url ?? `https://github.com/test-owner/test-repo/pull/${getUniqueInt()}#issuecomment-${commentId}`,
    source_comment_id: over.source_comment_id ?? commentId,
    trigger_source: over.trigger_source ?? TriggerSource.scheduler,
    created_at: over.created_at ?? getUniqueDate(),
    updated_at: over.updated_at ?? getUniqueDate(),
  };
};

const setup = (): MockSchedulerDeps => {
  const queue = createMockQueueRepo();
  const queueOrder = createMockQueueOrderRepo();
  const github = createMockCoderabbitGitHubClient();
  const commentValidator = createMockSourceCommentValidator();
  const events = createMockEventRepo() as unknown as MockSchedulerDeps['events'];

  const observation = createMockObservationContextProvider();

  const tx = {} as Prisma.TransactionClient;

  const prisma = {
    $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)),
  } as unknown as PrismaClient;

  const logger = createMockLogger();

  const pruner = createMockPruner();

  const systemState = createMockSystemStateRepository();

  const config: Config = {
    DETECTION_MODE: 'poll',
    GITHUB_API_TIMEOUT_MS: 10_000,
    GITHUB_PAT: 'test-pat',
    POLL_INTERVAL: 90,
    REPO_FILTER: [{ pattern: 'test-owner/*', scope: 'user' }],
    DATABASE_URL: 'file:./data/test.db',
    WEB_PORT: 3000,
    SCHEDULER_POST_COOLDOWN: 3600,
    SCHEDULER_RETRY_BACKOFF_BASE: 60,
    SCHEDULER_RETRY_BACKOFF_MAX: 3600,
    REVIEW_LIMIT_BUFFER_SECONDS: 60,
    REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: 3600,
    SCHEDULER_TICK_INTERVAL_MS: TICK_INTERVAL_MS,
  };

  return { config, queue, queueOrder, github, events, observation, prisma, tx, logger, pruner, commentValidator, systemState };
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
      deps.queue,
      deps.queueOrder,
      deps.github,
      deps.events,
      deps.observation,
      deps.prisma,
      deps.config,
      deps.pruner,
      deps.commentValidator,
      deps.systemState,
      deps.logger,
    );

  const awaitTick = (scheduler: Scheduler) => scheduler['tickPromise'];

  describe('tick', () => {
    it('posts retrigger, marks retriggered, and records retriggered event in a transaction', async () => {
      const item = makeItem();
      const retriggeredHtmlUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.github.postRetrigger.mockResolvedValue({ htmlUrl: retriggeredHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).toHaveBeenCalledWith(
        item.repo_full_name,
        item.pr_number,
        item.source_comment_url,
        expect.any(String),
        'scheduler' as TriggerSource,
      );
      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(deps.queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + POST_COOLDOWN_MS), retriggeredHtmlUrl, deps.tx);
      const obs = deps.observation.current();
      expect(deps.events.record).toHaveBeenCalledWith(
        {
          type: 'retriggered',
          repo_full_name: item.repo_full_name,
          pr_number: item.pr_number,
          correlation_id: obs.correlationId,
          request_id: obs.requestId,
          version: obs.version,
          payload: {
            source_comment_url: item.source_comment_url,
            retriggered_comment_url: retriggeredHtmlUrl,
          },
        } as NewEvent,
        deps.tx,
      );
      expect(deps.logger.info).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          runId: expect.any(String),
        },
        'Retrigger retriggered',
      );

      await stop();
    });

    it('passes trigger_source to postRetrigger when set on the item', async () => {
      const item = makeItem({ trigger_source: TriggerSource.dashboard_retrigger_now });
      const retriggeredHtmlUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
      (deps.queueOrder.getEffectiveOrder as jest.Mock<any>).mockResolvedValue([item]);
      (deps.github.postRetrigger as jest.Mock<any>).mockResolvedValue({ htmlUrl: retriggeredHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).toHaveBeenCalledWith(
        item.repo_full_name,
        item.pr_number,
        item.source_comment_url,
        expect.any(String),
        'dashboard_retrigger_now' as TriggerSource,
      );

      await stop();
    });

    it('marks failed and records failed event on HTTP 404', async () => {
      const item = makeItem();
      const notFoundError = { status: 404 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.github.postRetrigger.mockRejectedValue(notFoundError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);
      expect(deps.events.record).toHaveBeenCalledWith(
        {
          type: 'failed',
          repo_full_name: item.repo_full_name,
          pr_number: item.pr_number,
          correlation_id: deps.observation.current().correlationId,
          request_id: deps.observation.current().requestId,
          version: deps.observation.current().version,
          payload: { reason: 'PR closed or merged' },
        } as NewEvent,
        deps.tx,
      );
      expect(deps.logger.info).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          status: 404,
        },
        'PR closed or merged; marked failed',
      );

      await stop();
    });

    it('marks failed on HTTP 410', async () => {
      const item = makeItem();
      const goneError = { status: 410 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.github.postRetrigger.mockRejectedValue(goneError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);
      expect(deps.logger.info).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          status: 410,
        },
        'PR closed or merged; marked failed',
      );

      await stop();
    });

    it('reschedules with backoff on HTTP 403, includes error in log', async () => {
      const item = makeItem();
      const forbiddenError = { status: 403 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.github.postRetrigger.mockRejectedValue(forbiddenError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.queue.markRetriggered).not.toHaveBeenCalled();
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + BASE_BACKOFF_MS), deps.tx);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          backoffMs: BASE_BACKOFF_MS,
          attempts: 0,
          error: forbiddenError,
        },
        'Post retrigger failed; rescheduled with backoff',
      );

      await stop();
    });

    it('returns early when no items are due', async () => {
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([]);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.systemState.isSchedulerPaused).toHaveBeenCalled();
      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.queue.markRetriggered).not.toHaveBeenCalled();
      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.events.record).not.toHaveBeenCalled();

      await stop();
    });

    it('skips processing when scheduler is paused', async () => {
      const item = makeItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(true);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.systemState.isSchedulerPaused).toHaveBeenCalled();
      expect(deps.logger.debug).toHaveBeenCalledWith({ fn: 'Scheduler.tick' }, 'Scheduler is paused; skipping tick');
      expect(deps.queueOrder.getEffectiveOrder).not.toHaveBeenCalled();
      expect(deps.github.postRetrigger).not.toHaveBeenCalled();

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

    it('proceeds normally when schedulerStatus is undefined', async () => {
      const item = makeItem();
      const retriggeredHtmlUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(false);
      deps.github.postRetrigger.mockResolvedValue({ htmlUrl: retriggeredHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.systemState.isSchedulerPaused).toHaveBeenCalled();
      expect(deps.github.postRetrigger).toHaveBeenCalled();

      await stop();
    });

    it('proceeds normally when schedulerStatus is running', async () => {
      const item = makeItem();
      const retriggeredHtmlUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.systemState.isSchedulerPaused.mockResolvedValue(false);
      deps.github.postRetrigger.mockResolvedValue({ htmlUrl: retriggeredHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.systemState.isSchedulerPaused).toHaveBeenCalled();
      expect(deps.github.postRetrigger).toHaveBeenCalled();

      await stop();
    });

    it('logs warning when getEffectiveOrder itself rejects', async () => {
      const dbError = new Error('DB connection lost');
      deps.queueOrder.getEffectiveOrder.mockRejectedValue(dbError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'Scheduler.tick', error: dbError }, 'executeTick failed before item was fetched');

      await stop();
    });

    it('logs warning with String(err) when getEffectiveOrder rejects a non-Error', async () => {
      deps.queueOrder.getEffectiveOrder.mockRejectedValue('raw string failure');

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'Scheduler.tick', error: 'raw string failure' }, 'executeTick failed before item was fetched');

      await stop();
    });

    it('reschedules with backoff on unknown error', async () => {
      const item = makeItem();
      const networkError = new Error('Network timeout');
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.github.postRetrigger.mockRejectedValue(networkError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.events.record).not.toHaveBeenCalled();
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + BASE_BACKOFF_MS), deps.tx);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'Scheduler.tick', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, backoffMs: BASE_BACKOFF_MS, attempts: 0, error: networkError },
        'Post retrigger failed; rescheduled with backoff',
      );

      await stop();
    });

    it('proceeds with postRetrigger when validator returns proceed', async () => {
      const item = makeItem();
      const retriggeredHtmlUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.commentValidator.validate.mockResolvedValue({ action: 'proceed' });
      deps.github.postRetrigger.mockResolvedValue({ htmlUrl: retriggeredHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.commentValidator.validate).toHaveBeenCalledWith(item);
      expect(deps.github.postRetrigger).toHaveBeenCalledWith(
        item.repo_full_name,
        item.pr_number,
        item.source_comment_url,
        expect.any(String),
        item.trigger_source,
      );
      expect(deps.queue.reschedule).not.toHaveBeenCalled();
      expect(deps.queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + POST_COOLDOWN_MS), retriggeredHtmlUrl, deps.tx);

      await stop();
    });

    it('reschedules when validator returns reschedule', async () => {
      const item = makeItem();
      const newCommentId = getUniqueInt();
      const newCommentUrl = getUniqueString({ prefix: 'https://gh/c/' });
      const newNotBefore = new Date(Date.now() + 3600_000);
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.commentValidator.validate.mockResolvedValue({
        action: 'reschedule',
        notBefore: newNotBefore,
        sourceComment: { commentId: newCommentId, commentUrl: newCommentUrl },
      });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.commentValidator.validate).toHaveBeenCalledWith(item);
      expect(deps.queue.reschedule).toHaveBeenCalledWith(item.id, newNotBefore, { commentId: newCommentId, commentUrl: newCommentUrl }, deps.tx);
      expect(deps.github.postRetrigger).not.toHaveBeenCalled();

      await stop();
    });

    it('skips the tick when validator returns skip', async () => {
      const item = makeItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.commentValidator.validate.mockResolvedValue({ action: 'skip' });

      const capturedDates: Date[] = [];
      deps.queue.backoff.mockImplementation(((_id: number, date: Date, _tx: unknown) => {
        capturedDates.push(date);
        return Promise.resolve();
      }) as any);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.commentValidator.validate).toHaveBeenCalledWith(item);
      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + BASE_BACKOFF_MS), deps.tx);
      expect(deps.queue.markRetriggered).not.toHaveBeenCalled();
      expect(deps.queue.markFailed).not.toHaveBeenCalled();

      expect(capturedDates).toHaveLength(1);
      const backoffMs = capturedDates[0].getTime() - Date.now();
      expect(backoffMs).toBeGreaterThanOrEqual(BASE_BACKOFF_MS - BACKOFF_TOLERANCE_MS);
      expect(backoffMs).toBeLessThanOrEqual(BASE_BACKOFF_MS + BACKOFF_TOLERANCE_MS);

      await stop();
    });

    it('reschedules with backoff when commentValidator.validate throws a non-terminal error', async () => {
      const item = makeItem();
      const serverError = { status: 500 };
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.commentValidator.validate.mockRejectedValue(serverError);

      const capturedDates: Date[] = [];
      deps.queue.backoff.mockImplementation(((_id: number, date: Date, _tx: unknown) => {
        capturedDates.push(date);
        return Promise.resolve();
      }) as any);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.queue.backoff).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + BASE_BACKOFF_MS), deps.tx);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          backoffMs: BASE_BACKOFF_MS,
          attempts: 0,
          error: serverError,
        },
        'Post retrigger failed; rescheduled with backoff',
      );

      expect(capturedDates).toHaveLength(1);
      const backoffMs = capturedDates[0].getTime() - Date.now();
      expect(backoffMs).toBeGreaterThanOrEqual(BASE_BACKOFF_MS - BACKOFF_TOLERANCE_MS);
      expect(backoffMs).toBeLessThanOrEqual(BASE_BACKOFF_MS + BACKOFF_TOLERANCE_MS);

      await stop();
    });

    it('doubles backoff on successive unknown errors', async () => {
      const item1 = makeItem({ attempts: 0 });
      const item2 = makeItem({ attempts: 1 });
      const networkError = new Error('Network timeout');
      deps.queueOrder.getEffectiveOrder.mockResolvedValueOnce([item1]).mockResolvedValueOnce([item2]);
      deps.github.postRetrigger.mockRejectedValue(networkError);

      const capturedDates: Date[] = [];
      deps.queue.backoff.mockImplementation(((_id: number, date: Date, _tx: unknown) => {
        capturedDates.push(date);
        return Promise.resolve();
      }) as any);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      scheduler['tick']();
      await awaitTick(scheduler);

      expect(deps.queue.backoff).toHaveBeenNthCalledWith(1, item1.id, new Date(frozenNow.getTime() + BASE_BACKOFF_MS), deps.tx);
      expect(deps.queue.backoff).toHaveBeenNthCalledWith(2, item2.id, new Date(frozenNow.getTime() + BASE_BACKOFF_MS * 2), deps.tx);

      expect(capturedDates).toHaveLength(2);
      const firstMs = capturedDates[0].getTime() - Date.now();
      expect(firstMs).toBeGreaterThanOrEqual(BASE_BACKOFF_MS * Math.pow(2, 0) - BACKOFF_TOLERANCE_MS);
      expect(firstMs).toBeLessThanOrEqual(BASE_BACKOFF_MS * Math.pow(2, 0) + BACKOFF_TOLERANCE_MS);

      const secondMs = capturedDates[1].getTime() - Date.now();
      expect(secondMs).toBeGreaterThanOrEqual(BASE_BACKOFF_MS * Math.pow(2, 1) - BACKOFF_TOLERANCE_MS);
      expect(secondMs).toBeLessThanOrEqual(BASE_BACKOFF_MS * Math.pow(2, 1) + BACKOFF_TOLERANCE_MS);

      await stop();
    });

    it('logs warning when getEffectiveOrder rejects (item is null in catch)', async () => {
      const dbError = new Error('Database connection lost');
      deps.queueOrder.getEffectiveOrder.mockRejectedValue(dbError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'Scheduler.tick', error: dbError }, 'executeTick failed before item was fetched');

      await stop();
    });
  });

  describe('cleanup delegation', () => {
    it('delegates to Pruner.prune() before processing', async () => {
      const item = makeItem();
      const retriggeredHtmlUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });

      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);
      deps.github.postRetrigger.mockResolvedValue({ htmlUrl: retriggeredHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.pruner.prune).toHaveBeenCalled();
      expect(deps.queueOrder.getEffectiveOrder).toHaveBeenCalled();
      expect(deps.github.postRetrigger).toHaveBeenCalled();

      expect((deps.pruner.prune as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
        (deps.queueOrder.getEffectiveOrder as jest.Mock).mock.invocationCallOrder[0],
      );

      await stop();
    });
  });

  describe('concurrency', () => {
    it('skips tick when another tick is already in-flight', async () => {
      const item = makeItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);

      let resolvePost: (value: { htmlUrl: string }) => void;
      const postPromise = new Promise<{ htmlUrl: string }>((resolve) => {
        resolvePost = resolve;
      });
      deps.github.postRetrigger.mockReturnValue(postPromise);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      scheduler['tick']();

      await drainMicrotasks(SINGLE_TICK);

      expect(deps.github.postRetrigger).toHaveBeenCalledTimes(1);

      resolvePost!({ htmlUrl: getUniqueString({ prefix: 'https://gh/' }) });
      await stop();
    });
  });

  describe('stop', () => {
    it('drains the in-flight tick before resolving stop', async () => {
      const item = makeItem();
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([item]);

      let resolvePost: (value: { htmlUrl: string }) => void;
      const postPromise = new Promise<{ htmlUrl: string }>((resolve) => {
        resolvePost = resolve;
      });
      deps.github.postRetrigger.mockReturnValue(postPromise);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      let stopResolved = false;
      const stopPromise = stop().then(() => {
        stopResolved = true;
      });

      await drainMicrotasks(SINGLE_TICK);
      expect(stopResolved).toBe(false);

      resolvePost!({ htmlUrl: getUniqueString({ prefix: 'https://gh/' }) });
      await stopPromise;
      expect(stopResolved).toBe(true);
    });
  });

  describe('start', () => {
    it('fires first tick immediately and starts an interval', async () => {
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([]);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.queueOrder.getEffectiveOrder).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.start', tickIntervalMs: TICK_INTERVAL_MS }, 'Starting scheduler');

      jest.advanceTimersByTime(TICK_INTERVAL_MS);
      await drainMicrotasks(SHORT_DRAIN);

      jest.advanceTimersByTime(TICK_INTERVAL_MS);
      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.queueOrder.getEffectiveOrder).toHaveBeenCalledTimes(3);

      await stop();
    });

    it('stop clears the interval and logs', async () => {
      deps.queueOrder.getEffectiveOrder.mockResolvedValue([]);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      await stop();

      jest.advanceTimersByTime(TICK_INTERVAL_MS * 2);

      expect(deps.queueOrder.getEffectiveOrder).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
    });
  });
});
