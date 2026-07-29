import { CodeRabbitCommentType, FallbackReason, PrState, QueueStatus, TriggerSource } from '../src/domain.js';
import type { EditDetector } from '../src/EditDetector.js';
import { buildCommentUrl, type CoderabbitGitHubClient } from '../src/github/index.js';
import { RabbitResult } from '../src/RabbitResult.js';
import { ReviewDetector } from '../src/services.js';
import type { QueueItem } from '../src/types/index.js';

import {
  createMockCoderabbitGitHubClient,
  createMockEditDetector,
  createMockProbeFactory,
  createMockQueueRepo,
  createMockReviewDetectorProbe,
  generateReviewRef,
} from './helpers/index.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

const POLL_INTERVAL_SEC = 90;
const POLL_INTERVAL_MS = POLL_INTERVAL_SEC * 1000;
const LOOKBACK_SEC = 7200;
const LOOKBACK_MS = LOOKBACK_SEC * 1000;
const TICK_DEPTH = 20;

const drainMicrotasks = async (depth: number): Promise<void> => {
  for (let i = 0; i < depth; i++) {
    await Promise.resolve();
  }
};

interface MockReviewDetectorDeps {
  queue: { getRetriggeredQueue: jest.Mock<any>; markResolved: jest.Mock<any> };
  pullRequests: { recordReview: jest.Mock<any>; getColumnMaps: jest.Mock<any> };
  github: jest.Mocked<CoderabbitGitHubClient>;
  editDetector: jest.Mocked<EditDetector>;
  probeFactory: ReturnType<typeof createMockProbeFactory>;
  probe: ReturnType<typeof createMockReviewDetectorProbe>;
  prisma: { $transaction: jest.Mock<any> };
  logger: Logger;
  config: { POLL_INTERVAL_SEC: number; REVIEW_DETECTION_LOOKBACK_SEC: number };
}

