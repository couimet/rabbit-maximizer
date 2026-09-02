import { config } from '../src/config.js';
import { CodeRabbitCommentType } from '../src/domain.js';
import type { DetectedProbe, ProbeFactory } from '../src/probes/index.js';
import { EnqueueService } from '../src/services.js';
import { MS_PER_SECOND } from '../src/utils/index.js';

import { createMockCoderabbitCommentRepo } from './helpers/createMockCoderabbitCommentRepo.js';
import {
  createMockDetectedProbe,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  generateCoderabbitCommentHydrationData,
  generateDetectedCommentHydrationData,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const FOR_TEST_SKIP_BODY = 'skip review by coderabbit.ai';

describe('EnqueueService', () => {
  let frozenNow: Date;
  let queue: ReturnType<typeof createMockQueueRepo>;
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let probes: ProbeFactory;
  let coderabbitComments: ReturnType<typeof createMockCoderabbitCommentRepo>;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: ReturnType<typeof createMockDetectedProbe>;

  beforeEach(() => {
    jest.useFakeTimers();
    frozenNow = getUniqueDate();
    jest.setSystemTime(frozenNow);
    queue = createMockQueueRepo({ enqueue: jest.fn<any>().mockResolvedValue({ item: {}, created: true }) });

    pullRequests = createMockPullRequestRepo();

    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<(fn: (client: Prisma.TransactionClient) => unknown) => unknown>().mockImplementation((fn) => fn(tx)),
    } as unknown as PrismaClient;

    probe = createMockDetectedProbe();
    probes = createMockProbeFactory({ createDetectedProbe: jest.fn().mockReturnValue(probe as unknown as DetectedProbe) });

    coderabbitComments = createMockCoderabbitCommentRepo();
  });

  const createService = () => new EnqueueService(queue, pullRequests, prisma, probes, coderabbitComments);

  describe('handle', () => {
    it('creates probe, enqueues, and completes probe in a transaction with pullRequestId', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const pullRequestId = getUniqueInt();
      const expectedCooldownUntil = new Date(new Date(comment.updatedAt).getTime() + config.REVIEW_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND);

      await svc.handle(comment, pullRequestId);

      expect(probes.createDetectedProbe).toHaveBeenCalledWith({
        repo_full_name: comment.repoFullName,
        pr_number: comment.prNumber,
        source_ts: new Date(comment.createdAt),
        source_comment_url: comment.url,
        coderabbit_run_id: undefined,
      });
      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(pullRequests.recordReviewLimitDetection).toHaveBeenCalledWith(pullRequestId, frozenNow, tx);
      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
          commentUpdatedAt: new Date(comment.updatedAt),
          cooldownUntil: expectedCooldownUntil,
          sourceCommentType: 'unknown',
          pullRequestId,
        },
        tx,
      );
      expect(probe.enqueued).toHaveBeenCalledWith(tx);
    });

    it('persists the comment via coderabbitComments.upsert after classification', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData({
        body: 'No actionable comments were generated in the recent review.',
      });
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(coderabbitComments.upsert).toHaveBeenCalledWith(
        {
          comment_id: comment.commentId,
          pull_request_id: pullRequestId,
          url: comment.url,
          comment_type: 'review_approved',
          body: comment.body,
          gh_created_at: new Date(comment.createdAt),
          gh_updated_at: new Date(comment.updatedAt),
          coderabbit_run_id: null,
        },
        tx,
      );
    });

    it('dismisses the comment but still upserts it when the existing review is newer', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData({ body: 'rate limited by coderabbit.ai' });
      const reviewComment = generateCoderabbitCommentHydrationData({
        comment_id: getUniqueInt(),
        url: getUniqueString({ prefix: 'https://gh/' }),
        comment_type: CodeRabbitCommentType.review_approved,
        gh_updated_at: new Date(new Date(comment.updatedAt).getTime() + 60 * MS_PER_SECOND),
      });
      coderabbitComments.findCompletedReview.mockResolvedValueOnce(reviewComment);
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(coderabbitComments.findCompletedReview).toHaveBeenCalledWith(pullRequestId);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(coderabbitComments.upsert).toHaveBeenCalledWith(
        {
          comment_id: comment.commentId,
          pull_request_id: pullRequestId,
          url: comment.url,
          comment_type: 'review_limited',
          body: comment.body,
          gh_created_at: new Date(comment.createdAt),
          gh_updated_at: new Date(comment.updatedAt),
          coderabbit_run_id: null,
        },
        tx,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(probe.alreadyReviewed).toHaveBeenCalledWith(reviewComment);
    });

    it('proceeds past the guard when the comment is newer than the existing review', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData({ body: FOR_TEST_SKIP_BODY });
      const reviewComment = generateCoderabbitCommentHydrationData({
        comment_id: getUniqueInt(),
        url: getUniqueString({ prefix: 'https://gh/' }),
        comment_type: CodeRabbitCommentType.review_approved,
        gh_updated_at: new Date(new Date(comment.updatedAt).getTime() - 60 * MS_PER_SECOND),
      });
      coderabbitComments.findCompletedReview.mockResolvedValueOnce(reviewComment);
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(coderabbitComments.findCompletedReview).toHaveBeenCalledWith(pullRequestId);
      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
          commentUpdatedAt: new Date(comment.updatedAt),
          cooldownUntil: undefined,
          sourceCommentType: 'review_skipped',
          pullRequestId,
        },
        tx,
      );
      expect(probe.alreadyReviewed).not.toHaveBeenCalled();
      expect(probe.skipped).toHaveBeenCalledWith(tx);
    });

    it('proceeds with enqueue when findCompletedReview returns no existing review', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(coderabbitComments.findCompletedReview).toHaveBeenCalledWith(pullRequestId);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('skips enqueued when enqueue returns created: false', async () => {
      (queue.enqueue as jest.Mock<any>).mockResolvedValue({ item: {}, created: false });
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(probe.detected).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(queue.enqueue).toHaveBeenCalled();
      expect(probe.enqueued).not.toHaveBeenCalled();
      expect(probe.alreadyQueued).toHaveBeenCalled();
    });

    it('schedules the enqueue based on comment.updated_at and wait', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const pullRequestId = getUniqueInt();
      const expectedCooldownUntil = new Date(new Date(comment.updatedAt).getTime() + config.REVIEW_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND);

      await svc.handle(comment, pullRequestId);

      expect(queue.enqueue).toHaveBeenCalledWith(
        {
          repo: comment.repoFullName,
          pr: comment.prNumber,
          prTitle: comment.prTitle,
          sourceCommentUrl: comment.url,
          sourceCommentId: comment.commentId,
          commentUpdatedAt: new Date(comment.updatedAt),
          cooldownUntil: expectedCooldownUntil,
          sourceCommentType: 'unknown',
          pullRequestId,
        },
        tx,
      );
    });

    describe('skip path', () => {
      it('enqueues with the skip comment as source and records the skipped encounter', async () => {
        const coderabbitRunId = getUuid();
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({
          body: `${FOR_TEST_SKIP_BODY}\n\n**Run ID**: \`${coderabbitRunId}\``,
        });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(probe.detected).toHaveBeenCalled();
        expect(pullRequests.recordReviewLimitDetection).toHaveBeenCalledWith(pullRequestId, frozenNow, tx);
        expect(coderabbitComments.upsert).toHaveBeenCalledWith(
          {
            comment_id: comment.commentId,
            pull_request_id: pullRequestId,
            url: comment.url,
            comment_type: 'review_skipped',
            body: comment.body,
            gh_created_at: new Date(comment.createdAt),
            gh_updated_at: new Date(comment.updatedAt),
            coderabbit_run_id: coderabbitRunId,
          },
          tx,
        );
        expect(queue.enqueue).toHaveBeenCalledWith(
          {
            repo: comment.repoFullName,
            pr: comment.prNumber,
            prTitle: comment.prTitle,
            sourceCommentUrl: comment.url,
            sourceCommentId: comment.commentId,
            coderabbitRunId,
            commentUpdatedAt: new Date(comment.updatedAt),
            cooldownUntil: undefined,
            sourceCommentType: 'review_skipped',
            pullRequestId,
          },
          tx,
        );
        expect(probe.enqueued).toHaveBeenCalledWith(tx);
        expect(probe.skipped).toHaveBeenCalledWith(tx);
      });

      it('drives alreadyQueued and still records the skipped encounter when enqueue returns created: false', async () => {
        (queue.enqueue as jest.Mock<any>).mockResolvedValue({ item: {}, created: false });
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: FOR_TEST_SKIP_BODY });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(queue.enqueue).toHaveBeenCalled();
        expect(probe.enqueued).not.toHaveBeenCalled();
        expect(probe.alreadyQueued).toHaveBeenCalled();
        expect(probe.skipped).toHaveBeenCalledWith(tx);
      });
    });

    describe('verdict path', () => {
      it('does not enqueue review_approved comments and records the review', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({
          body: 'No actionable comments were generated in the recent review.',
        });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(pullRequests.recordReview).toHaveBeenCalledWith(pullRequestId, comment.url, 'review_approved', undefined, tx);
        expect(probe.verdictResolved).toHaveBeenCalledWith(tx, 'review_approved');
        expect(queue.enqueue).not.toHaveBeenCalled();
      });

      it('does not enqueue review_changes_suggested comments and records the review', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({
          body: 'Actionable comments posted:',
        });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(pullRequests.recordReview).toHaveBeenCalledWith(pullRequestId, comment.url, 'review_changes_suggested', undefined, tx);
        expect(probe.verdictResolved).toHaveBeenCalledWith(tx, 'review_changes_suggested');
        expect(queue.enqueue).not.toHaveBeenCalled();
      });

      it('still enqueues review_limited (non-verdict) comments', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({
          body: 'rate limited by coderabbit.ai',
        });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(queue.enqueue).toHaveBeenCalled();
        expect(pullRequests.recordReview).not.toHaveBeenCalled();
        expect(probe.verdictResolved).not.toHaveBeenCalled();
      });
    });
  });
});
