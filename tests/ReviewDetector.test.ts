import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { splitRepo } from '../src/github/splitRepo.js';
import { ReviewDetector } from '../src/ReviewDetector.js';
import { CodeRabbitCommentType } from '../src/types/CodeRabbitCommentType.js';
import { type QueueItem, QueueStatus, TriggerSource } from '../src/types/index.js';

import {
  createMockCoderabbitCommentRepo,
  createMockCoderabbitGitHubClient,
  createMockCommentEditDetector,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  createMockReviewDetectorProbe,
  makeCoderabbitCommentRow,
} from './helpers/index.js';

import { getRandomEnumValue, getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
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
  pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  github: jest.Mocked<CoderabbitGitHubClient>;
  probeFactory: ReturnType<typeof createMockProbeFactory>;
  probe: ReturnType<typeof createMockReviewDetectorProbe>;
  commentEditDetector: ReturnType<typeof createMockCommentEditDetector>;
  commentRepo: ReturnType<typeof createMockCoderabbitCommentRepo>;
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
    status: getRandomEnumValue(QueueStatus),
    attempts: 1,
    source_comment_url: `https://github.com/org/repo/issues/1#issuecomment-${commentId}`,
    source_comment_id: commentId,
    trigger_source: getRandomEnumValue(TriggerSource),
    pull_request_id: getUniqueInt(),
    retriggered_at: getUniqueDate(),
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
  };
  return { ...defaults, ...rest };
};

const DEFAULT_EDIT_RESULT = {
  wasEdited: false,
  newClassification: CodeRabbitCommentType.review_limited,
  updatedCommentRow: makeCoderabbitCommentRow({ comment_type: CodeRabbitCommentType.review_limited }),
};

