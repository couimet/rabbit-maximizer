import type { Config } from '../src/config.js';
import type { EventRepository } from '../src/db/eventRepository.js';
import type { QueueRepository } from '../src/db/queueRepository.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import { Scheduler } from '../src/scheduler.js';

import { createMockLogger, drainMicrotasks, makeUniqueRepoName } from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const TICK_INTERVAL_MS = 10_000;
const SHORT_DRAIN = 2;
const SINGLE_TICK = 1;

interface QueueItemStub {
  id: number;
  uuid: string;
  repo_full_name: string;
  pr_number: number;
  status: string;
  scheduled_for: Date;
  attempts: number;
  source_comment_url: string;
  created_at: Date;
  updated_at: Date;
}

interface MockSchedulerDeps {
  config: Config;
  queue: QueueRepository;
  github: CoderabbitGitHubClient;
  events: EventRepository;
  observation: ObservationContextProvider;
  prisma: PrismaClient;
  tx: Prisma.TransactionClient;
  logger: Logger;
}

const makeItem = (over: Partial<QueueItemStub> = {}): QueueItemStub => ({
  id: over.id ?? getUniqueInt(),
  uuid: over.uuid ?? getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: over.repo_full_name ?? makeUniqueRepoName().fullName,
  pr_number: over.pr_number ?? getUniqueInt(),
  status: over.status ?? 'pending',
  scheduled_for: over.scheduled_for ?? new Date(Date.now() - 60_000),
  attempts: over.attempts ?? 0,
  source_comment_url: over.source_comment_url ?? getUniqueString({ prefix: 'https://gh/c/' }),
  created_at: over.created_at ?? getUniqueDate(),
  updated_at: over.updated_at ?? getUniqueDate(),
});

const setup = (): MockSchedulerDeps => {
  const queue = {
    enqueue: jest.fn<any>(),
    getNextDue: jest.fn<any>(),
    markPosted: jest.fn<any>(),
    markCompleted: jest.fn<any>(),
    reschedule: jest.fn<any>(),
    markFailed: jest.fn<any>(),
    getPendingQueue: jest.fn<any>(),
  } as unknown as QueueRepository;

  const github = {
    searchRateLimitComments: jest.fn<any>(),
    fetchComment: jest.fn<any>(),
    postRetrigger: jest.fn<any>(),
  } as unknown as CoderabbitGitHubClient;

  const events = {
    record: jest.fn<any>(),
    listForPr: jest.fn<any>(),
  } as unknown as EventRepository;

  const obsContext = {
    correlationId: getUniqueString({ prefix: 'corr-' }),
    requestId: getUniqueString({ prefix: 'req-' }),
    version: '1.0.0-test',
  };

  const observation = {
    current: jest.fn<any>().mockReturnValue(obsContext),
  } as unknown as ObservationContextProvider;

  const tx = {} as Prisma.TransactionClient;

  const prisma = {
    $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)),
  } as unknown as PrismaClient;

  const logger = createMockLogger();

  const config: Config = {
    DETECTION_MODE: 'poll',
    GITHUB_PAT: 'test-pat',
    POLL_INTERVAL: 90,
    REPO_FILTER: [{ pattern: 'test-owner/*', scope: 'user' }],
    DATABASE_URL: 'file:./data/test.db',
    WEB_PORT: 3000,
    SCHEDULER_POST_COOLDOWN: 3600,
    SCHEDULER_RETRY_BACKOFF_BASE: 60,
    SCHEDULER_RETRY_BACKOFF_MAX: 3600,
  };

  return { config, queue, github, events, observation, prisma, tx, logger };
};

