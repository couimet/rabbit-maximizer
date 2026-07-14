import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { ReviewDetector } from '../src/ReviewDetector.js';
import { type QueueItem, QueueStatus, TriggerSource } from '../src/types/index.js';

import { createMockCoderabbitGitHubClient, createMockProbeFactory, createMockQueueRepo, createMockReviewDetectorProbe } from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
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

interface MockReviewDetectorDeps {
  queue: { getRetriggeredQueue: jest.Mock<any>; markReviewed: jest.Mock<any> };
  pullRequests: { recordReview: jest.Mock<any> };
  github: jest.Mocked<CoderabbitGitHubClient>;
  probeFactory: ReturnType<typeof createMockProbeFactory>;
  probe: ReturnType<typeof createMockReviewDetectorProbe>;
  prisma: { $transaction: jest.Mock<any> };
  logger: Logger;
  config: { POLL_INTERVAL_SEC: number };
}

const makeRetriggeredItem = (overrides?: Partial<QueueItem> & { commentId?: number }): QueueItem => {
  const { commentId: overrideCommentId, ...rest } = overrides ?? {};
  const commentId = overrideCommentId ?? getUniqueInt();
  const defaults: QueueItem = {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: getUniqueGitHubRepoRef().fullName,
    pr_number: getUniqueInt(),
    pr_title: 'Test PR title',
    status: QueueStatus.retriggered,
    not_before: getUniqueDate(),
    attempts: 1,
    source_comment_url: `https://github.com/org/repo/issues/1#issuecomment-${commentId}`,
    source_comment_id: commentId,
    trigger_source: TriggerSource.scheduler,
    pull_request_id: getUniqueInt(),
    retriggered_at: getUniqueDate(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
  };
  return { ...defaults, ...rest };
};

const setup = (): MockReviewDetectorDeps => {
  const queue = createMockQueueRepo() as unknown as MockReviewDetectorDeps['queue'];
  const pullRequests = { recordReview: jest.fn<any>() };
  const github = createMockCoderabbitGitHubClient();
  const probe = createMockReviewDetectorProbe();
  const probeFactory = createMockProbeFactory({ createReviewDetectorProbe: jest.fn<any>().mockReturnValue(probe) });
  const prisma = { $transaction: jest.fn<any>() };
  const logger = createMockLogger();
  const config = { POLL_INTERVAL_SEC: POLL_INTERVAL_SEC };
  return { queue, pullRequests, github, probeFactory, probe, prisma, logger, config };
};

describe('ReviewDetector', () => {
  let deps: MockReviewDetectorDeps;
  beforeEach(() => {
    deps = setup();
    jest.useFakeTimers();
  });
  const createDetector = () =>
    new ReviewDetector(
      deps.queue as any,
      deps.pullRequests as any,
      deps.github,
      deps.probeFactory as any,
      deps.prisma as unknown as PrismaClient,
      deps.config as any,
      deps.logger,
    );

  describe('start', () => {
    it('fires the first tick immediately and starts an interval', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);
      const detector = createDetector();
      const { stop } = detector.start();
      expect(deps.queue.getRetriggeredQueue).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'ReviewDetector.start', pollIntervalSec: POLL_INTERVAL_SEC }, 'Starting review detector');
      await stop();
    });
    it('stop clears the interval', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);
      const detector = createDetector();
      const { stop } = detector.start();
      await stop();
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 2);
      expect(deps.queue.getRetriggeredQueue).toHaveBeenCalledTimes(1);
      expect(deps.logger.info).toHaveBeenCalledWith({ fn: 'ReviewDetector.stop' }, 'Review detector stopped');
    });
  });

  describe('detection', () => {
    it('transitions item to reviewed when a review comment is found', async () => {
      const retriggeredAt = getUniqueDate();
      const { owner, repo, fullName: repoFullName } = getUniqueGitHubRepoRef();
      const prNumber = getUniqueInt();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: repoFullName, pr_number: prNumber });
      const reviewId = getUniqueInt();
      const completedCommentUrl = `https://github.com/${repoFullName}/issues/${prNumber}#issuecomment-${getUniqueInt()}`;
      const completedReview = { htmlUrl: completedCommentUrl, reviewId };
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(completedReview);
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));
      const markReviewedResult = { pull_request_id: item.pull_request_id, id: item.id };
      (deps.queue.markReviewed as jest.Mock<any>).mockResolvedValue(markReviewedResult);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(owner, repo, prNumber, retriggeredAt);
      expect(deps.probeFactory.createReviewDetectorProbe).toHaveBeenCalledTimes(1);
      expect(deps.probe.withItem).toHaveBeenCalledWith(item);
      expect(deps.queue.markReviewed).toHaveBeenCalledWith(item.id, {});
      expect(deps.pullRequests.recordReview).toHaveBeenCalledWith(item.pull_request_id, {});
      expect(deps.probe.completed).toHaveBeenCalledWith(completedReview, {});
    });

    it('skips items where no completed review is found', async () => {
      const item = makeRetriggeredItem({});
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.queue.markReviewed).not.toHaveBeenCalled();
      expect(deps.probe.withItem).toHaveBeenCalledWith(item);
      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
      expect(deps.probe.completed).not.toHaveBeenCalled();
    });

    it('skips items where retriggered_at is null', async () => {
      const item = makeRetriggeredItem({ retriggered_at: undefined });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('delegates to probe when no retriggered items exist', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.probe.noRetriggeredItemFound).toHaveBeenCalled();
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('delegates caught errors to probe and continues', async () => {
      const tickError = new Error('API unavailable');
      const failingItem = makeRetriggeredItem({});
      const passingItem = makeRetriggeredItem({});
      deps.queue.getRetriggeredQueue.mockResolvedValue([failingItem, passingItem]);
      deps.github.findCompletedReview.mockRejectedValueOnce(tickError);
      deps.github.findCompletedReview.mockResolvedValueOnce(undefined);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.probe.caughtError).toHaveBeenCalledWith(tickError);
      expect(deps.probeFactory.createReviewDetectorProbe).toHaveBeenCalledTimes(1);
    });
  });
});
