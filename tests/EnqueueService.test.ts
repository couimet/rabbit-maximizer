import { config } from '../src/config.js';
import type { ObservationContextProvider } from '../src/observability/index.js';
import type { DetectedProbe, ProbeFactory } from '../src/probes/index.js';
import { EnqueueService } from '../src/services.js';
import { MS_PER_SECOND } from '../src/utils/index.js';

import { createMockCoderabbitCommentRepo } from './helpers/createMockCoderabbitCommentRepo.js';
import {
  createMockDetectedProbe,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  generateDetectedCommentHydrationData,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const FOR_TEST_SKIP_BODY = 'skip review by coderabbit.ai';

describe('EnqueueService', () => {
  let frozenNow: Date;
  let queue: ReturnType<typeof createMockQueueRepo>;
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let probes: ProbeFactory;
  let observation: ObservationContextProvider;
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

    observation = {
      current: jest.fn().mockReturnValue({ correlationId: getUuid(), requestId: getUuid(), version: '1.0.0' }),
    } as unknown as ObservationContextProvider;
  });

  const createService = () => new EnqueueService(queue, pullRequests, prisma, probes, coderabbitComments, observation);

  describe('handle', () => {
    it('creates probe, enqueues, and completes probe in a transaction with pullRequestId', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const pullRequestId = getUniqueInt();
      const expectedCooldownUntil = new Date(new Date(comment.updatedAt).getTime() + config.REVIEW_LIMIT_FALLBACK_WAIT_SEC * MS_PER_SECOND);

      await svc.handle(comment, pullRequestId);

      expect(probes.createDetectedProbe).toHaveBeenCalledWith(
        {
          repo_full_name: comment.repoFullName,
          pr_number: comment.prNumber,
          source_ts: new Date(comment.createdAt),
          source_comment_url: comment.url,
          coderabbit_run_id: undefined,
        },
        observation.current(),
      );
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

    it('skips enqueue when existing review_approved comment is found', async () => {
      const reviewComment = { id: 1, comment_id: 99, url: 'https://gh/1', comment_type: 'review_approved' } as never;
      coderabbitComments.findCompletedReview.mockResolvedValueOnce(reviewComment);
      const svc = createService();
      const comment = generateDetectedCommentHydrationData();
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(coderabbitComments.findCompletedReview).toHaveBeenCalledWith(pullRequestId);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(probe.alreadyReviewed).toHaveBeenCalledWith(reviewComment);
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
            commentUpdatedAt: new Date(comment.updatedAt),
            cooldownUntil: undefined,
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

        expect(pullRequests.recordReview).toHaveBeenCalledWith(pullRequestId, comment.url, 'review_approved', tx);
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

        expect(pullRequests.recordReview).toHaveBeenCalledWith(pullRequestId, comment.url, 'review_changes_suggested', tx);
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
