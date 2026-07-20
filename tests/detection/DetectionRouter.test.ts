import { DetectionRouterImpl } from '../../src/detection/DetectionRouter.js';
import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';
import type { OnDetectedCallback } from '../../src/types/OnDetectedCallback.js';
import { QueueStatus } from '../../src/types/QueueStatus.js';
import {
  createMockCoderabbitCommentRepo,
  createMockOnDetectedCallback,
  createMockPrismaClient,
  createMockPullRequestRepo,
  createMockQueueRepo,
  makeDetectedComment,
} from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const FALLBACK_WAIT_SEC = 3600;
const MS_PER_SECOND = 1000;

interface MockDeps {
  completionGuard: { hasCompletedReview: jest.Mock<any> };
  queue: ReturnType<typeof createMockQueueRepo>;
  pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  commentRepo: ReturnType<typeof createMockCoderabbitCommentRepo>;
  prisma: { $transaction: jest.Mock<any> };
  onDetected: jest.Mocked<OnDetectedCallback>;
  config: { REVIEW_LIMIT_FALLBACK_WAIT_SEC: number };
  logger: ReturnType<typeof createMockLogger>;
}

const setup = (): MockDeps => {
  const completionGuard = { hasCompletedReview: jest.fn<any>().mockResolvedValue(false) };
  const queue = createMockQueueRepo();
  const pullRequests = createMockPullRequestRepo();
  (pullRequests as any).updateLastCoderabbitReviewResult = jest.fn<any>();
  const commentRepo = createMockCoderabbitCommentRepo();
  const prismaMock = createMockPrismaClient();
  const prisma = { $transaction: prismaMock.prisma.$transaction as jest.Mock<any> };
  const onDetected = createMockOnDetectedCallback();
  const config = { REVIEW_LIMIT_FALLBACK_WAIT_SEC: FALLBACK_WAIT_SEC };
  const logger = createMockLogger();

  return { completionGuard, queue, pullRequests, commentRepo, prisma, onDetected, config, logger };
};

