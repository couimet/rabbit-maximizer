import { CompletionDetector } from '../src/CompletionDetector.js';
import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import { type QueueItem, QueueStatus, TriggerSource } from '../src/types/index.js';

import {
  createMockCoderabbitGitHubClient,
  createMockEventRepo,
  createMockObservationContextProvider,
  createMockQueueRepo,
  makeUniqueRepoName,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
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
  queue: { getRetriggeredQueue: jest.Mock<any>; markCompleted: jest.Mock<any> };
  github: jest.Mocked<CoderabbitGitHubClient>;
  events: { record: jest.Mock<any> };
  prisma: { $transaction: jest.Mock<any> };
  observation: jest.Mocked<ObservationContextProvider>;
  logger: Logger;
  config: { POLL_INTERVAL: number };
}

const makeRetriggeredItem = (overrides: { id?: number; retriggeredAt?: Date; repoFullName?: string; prNumber?: number }): QueueItem => {
  const commentId = getUniqueInt();
  return {
    id: overrides.id ?? getUniqueInt(),
    uuid: getUniqueString({ prefix: 'uuid-' }),
    repo_full_name: overrides.repoFullName ?? `${getUniqueString({ prefix: 'org' })}/${getUniqueString({ prefix: 'repo' })}`,
    pr_number: overrides.prNumber ?? getUniqueInt(),
    pr_title: 'Test PR title',
    status: QueueStatus.retriggered,
    not_before: getUniqueDate(),
    attempts: 1,
    source_comment_url: `https://github.com/org/repo/issues/1#issuecomment-${commentId}`,
    source_comment_id: commentId,
    trigger_source: TriggerSource.scheduler,
    retriggered_at: overrides.retriggeredAt ?? getUniqueDate(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
  };
};

const setup = (): MockCompletionDetectorDeps => {
  const queue = createMockQueueRepo() as unknown as MockCompletionDetectorDeps['queue'];
  const github = createMockCoderabbitGitHubClient();
  const events = createMockEventRepo() as unknown as MockCompletionDetectorDeps['events'];
  const prisma = { $transaction: jest.fn<any>() };
  const observation = createMockObservationContextProvider();
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
      const retriggeredAt = getUniqueDate();
      const { owner, repo, fullName: repoFullName } = makeUniqueRepoName();
      const prNumber = getUniqueInt();
      const item = makeRetriggeredItem({ retriggeredAt, repoFullName, prNumber });
      const completedCommentUrl = `https://github.com/${repoFullName}/issues/${prNumber}#issuecomment-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: completedCommentUrl });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(owner, repo, prNumber, retriggeredAt);
      expect(deps.queue.markCompleted).toHaveBeenCalledWith(item.id, {});
      const obs = deps.observation.current();
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
      deps.github.findCompletedReview.mockResolvedValue(undefined);

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

      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('skips items with null retriggered_at', async () => {
      const item = makeRetriggeredItem({});
      const itemWithNullRetriggeredAt = { ...item, retriggered_at: undefined };
      deps.queue.getRetriggeredQueue.mockResolvedValue([itemWithNullRetriggeredAt]);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('processes multiple retriggered items in sequence', async () => {
      const item1 = makeRetriggeredItem({ repoFullName: 'org-a/repo-a', prNumber: 1 });
      const item2 = makeRetriggeredItem({ repoFullName: 'org-b/repo-b', prNumber: 2 });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item1, item2]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledTimes(2);
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
      deps.github.findCompletedReview.mockRejectedValueOnce(perItemError).mockResolvedValueOnce(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.logger.warn).toHaveBeenCalledWith(
        { fn: 'CompletionDetector.tick', error: perItemError },
        'Completion detection tick failed; will retry on next interval',
      );
      expect(deps.github.findCompletedReview).toHaveBeenCalledTimes(2);
    });
  });
});