const makeRetriggeredItem = (overrides?: Partial<QueueItem> & { commentId?: number }): QueueItem => {
  const { commentId: overrideCommentId, ...rest } = overrides ?? {};
  const commentId = overrideCommentId ?? getUniqueInt();
  const ref = generateReviewRef();
  const defaults: QueueItem = {
    id: getUniqueInt(),
    uuid: getUuid(),
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
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

const setup = (): MockReviewDetectorDeps => {
  const queue = createMockQueueRepo() as unknown as MockReviewDetectorDeps['queue'];
  const pullRequests = {
    recordReview: jest.fn<any>(),
    getColumnMaps: jest.fn<any>().mockResolvedValue({ pr_state: new Map(), last_coderabbit_review_at: new Map() }),
  };
  const github = createMockCoderabbitGitHubClient();
  const editDetector = createMockEditDetector({
    detectEdit: jest.fn<any>().mockResolvedValue(RabbitResult.ok({ action: 'fallback', reason: FallbackReason.NotFound })),
  });
  const probe = createMockReviewDetectorProbe();
  const probeFactory = createMockProbeFactory({ createReviewDetectorProbe: jest.fn<any>().mockReturnValue(probe) });
  const prisma = { $transaction: jest.fn<any>() };
  const logger = createMockLogger();
  const config = { POLL_INTERVAL_SEC: POLL_INTERVAL_SEC, REVIEW_DETECTION_LOOKBACK_SEC: LOOKBACK_SEC };
  return { queue, pullRequests, github, editDetector, probeFactory, probe, prisma, logger, config };
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
      deps.editDetector,
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
    it('records coderabbit_review_approved when completed review is an approval', async () => {
      const retriggeredAt = getUniqueDate();
      const lookbackSince = new Date(retriggeredAt.getTime() - LOOKBACK_MS);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewId = getUniqueInt();
      const completedCommentUrl = `https://github.com/${ref.repoFullName}/pull/${ref.prNumber}#pullrequestreview-${reviewId}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: completedCommentUrl, reviewId, isApproval: true });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(ref.owner, ref.repo, ref.prNumber, lookbackSince);
      expect(deps.probeFactory.createReviewDetectorProbe).toHaveBeenCalledTimes(1);
      expect(deps.probe.withItem).toHaveBeenCalledWith(item);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.pullRequests.recordReview).toHaveBeenCalledWith(item.pull_request_id, completedCommentUrl, 'review_approved', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', completedCommentUrl, {});
    });

    it('records coderabbit_review_changes_suggested when completed review is not an approval', async () => {
      const retriggeredAt = getUniqueDate();
      const lookbackSince = new Date(retriggeredAt.getTime() - LOOKBACK_MS);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewId = getUniqueInt();
      const completedCommentUrl = `https://github.com/${ref.repoFullName}/pull/${ref.prNumber}#pullrequestreview-${reviewId}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: completedCommentUrl, reviewId, isApproval: false });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(ref.owner, ref.repo, ref.prNumber, lookbackSince);
      expect(deps.pullRequests.recordReview).toHaveBeenCalledWith(item.pull_request_id, completedCommentUrl, 'review_changes_suggested', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_changes_suggested', completedCommentUrl, {});
    });

    it('skips item when no completed review is found and last_coderabbit_review_at is null', async () => {
      const item = makeRetriggeredItem({});
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.withItem).toHaveBeenCalledWith(item);
      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
      expect(deps.probe.reviewed).not.toHaveBeenCalled();
      expect(deps.probe.reviewedViaFallback).not.toHaveBeenCalled();
      expect(deps.queue.markResolved).not.toHaveBeenCalled();
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

  describe('pr state filtering', () => {
    it('auto-resolves a retriggered item when PR is merged, skipping API calls', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: new Map([[item.pull_request_id, PrState.merged]]), last_coderabbit_review_at: new Map() });
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_review_at']);
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'pr_merged', {});
      expect(deps.probe.prClosedResolved).toHaveBeenCalledWith('merged');
    });

    it('auto-resolves a retriggered item when PR is closed, skipping API calls', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: new Map([[item.pull_request_id, PrState.closed]]), last_coderabbit_review_at: new Map() });
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_review_at']);
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'pr_closed_without_merge', {});
      expect(deps.probe.prClosedResolved).toHaveBeenCalledWith('closed');
    });

    it('proceeds with API calls when PR is open', async () => {
      const retriggeredAt = getUniqueDate();
      const lookbackSince = new Date(retriggeredAt.getTime() - LOOKBACK_MS);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = `https://github.com/${ref.repoFullName}/pull/${ref.prNumber}#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: new Map([[item.pull_request_id, PrState.open]]), last_coderabbit_review_at: new Map() });
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: true });
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_review_at']);
      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(ref.owner, ref.repo, ref.prNumber, lookbackSince);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', reviewUrl, {});
      expect(deps.probe.prClosedResolved).not.toHaveBeenCalled();
    });

    it('resolves merged items while continuing to process open items in the same batch', async () => {
      const retriggeredAt = getUniqueDate();
      const mergedItem = makeRetriggeredItem({ retriggered_at: retriggeredAt, pull_request_id: 100, repo_full_name: 'org-a/repo-a', pr_number: 1 });
      const openItem = makeRetriggeredItem({ retriggered_at: retriggeredAt, pull_request_id: 200, repo_full_name: 'org-b/repo-b', pr_number: 2 });
      deps.queue.getRetriggeredQueue.mockResolvedValue([mergedItem, openItem]);

      const prStateMap = new Map<number, PrState>();
      prStateMap.set(mergedItem.pull_request_id, PrState.merged);
      prStateMap.set(openItem.pull_request_id, PrState.open);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: prStateMap, last_coderabbit_review_at: new Map() });

      deps.github.findCompletedReview.mockResolvedValue(undefined);
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.queue.markResolved).toHaveBeenCalledWith(mergedItem.id, 'pr_merged', {});
      expect(deps.probe.prClosedResolved).toHaveBeenCalledWith('merged');
      expect(deps.github.findCompletedReview).toHaveBeenCalledTimes(1);
      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
    });

    it('auto-resolves a retriggered item when PR is merged, skipping API calls', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: new Map([[item.pull_request_id, PrState.merged]]), last_coderabbit_review_at: new Map() });
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_review_at']);
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'pr_merged', {});
      expect(deps.probe.prClosedResolved).toHaveBeenCalledWith('merged');
    });

    it('auto-resolves a retriggered item when PR is closed, skipping API calls', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: new Map([[item.pull_request_id, PrState.closed]]), last_coderabbit_review_at: new Map() });
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_review_at']);
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'pr_closed_without_merge', {});
      expect(deps.probe.prClosedResolved).toHaveBeenCalledWith('closed');
    });

    it('proceeds with API calls when PR is open', async () => {
      const retriggeredAt = getUniqueDate();
      const lookbackSince = new Date(retriggeredAt.getTime() - LOOKBACK_MS);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = `https://github.com/${ref.repoFullName}/pull/${ref.prNumber}#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: new Map([[item.pull_request_id, PrState.open]]), last_coderabbit_review_at: new Map() });
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: true });
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.pullRequests.getColumnMaps).toHaveBeenCalledWith([item.pull_request_id], ['pr_state', 'last_coderabbit_review_at']);
      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(ref.owner, ref.repo, ref.prNumber, lookbackSince);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', reviewUrl, {});
      expect(deps.probe.prClosedResolved).not.toHaveBeenCalled();
    });

    it('resolves merged items while continuing to process open items in the same batch', async () => {
      const retriggeredAt = getUniqueDate();
      const mergedItem = makeRetriggeredItem({ retriggered_at: retriggeredAt, pull_request_id: 100, repo_full_name: 'org-a/repo-a', pr_number: 1 });
      const openItem = makeRetriggeredItem({ retriggered_at: retriggeredAt, pull_request_id: 200, repo_full_name: 'org-b/repo-b', pr_number: 2 });
      deps.queue.getRetriggeredQueue.mockResolvedValue([mergedItem, openItem]);

      const prStateMap = new Map<number, PrState>();
      prStateMap.set(mergedItem.pull_request_id, PrState.merged);
      prStateMap.set(openItem.pull_request_id, PrState.open);
      deps.pullRequests.getColumnMaps.mockResolvedValue({ pr_state: prStateMap, last_coderabbit_review_at: new Map() });

      deps.github.findCompletedReview.mockResolvedValue(undefined);
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.queue.markResolved).toHaveBeenCalledWith(mergedItem.id, 'pr_merged', {});
      expect(deps.probe.prClosedResolved).toHaveBeenCalledWith('merged');
      expect(deps.github.findCompletedReview).toHaveBeenCalledTimes(1);
      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
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

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.caughtError).toHaveBeenCalledWith(perItemError);
      expect(deps.probeFactory.createReviewDetectorProbe).toHaveBeenCalledTimes(1);
      expect(deps.github.findCompletedReview).toHaveBeenCalledTimes(2);
    });
  });

  describe('lookback window', () => {
    it('finds a review within the lookback window when review was posted before retriggered_at', async () => {
      const retriggeredAt = getUniqueDate();
      const lookbackSince = new Date(retriggeredAt.getTime() - LOOKBACK_MS);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = `https://github.com/${ref.repoFullName}/pull/${ref.prNumber}#pullrequestreview-${getUniqueInt()}`;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue({ htmlUrl: reviewUrl, reviewId: getUniqueInt(), isApproval: true });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(ref.owner, ref.repo, ref.prNumber, lookbackSince);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', reviewUrl, {});
    });

    it('uses last_coderabbit_review_at fallback when API returns nothing and column value is within the lookback window', async () => {
      const retriggeredAt = getUniqueDate();
      const lookbackSince = new Date(retriggeredAt.getTime() - LOOKBACK_MS);
      const lastCoderabbitReviewAt = new Date(retriggeredAt.getTime() - 1000);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);
      deps.pullRequests.getColumnMaps.mockResolvedValue({
        pr_state: new Map([[item.pull_request_id, PrState.open]]),
        last_coderabbit_review_at: new Map([[item.pull_request_id, lastCoderabbitReviewAt]]),
      });

      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).toHaveBeenCalledWith(ref.owner, ref.repo, ref.prNumber, lookbackSince);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.probe.reviewedViaFallback).toHaveBeenCalledWith({});
      expect(deps.probe.reviewed).not.toHaveBeenCalled();
      expect(deps.probe.noCompletedReviewFound).not.toHaveBeenCalled();
    });

    it('calls noCompletedReviewFound when API returns nothing and last_coderabbit_review_at is null', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);
      deps.pullRequests.getColumnMaps.mockResolvedValue({
        pr_state: new Map([[item.pull_request_id, PrState.open]]),
        last_coderabbit_review_at: new Map([[item.pull_request_id, null]]),
      });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
      expect(deps.queue.markResolved).not.toHaveBeenCalled();
      expect(deps.probe.reviewedViaFallback).not.toHaveBeenCalled();
    });

    it('calls noCompletedReviewFound when API returns nothing and last_coderabbit_review_at is outside the lookback window', async () => {
      const retriggeredAt = getUniqueDate();
      const lastCoderabbitReviewAt = new Date(retriggeredAt.getTime() - LOOKBACK_MS - 60_000);
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.github.findCompletedReview.mockResolvedValue(undefined);
      deps.pullRequests.getColumnMaps.mockResolvedValue({
        pr_state: new Map([[item.pull_request_id, PrState.open]]),
        last_coderabbit_review_at: new Map([[item.pull_request_id, lastCoderabbitReviewAt]]),
      });

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
      expect(deps.queue.markResolved).not.toHaveBeenCalled();
      expect(deps.probe.reviewedViaFallback).not.toHaveBeenCalled();
    });
  });

  describe('edit detection', () => {
    it('delegates to editDetector and resolves queue item on resolved outcome', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = buildCommentUrl(ref.repoFullName, ref.prNumber, item.source_comment_id);
      const editOutcome = {
        action: 'resolved' as const,
        reviewUrl,
        verdictState: CodeRabbitCommentType.review_approved as CodeRabbitCommentType.review_approved,
      };

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok(editOutcome));
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.editDetector.detectEdit).toHaveBeenCalledWith(item);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.pullRequests.recordReview).toHaveBeenCalledWith(item.pull_request_id, reviewUrl, 'review_approved', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_approved', reviewUrl, {});
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('delegates to editDetector and resolves on changes_suggested outcome', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = buildCommentUrl(ref.repoFullName, ref.prNumber, item.source_comment_id);
      const editOutcome = {
        action: 'resolved' as const,
        reviewUrl,
        verdictState: CodeRabbitCommentType.review_changes_suggested as CodeRabbitCommentType.review_changes_suggested,
      };

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok(editOutcome));
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.editDetector.detectEdit).toHaveBeenCalledWith(item);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'review_completed', {});
      expect(deps.pullRequests.recordReview).toHaveBeenCalledWith(item.pull_request_id, reviewUrl, 'review_changes_suggested', {});
      expect(deps.probe.reviewed).toHaveBeenCalledWith('coderabbit_review_changes_suggested', reviewUrl, {});
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('falls through to Reviews API when editDetector returns fallback', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok({ action: 'fallback', reason: FallbackReason.NotFound }));
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.editDetector.detectEdit).toHaveBeenCalledWith(item);
      expect(deps.github.findCompletedReview).toHaveBeenCalled();
      expect(deps.probe.noCompletedReviewFound).toHaveBeenCalled();
    });

    it('does not call Reviews API after a resolved edit outcome', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = buildCommentUrl(ref.repoFullName, ref.prNumber, item.source_comment_id);
      const editOutcome = {
        action: 'resolved' as const,
        reviewUrl,
        verdictState: CodeRabbitCommentType.review_approved as CodeRabbitCommentType.review_approved,
      };

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok(editOutcome));
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('resolves queue item with Resolution.Skipped when editDetector returns skipped outcome', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const reviewUrl = buildCommentUrl(ref.repoFullName, ref.prNumber, item.source_comment_id);

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok({ action: 'skipped', reviewUrl }));
      deps.prisma.$transaction.mockImplementation((fn: (_tx: object) => unknown) => fn({}));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.editDetector.detectEdit).toHaveBeenCalledWith(item);
      expect(deps.queue.markResolved).toHaveBeenCalledWith(item.id, 'skipped', {});
      expect(deps.pullRequests.recordReview).not.toHaveBeenCalled();
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('passes item to editDetector', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok({ action: 'fallback', reason: FallbackReason.NotFound }));
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.editDetector.detectEdit).toHaveBeenCalledWith(item);
    });

    it('calls probe.editDetectionFailed and falls through when detectEdit returns error', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const errorResult = RabbitResult.err({ code: 'TEST', message: 'fail' } as any);

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(errorResult);
      deps.github.findCompletedReview.mockResolvedValue(undefined);

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      expect(deps.editDetector.detectEdit).toHaveBeenCalledWith(item);
      expect(deps.probe.editDetectionFailed).toHaveBeenCalledWith(errorResult.error);
      expect(deps.github.findCompletedReview).not.toHaveBeenCalled();
    });

    it('throws on unexpected edit outcome action and catches via caughtError', async () => {
      const retriggeredAt = getUniqueDate();
      const ref = generateReviewRef();
      const item = makeRetriggeredItem({ retriggered_at: retriggeredAt, repo_full_name: ref.repoFullName, pr_number: ref.prNumber });
      const badOutcome = { action: 'future_action_type', reviewUrl: 'u', verdictState: CodeRabbitCommentType.review_approved } as any;

      deps.queue.getRetriggeredQueue.mockResolvedValue([item]);
      deps.editDetector.detectEdit.mockResolvedValue(RabbitResult.ok(badOutcome));

      const detector = createDetector();
      detector.start();

      await drainMicrotasks(TICK_DEPTH);

      const caughtError = deps.probe.caughtError.mock.calls[0]?.[0];
      expect(caughtError).toBeDetailedError('UNEXPECTED_SWITCH_VALUE', {
        message: 'Unexpected edit outcome action: "future_action_type"',
        functionName: 'ReviewDetector.executeTick',
        details: { unexpectedValue: 'future_action_type' },
      });
    });
  });
});