describe('DetectionRouter', () => {
  let deps: MockDeps;

  beforeEach(() => {
    deps = setup();
    deps.prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  });

  const createRouter = () =>
    new DetectionRouterImpl(
      deps.completionGuard as any,
      deps.queue as any,
      deps.pullRequests as any,
      deps.commentRepo as any,
      deps.prisma as any,
      deps.onDetected,
      deps.config as any,
      deps.logger as any,
    );

  describe('handleUnknown', () => {
    it('returns undefined and logs for unclassified comments', async () => {
      const comment = makeDetectedComment({ body: 'some random text', commentType: CodeRabbitCommentType.unknown });
      const router = createRouter();
      const result = await router.route(comment);
      expect(result).toBeUndefined();
      expect(deps.onDetected).not.toHaveBeenCalled();
    });
  });

  describe('handleReviewLimited', () => {
    it('returns undefined when comment has own retrigger marker', async () => {
      const comment = makeDetectedComment({ body: 'rate limited by coderabbit.ai <!-- rabbit-maximizer', commentType: CodeRabbitCommentType.review_limited });
      const router = createRouter();
      const result = await router.route(comment);
      expect(result).toBeUndefined();
      expect(deps.onDetected).not.toHaveBeenCalled();
    });

    it('returns undefined when ReEnqueueEvaluator returns skip', async () => {
      const comment = makeDetectedComment({
        body: 'rate limited by coderabbit.ai Please wait 5 minutes.',
        commentType: CodeRabbitCommentType.review_limited,
      });
      deps.queue.findBySourceCommentId.mockResolvedValue({ id: 1, status: QueueStatus.pending } as any);
      const router = createRouter();
      const result = await router.route(comment);
      expect(result).toBeUndefined();
      expect(deps.onDetected).not.toHaveBeenCalled();
    });

    it('returns undefined when guard reports already reviewed', async () => {
      const comment = makeDetectedComment({
        body: 'rate limited by coderabbit.ai Please wait 5 minutes.',
        commentType: CodeRabbitCommentType.review_limited,
      });
      deps.queue.findBySourceCommentId.mockResolvedValue({ id: 1, status: QueueStatus.reviewed } as any);
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: getUniqueInt() });
      deps.completionGuard.hasCompletedReview.mockResolvedValue(true);
      const router = createRouter();
      const result = await router.route(comment);
      expect(result).toBeUndefined();
      expect(deps.onDetected).not.toHaveBeenCalled();
    });

    it('forwards to onDetected and returns candidate date for fall_through', async () => {
      const updatedAt = getUniqueDate();
      const comment = makeDetectedComment({
        body: 'rate limited by coderabbit.ai Please wait 5 minutes and 30 seconds before requesting another review.',
        commentType: CodeRabbitCommentType.review_limited,
        updatedAt: updatedAt.toISOString(),
      });
      deps.queue.findBySourceCommentId.mockResolvedValue(undefined);
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: getUniqueInt() });

      const router = createRouter();
      const result = await router.route(comment);

      const expectedWait = 5 * 60 + 30;
      const expectedDate = new Date(updatedAt.getTime() + expectedWait * MS_PER_SECOND);
      expect(result).toStrictEqual(expectedDate);
      expect(deps.onDetected).toHaveBeenCalledWith(comment, expectedWait);
    });

    it('uses fallback wait when parseWaitSeconds returns undefined', async () => {
      const updatedAt = getUniqueDate();
      const comment = makeDetectedComment({
        body: 'rate limited by coderabbit.ai but no wait time',
        commentType: CodeRabbitCommentType.review_limited,
        updatedAt: updatedAt.toISOString(),
      });
      deps.queue.findBySourceCommentId.mockResolvedValue(undefined);
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: getUniqueInt() });

      const router = createRouter();
      const result = await router.route(comment);

      const expectedDate = new Date(updatedAt.getTime() + FALLBACK_WAIT_SEC * MS_PER_SECOND);
      expect(result).toStrictEqual(expectedDate);
      expect(deps.onDetected).toHaveBeenCalledWith(comment, FALLBACK_WAIT_SEC);
    });
  });

  describe('handleReviewSkipped', () => {
    it('forwards to onDetected with fallback wait and returns undefined', async () => {
      const comment = makeDetectedComment({
        body: '<!-- skip review by coderabbit.ai -->',
        commentType: CodeRabbitCommentType.review_skipped,
      });
      deps.pullRequests.findByRepoAndPr.mockResolvedValue({ id: getUniqueInt() });

      const router = createRouter();
      const result = await router.route(comment);

      expect(result).toBeUndefined();
      expect(deps.onDetected).toHaveBeenCalledWith(comment, FALLBACK_WAIT_SEC);
    });
  });

  describe('handleCompletedReview', () => {
    it('marks reviewed when existing queue item found', async () => {
      const comment = makeDetectedComment({
        body: 'Actionable comments posted: 3',
        commentType: CodeRabbitCommentType.review_changes_suggested,
      });
      const existingItem = {
        id: getUniqueInt(),
        pull_request_id: getUniqueInt(),
        uuid: getUuid(),
        repo_full_name: comment.repoFullName,
        pr_number: comment.prNumber,
        pr_title: comment.prTitle,
        status: 'pending',
        attempts: 0,
        source_comment_url: comment.url,
        source_comment_id: comment.commentId,
        trigger_source: 'scheduler',
        created_at: getUniqueDate(),
        updated_at: getUniqueDate(),
      };
      deps.queue.findBySourceCommentId.mockResolvedValue(existingItem as any);

      const router = createRouter();
      const result = await router.route(comment);

      expect(result).toBeUndefined();
      expect(deps.queue.markReviewed).toHaveBeenCalledWith(existingItem.id, {});
      expect(deps.pullRequests.updateLastCoderabbitReviewResult).toHaveBeenCalledWith(
        existingItem.pull_request_id,
        comment.url,
        CodeRabbitCommentType.review_changes_suggested,
        {},
      );
      expect(deps.onDetected).not.toHaveBeenCalled();
    });

    it('returns undefined when no existing queue item found', async () => {
      const comment = makeDetectedComment({
        body: 'No actionable comments were generated in the recent review.',
        commentType: CodeRabbitCommentType.review_approved,
      });
      deps.queue.findBySourceCommentId.mockResolvedValue(undefined);

      const router = createRouter();
      const result = await router.route(comment);

      expect(result).toBeUndefined();
      expect(deps.queue.markReviewed).not.toHaveBeenCalled();
    });
  });
});