describe('Scheduler', () => {
  let deps: MockSchedulerDeps;

  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
  });

  const createScheduler = () => new Scheduler(deps.queue, deps.github, deps.events, deps.observation, deps.prisma, deps.logger, deps.config);

  const awaitTick = (scheduler: Scheduler) => scheduler['tickPromise'];

  describe('tick', () => {
    it('posts retrigger, marks posted, and records posted event in a transaction', async () => {
      const item = makeItem();
      const postedHtmlUrl = getUniqueString({ prefix: 'https://gh/c/posted-' });
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);
      (deps.github.postRetrigger as jest.Mock<any>).mockResolvedValue({ htmlUrl: postedHtmlUrl });

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).toHaveBeenCalledWith(item.repo_full_name, item.pr_number, item.source_comment_url, expect.any(String));
      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(deps.queue.markPosted).toHaveBeenCalledWith(item.id, expect.any(Date), deps.tx);
      expect(deps.events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'posted',
          repo_full_name: item.repo_full_name,
          pr_number: item.pr_number,
          correlation_id: deps.observation.current().correlationId,
          request_id: deps.observation.current().requestId,
          version: deps.observation.current().version,
          payload: {
            source_comment_url: item.source_comment_url,
            posted_comment_url: postedHtmlUrl,
          },
        },
        deps.tx,
      );
      expect(deps.logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
          runId: expect.any(String),
        },
        'Retrigger posted',
      );

      await stop();
    });

    it('marks failed and records failed event on HTTP 404', async () => {
      const item = makeItem();
      const notFoundError = { status: 404 };
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);
      (deps.github.postRetrigger as jest.Mock<any>).mockRejectedValue(notFoundError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);
      expect(deps.events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'failed',
          repo_full_name: item.repo_full_name,
          pr_number: item.pr_number,
          correlation_id: deps.observation.current().correlationId,
          request_id: deps.observation.current().requestId,
          version: deps.observation.current().version,
          payload: { reason: 'PR closed or merged' },
        },
        deps.tx,
      );
      expect(deps.logger.info as jest.Mock<any>).toHaveBeenCalledWith(
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
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);
      (deps.github.postRetrigger as jest.Mock<any>).mockRejectedValue(goneError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);
      expect(deps.logger.info as jest.Mock<any>).toHaveBeenCalledWith(
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

    it('reschedules with backoff on HTTP 403 (rate limit)', async () => {
      const item = makeItem();
      const forbiddenError = { status: 403 };
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);
      (deps.github.postRetrigger as jest.Mock<any>).mockRejectedValue(forbiddenError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.queue.markPosted).not.toHaveBeenCalled();
      expect(deps.queue.reschedule).toHaveBeenCalledWith(item.id, expect.any(Date), deps.tx);
      expect(deps.logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'Scheduler.tick', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, backoffMs: 60_000, attempts: 0 },
        'Post retrigger failed; rescheduled with backoff',
      );

      await stop();
    });

    it('returns early when no items are due', async () => {
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(null);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.queue.markPosted).not.toHaveBeenCalled();
      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.events.record).not.toHaveBeenCalled();

      await stop();
    });

    it('logs warning when getNextDue itself rejects', async () => {
      const dbError = new Error('DB connection lost');
      (deps.queue.getNextDue as jest.Mock<any>).mockRejectedValue(dbError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'Scheduler.tick', error: dbError }, 'executeTick failed before item was fetched');

      await stop();
    });

    it('logs warning with String(err) when getNextDue rejects a non-Error', async () => {
      (deps.queue.getNextDue as jest.Mock<any>).mockRejectedValue('raw string failure');

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'Scheduler.tick', error: 'raw string failure' },
        'executeTick failed before item was fetched',
      );

      await stop();
    });

    it('reschedules with backoff on unknown error', async () => {
      const item = makeItem();
      const networkError = new Error('Network timeout');
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);
      (deps.github.postRetrigger as jest.Mock<any>).mockRejectedValue(networkError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.queue.markFailed).not.toHaveBeenCalled();
      expect(deps.events.record).not.toHaveBeenCalled();
      expect(deps.queue.reschedule).toHaveBeenCalledWith(item.id, expect.any(Date), deps.tx);
      expect(deps.logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'Scheduler.tick', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, backoffMs: 60_000, attempts: 0 },
        'Post retrigger failed; rescheduled with backoff',
      );

      await stop();
    });

    it('marks failed on MISSING_SOURCE_COMMENT_URL error', async () => {
      const item = { ...makeItem(), source_comment_url: null as unknown as string };
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.queue.markFailed).toHaveBeenCalledWith(item.id, deps.tx);
      expect(deps.events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'failed',
          repo_full_name: item.repo_full_name,
          pr_number: item.pr_number,
          correlation_id: deps.observation.current().correlationId,
          request_id: deps.observation.current().requestId,
          version: deps.observation.current().version,
          payload: { reason: 'Missing source comment URL' },
        },
        deps.tx,
      );
      expect(deps.logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        {
          fn: 'Scheduler.tick',
          repo: item.repo_full_name,
          pr: item.pr_number,
          queueId: item.id,
        },
        'Missing source comment URL; marked failed',
      );

      await stop();
    });

    it('doubles backoff on successive unknown errors', async () => {
      const item1 = makeItem({ attempts: 0 });
      const item2 = makeItem({ attempts: 1 });
      const networkError = new Error('Network timeout');
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValueOnce(item1).mockResolvedValueOnce(item2);
      (deps.github.postRetrigger as jest.Mock<any>).mockRejectedValue(networkError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      scheduler['tick']();
      await awaitTick(scheduler);

      expect(deps.queue.reschedule).toHaveBeenNthCalledWith(1, item1.id, expect.any(Date), deps.tx);
      expect(deps.queue.reschedule).toHaveBeenNthCalledWith(2, item2.id, expect.any(Date), deps.tx);

      const firstDate = (deps.queue.reschedule as jest.Mock<any>).mock.calls[0][1] as Date;
      const firstMs = firstDate.getTime() - Date.now();
      expect(firstMs).toBeGreaterThanOrEqual(60_000 * Math.pow(2, 0) - 5_000);
      expect(firstMs).toBeLessThanOrEqual(60_000 * Math.pow(2, 0) + 5_000);

      const secondDate = (deps.queue.reschedule as jest.Mock<any>).mock.calls[1][1] as Date;
      const secondMs = secondDate.getTime() - Date.now();
      expect(secondMs).toBeGreaterThanOrEqual(60_000 * Math.pow(2, 1) - 5_000);
      expect(secondMs).toBeLessThanOrEqual(60_000 * Math.pow(2, 1) + 5_000);

      await stop();
    });

    it('logs warning when getNextDue rejects (item is null in catch)', async () => {
      const dbError = new Error('Database connection lost');
      (deps.queue.getNextDue as jest.Mock<any>).mockRejectedValue(dbError);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await awaitTick(scheduler);

      expect(deps.github.postRetrigger).not.toHaveBeenCalled();
      expect(deps.logger.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'Scheduler.tick', error: dbError }, 'executeTick failed before item was fetched');

      await stop();
    });
  });

  describe('concurrency', () => {
    it('skips tick when another tick is already in-flight', async () => {
      const item = makeItem();
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);

      let resolvePost: (value: unknown) => void;
      const postPromise = new Promise((resolve) => {
        resolvePost = resolve;
      });
      (deps.github.postRetrigger as jest.Mock<any>).mockReturnValue(postPromise);

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
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(item);

      let resolvePost: (value: unknown) => void;
      const postPromise = new Promise((resolve) => {
        resolvePost = resolve;
      });
      (deps.github.postRetrigger as jest.Mock<any>).mockReturnValue(postPromise);

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
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(null);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.queue.getNextDue).toHaveBeenCalledTimes(1);
      expect(deps.logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'Scheduler.start', tickIntervalMs: TICK_INTERVAL_MS }, 'Starting scheduler');

      jest.advanceTimersByTime(TICK_INTERVAL_MS);
      await drainMicrotasks(SHORT_DRAIN);

      jest.advanceTimersByTime(TICK_INTERVAL_MS);
      await drainMicrotasks(SHORT_DRAIN);

      expect(deps.queue.getNextDue).toHaveBeenCalledTimes(3);

      await stop();
    });

    it('stop clears the interval and logs', async () => {
      (deps.queue.getNextDue as jest.Mock<any>).mockResolvedValue(null);

      const scheduler = createScheduler();
      const { stop } = scheduler.start();

      await drainMicrotasks(SHORT_DRAIN);

      await stop();

      jest.advanceTimersByTime(TICK_INTERVAL_MS * 2);

      expect(deps.queue.getNextDue).toHaveBeenCalledTimes(1);
      expect(deps.logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'Scheduler.stop' }, 'Scheduler stopped');
    });
  });
});
