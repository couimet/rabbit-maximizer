import { CompletionDetector } from '../src/CompletionDetector.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { type QueueItem, QueueStatus } from '../src/types/index.js';

import { createMockLogger } from './helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

const POLL_INTERVAL_SEC = 90;
const POLL_INTERVAL_MS = POLL_INTERVAL_SEC * 1000;
const TICK_DEPTH = 20;

const drainMicrotasks = async (depth: number): Promise<void> => {
  for (let i = 0; i < depth; i++) {
    await Promise.resolve();
  }
};

interface MockCompletionDetectorDeps {
  queue: {
    getRetriggeredQueue: jest.Mock<any>;
    markCompleted: jest.Mock<any>;
  };
  github: CoderabbitGitHubClient;
  events: { record: jest.Mock<any> };
  prisma: { $transaction: jest.Mock<any> };
  observation: { current: jest.Mock<any> };
  logger: Logger;
  config: { POLL_INTERVAL: number };
}

const makeRetriggeredItem = (overrides: { id?: number; retriggeredAt?: Date; repoFullName?: string; prNumber?: number }): QueueItem => ({
  id: overrides.id ?? getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: overrides.repoFullName ?? `${getUniqueString({ prefix: 'org' })}/${getUniqueString({ prefix: 'repo' })}`,
  pr_number: overrides.prNumber ?? getUniqueInt(),
  status: QueueStatus.retriggered,
  not_before: new Date(),
  attempts: 1,
  source_comment_url: `https://github.com/org/repo/issues/1#issuecomment-${getUniqueInt()}`,
  retriggered_at: overrides.retriggeredAt ?? new Date('2026-06-15T00:00:00Z'),
  created_at: new Date('2026-06-14T00:00:00Z'),
  updated_at: new Date('2026-06-15T00:00:00Z'),
});

const setup = (): MockCompletionDetectorDeps => {
  const queue = {
    getRetriggeredQueue: jest.fn<any>(),
    markCompleted: jest.fn<any>(),
  };

  const github = {
    findCompletedReview: jest.fn<any>(),
  } as unknown as CoderabbitGitHubClient;

  const events = { record: jest.fn<any>() };
  const prisma = { $transaction: jest.fn<any>() };
  const observation = { current: jest.fn<any>() };
  const logger = createMockLogger();
  const config = { POLL_INTERVAL: POLL_INTERVAL_SEC };

  return { queue, github, events, prisma, observation, logger, config };
};

describe('CompletionDetector', () => {
  let deps: MockCompletionDetectorDeps;

  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
  });

  const createDetector = () =>
    new CompletionDetector(
      deps.queue as any,
      deps.github,
      deps.events as any,
      deps.prisma as unknown as PrismaClient,
      deps.observation as any,
      deps.config as any,
      deps.logger,
    );

  describe('start', () => {
    it('fires the first tick immediately and starts an interval', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      expect(deps.queue.getRetriggeredQueue).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'CompletionDetector.start', pollIntervalSec: POLL_INTERVAL_SEC }, 'Starting completion detector');

      await stop();
    });

    it('stop clears the interval', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);

      const detector = createDetector();
      const { stop } = detector.start();

      await stop();
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 2);

      expect(deps.queue.getRetriggeredQueue).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'CompletionDetector.stop' }, 'Completion detector stopped');
    });
  });

  describe('detection', () => {
    it('transitions item to completed when a review comment is found', async () => {
      const retriggeredAt = new Date('2026-06-15T00:00:00Z');
      const item = makeRetriggeredItem({ retriggeredAt, repoFullName: 'my-org/my-repo', prNumber: 42 });
      const completedCommentUrl = 'https://github.com/my-org/my-repo/issues/42#issuecomment-999';

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      (deps.github.findCompletedReview as jest.Mock<any>).mockResolvedValue({ htmlUrl: completedCommentUrl });

      const obs = { correlationId: 'corr-1', requestId: 'req-1', version: '1.0.0' };
      deps.observation.current.mockReturnValue(obs);

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const [owner, repo] = item.repo_full_name.split('/');
      expect(deps.github.findCompletedReview as jest.Mock<any>).toHaveBeenCalledWith(owner, repo, item.pr_number, item.retriggered_at);
      expect(deps.queue.markCompleted).toHaveBeenCalledWith(item.id, {});
      expect(deps.events.record).toHaveBeenCalledWith(
        {
          type: 'completed',
          repo_full_name: item.repo_full_name,
          pr_number: item.pr_number,
          correlation_id: obs.correlationId,
          request_id: obs.requestId,
          version: obs.version,
          payload: {
            retriggered_comment_url: completedCommentUrl,
          },
        },
        {},
      );
      expect(deps.logger.info).toHaveBeenCalledWith(
        { fn: 'CompletionDetector.tick', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id },
        'Completed review detected',
      );
    });

    it('skips items where no completed review is found', async () => {
      const item = makeRetriggeredItem({});
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      (deps.github.findCompletedReview as jest.Mock<any>).mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.queue.markCompleted).not.toHaveBeenCalled();
      expect(deps.events.record).not.toHaveBeenCalled();
    });

    it('returns early when no retriggered items exist', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview as jest.Mock<any>).not.toHaveBeenCalled();
    });

    it('skips items with null retriggered_at', async () => {
      const item = makeRetriggeredItem({});
      const itemWithNullRetriggeredAt = { ...item, retriggered_at: undefined };
      deps.queue.getRetriggeredQueue.mockResolvedValue([itemWithNullRetriggeredAt]);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview as jest.Mock<any>).not.toHaveBeenCalled();
    });

    it('processes multiple retriggered items in sequence', async () => {
      const item1 = makeRetriggeredItem({ repoFullName: 'org-a/repo-a', prNumber: 1 });
      const item2 = makeRetriggeredItem({ repoFullName: 'org-b/repo-b', prNumber: 2 });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item1, item2]);
      (deps.github.findCompletedReview as jest.Mock<any>).mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview as jest.Mock<any>).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrency', () => {
    it('skips tick when another tick is already in-flight', async () => {
      let resolveQueue: (value: unknown) => void;
      const queuePromise = new Promise((resolve) => {
        resolveQueue = resolve;
      });
      deps.queue.getRetriggeredQueue.mockReturnValue(queuePromise);

      const detector = createDetector();
      const { stop } = detector.start();

      await Promise.resolve();

      detector['tick']();

      await Promise.resolve();

      expect(deps.queue.getRetriggeredQueue).toHaveBeenCalledTimes(1);

      resolveQueue!([]);
      await stop();
    });
  });

  describe('error handling', () => {
    it('logs warning via base class when getRetriggeredQueue fails', async () => {
      const error = new Error('GitHub API error');
      deps.queue.getRetriggeredQueue.mockRejectedValue(error);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith({ fn: 'IntervalService.tick', error }, 'executeTick threw; continuing');
    });

    it('logs warning per-item and continues processing remaining items', async () => {
      const item1 = makeRetriggeredItem({ repoFullName: 'org-a/repo-a', prNumber: 1 });
      const item2 = makeRetriggeredItem({ repoFullName: 'org-b/repo-b', prNumber: 2 });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item1, item2]);

      const perItemError = new Error('findCompletedReview failed');
      (deps.github.findCompletedReview as jest.Mock<any>).mockRejectedValueOnce(perItemError).mockResolvedValueOnce(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'CompletionDetector.tick', error: perItemError },
        'Completion detection tick failed; will retry on next interval',
      );
      expect(deps.github.findCompletedReview as jest.Mock<any>).toHaveBeenCalledTimes(2);
    });
  });
});