const setup = (): MockReviewDetectorDeps => {
  const queue = createMockQueueRepo() as unknown as MockReviewDetectorDeps['queue'];
  const pullRequests = createMockPullRequestRepo();
  const github = createMockCoderabbitGitHubClient();
  const probe = createMockReviewDetectorProbe();
  const probeFactory = createMockProbeFactory({ createReviewDetectorProbe: jest.fn<any>().mockReturnValue(probe) });
  const commentEditDetector = createMockCommentEditDetector();
  commentEditDetector.detect.mockResolvedValue(DEFAULT_EDIT_RESULT);
  const commentRepo = createMockCoderabbitCommentRepo();
  const prisma = { $transaction: jest.fn<any>() };
  const logger = createMockLogger();
  const config = { POLL_INTERVAL_SEC: POLL_INTERVAL_SEC };
  return { queue, pullRequests, github, probeFactory, probe, commentEditDetector, commentRepo, prisma, logger, config };
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
      deps.commentEditDetector as any,
      deps.commentRepo as any,
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
    it('marks reviewed with coderabbit_review_approved when completed review is an approval', async () => {
      const retriggeredAt = getUniqueDate();
      const { owner, repo, fullName: repoFullName } = getUniqueGitHubRepoRef();
      const prNumber = getUniqueInt();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: repoFullName, pr_number: prNumber });
      const reviewUrl = `https://github.com/${repoFullName}/pull/${prNumber}#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: true });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(owner, repo, prNumber, retriggeredAt);
      expect(deps.probeFactory.createReviewDetectorProbe).toHaveBeenCalledTimes(1);
      expect(deps.probe.withItem).toHaveBeenCalledWith(item);
      expect(deps.queue.markReviewed).toHaveBeenCalledWith(item.id, {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', reviewUrl, {});
    });

    it('marks reviewed with coderabbit_review_changes_suggested when completed review is not an approval', async () => {
      const retriggeredAt = getUniqueDate();
      const { owner, repo, fullName: repoFullName } = getUniqueGitHubRepoRef();
      const prNumber = getUniqueInt();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: repoFullName, pr_number: prNumber });
      const reviewUrl = `https://github.com/${repoFullName}/pull/${prNumber}#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: false });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(owner, repo, prNumber, retriggeredAt);
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_changes_suggested', reviewUrl, {});
    });

    it('skips item when no completed review is found', async () => {
      const item = makeRetriggeredItem({});
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.withItem).toHaveBeenCalledWith(item);
      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
      expect(deps.probe.reviewed).not.toHaveBeenCalled();
      expect(deps.queue.markReviewed).not.toHaveBeenCalled();
    });

    it('delegates to probe when no retriggered items exist', async () => {
      deps.queue.getRetriggeredQueue.mockResolvedValue([]);
      const detector = createDetector();
      detector.start();
      await drainMicrotasks(TICK_DEPTH);
      expect(deps.probe.noRetriggeredItemFound).toHaveBeenCalled();
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('skips items with null retriggered_at', async () => {
      const item = makeRetriggeredItem({ retriggered_at: undefined });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('processes multiple retriggered items in sequence', async () => {
      const item1 = makeRetriggeredItem({ repo_full_name: 'org-a/repo-a', pr_number: 1 });
      const item2 = makeRetriggeredItem({ repo_full_name: 'org-b/repo-b', pr_number: 2 });
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

  describe('edit detection', () => {
    it('marks reviewed directly when edit detection finds a completed review', async () => {
      const item = makeRetriggeredItem({});
      const reviewUrl = `https://github.com/org/repo/pull/1#issuecomment-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.commentEditDetector.detect.mockResolvedValue({
        wasEdited: true,
        newClassification: CodeRabbitCommentType.review_approved,
        updatedCommentRow: makeCoderabbitCommentRow({ url: reviewUrl, comment_type: CodeRabbitCommentType.review_approved }),
      });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.queue.markReviewed).toHaveBeenCalledWith(item.id, {});
      expect(deps.pullRequests.updateLastCoderabbitReviewResult).toHaveBeenCalledWith(
        item.pull_request_id,
        reviewUrl,
        CodeRabbitCommentType.review_approved,
        {},
      );
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', reviewUrl, {});
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('uses changes_suggested event type when edit result classification is review_changes_suggested', async () => {
      const item = makeRetriggeredItem({});
      const reviewUrl = `https://github.com/org/repo/pull/1#issuecomment-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.commentEditDetector.detect.mockResolvedValue({
        wasEdited: true,
        newClassification: CodeRabbitCommentType.review_changes_suggested,
        updatedCommentRow: makeCoderabbitCommentRow({ url: reviewUrl, comment_type: CodeRabbitCommentType.review_changes_suggested }),
      });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.updateLastCoderabbitReviewResult).toHaveBeenCalledWith(
        item.pull_request_id,
        reviewUrl,
        CodeRabbitCommentType.review_changes_suggested,
        {},
      );
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_changes_suggested', reviewUrl, {});
    });

    it('deactivates comment and calls commentDeleted when fetchComment gets 404', async () => {
      const item = makeRetriggeredItem({});
      const notFoundError = { status: 404 };

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.commentEditDetector.detect.mockRejectedValue(notFoundError);

      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.commentDeleted).toHaveBeenCalled();
      expect(deps.commentRepo.deactivate).toHaveBeenCalledWith(item.source_comment_id);
    });

    it('calls commentNotEdited and continues with normal flow when edit result is wasEdited false', async () => {
      const item = makeRetriggeredItem({});
      const { owner, repo } = splitRepo(item.repo_full_name);
      const reviewUrl = `https://github.com/org/repo/pull/1#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.commentEditDetector.detect.mockResolvedValue({
        wasEdited: false,
        newClassification: CodeRabbitCommentType.review_limited,
        updatedCommentRow: makeCoderabbitCommentRow({ url: 'https://gh/c/1' }),
      });
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: true });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.commentNotEdited).toHaveBeenCalled();
      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(owner, repo, item.pr_number, item.retriggered_at);
      expect(deps.queue.markReviewed).toHaveBeenCalledWith(item.id, {});
    });

    it('calls commentNotEdited and continues when edit detection returns undefined', async () => {
      const item = makeRetriggeredItem({});
      const { owner, repo } = splitRepo(item.repo_full_name);
      const reviewUrl = `https://github.com/org/repo/pull/1#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.commentEditDetector.detect.mockResolvedValue(undefined);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: true });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.commentNotEdited).toHaveBeenCalled();
      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(owner, repo, item.pr_number, item.retriggered_at);
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

    it('delegates per-item errors to probe and continues processing remaining items', async () => {
      const item1 = makeRetriggeredItem({ repo_full_name: 'org-a/repo-a', pr_number: 1 });
      const item2 = makeRetriggeredItem({ repo_full_name: 'org-b/repo-b', pr_number: 2 });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item1, item2]);

      const perItemError = new Error('findCompletedReview failed');
      deps.github.findCompletedReview.mockRejectedValueOnce(perItemError).mockResolvedValueOnce(undefined);
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.caughtError).toHaveBeenCalledWith(perItemError);
      expect(deps.probeFactory.createReviewDetectorProbe).toHaveBeenCalledTimes(1);
      expect(deps.github.findCompletedReview).toHaveBeenCalledTimes(2);
    });

    it('rethrows non-404 errors from edit detection via probe', async () => {
      const item = makeRetriggeredItem({});
      const editError = new Error('API unavailable');
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.commentEditDetector.detect.mockRejectedValue(editError);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.caughtError).toHaveBeenCalledWith(editError);
    });
  });
});
