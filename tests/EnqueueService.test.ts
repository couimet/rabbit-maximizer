import { config } from '../src/config.js';
import { CodeRabbitCommentType } from '../src/domain.js';
import type { CoderabbitCommentClassifier } from '../src/github/index.js';
import type { DetectedProbe, ProbeFactory } from '../src/probes/index.js';
import { EnqueueService, IgnoreRules } from '../src/services.js';
import { MS_PER_SECOND } from '../src/utils/index.js';

import { createMockCoderabbitCommentRepo } from './helpers/createMockCoderabbitCommentRepo.js';
import {
  createCoderabbitCommentClassifier,
  createMockDetectedProbe,
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  generateCoderabbitCommentHydrationData,
  generateConfigData,
  generateDetectedCommentHydrationData,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { type Prisma, type PrismaClient } from '@prisma/client';

const FOR_TEST_SKIP_BODY = 'skip review by coderabbit.ai';
const APPROVAL_BODY = 'No actionable comments were generated in the recent review.';
const RATE_LIMIT_BODY = 'rate limited by coderabbit.ai';
const CHANGES_SUGGESTED_BODY = 'Actionable comments posted:';
const BODY_START_OFFSET = 0;
const REFUSAL_PREFIX = 'CodeRabbit cannot review this PR ';
const REFUSAL_PHRASE = config.CODERABBIT_REFUSAL_PHRASES[0];
const FOR_TEST_REFUSAL_BODY = `${REFUSAL_PREFIX}${REFUSAL_PHRASE}.`;

describe('EnqueueService', () => {
  let frozenNow: Date;
  let queue: ReturnType<typeof createMockQueueRepo>;
  let pullRequests: ReturnType<typeof createMockPullRequestRepo>;
  let probes: ProbeFactory;
  let coderabbitComments: ReturnType<typeof createMockCoderabbitCommentRepo>;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let probe: ReturnType<typeof createMockDetectedProbe>;
  let classifier: CoderabbitCommentClassifier;
  let ignoreRules: IgnoreRules;

  beforeEach(() => {
    classifier = createCoderabbitCommentClassifier();
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
    ignoreRules = new IgnoreRules(generateConfigData());
  });

  const createService = () => new EnqueueService(queue, pullRequests, prisma, probes, coderabbitComments, classifier, ignoreRules);

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
        detectedVia: comment.detectedVia,
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
      const comment = generateDetectedCommentHydrationData({ body: APPROVAL_BODY });
      const pullRequestId = getUniqueInt();

      await svc.handle(comment, pullRequestId);

      expect(coderabbitComments.upsert).toHaveBeenCalledWith(
        {
          comment_id: comment.commentId,
          pull_request_id: pullRequestId,
          url: comment.url,
          comment_type: 'review_approved',
          body: comment.body,
          matched_phrase: APPROVAL_BODY,
          matched_offset: BODY_START_OFFSET,
          gh_created_at: new Date(comment.createdAt),
          gh_updated_at: new Date(comment.updatedAt),
          coderabbit_run_id: null,
        },
        tx,
      );
    });

    it('dismisses the comment but still upserts it when the existing review is newer', async () => {
      const svc = createService();
      const comment = generateDetectedCommentHydrationData({ body: RATE_LIMIT_BODY });
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
          matched_phrase: RATE_LIMIT_BODY,
          matched_offset: BODY_START_OFFSET,
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
      expect(probe.skipped).toHaveBeenCalledWith(tx, FOR_TEST_SKIP_BODY, BODY_START_OFFSET);
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
            matched_phrase: FOR_TEST_SKIP_BODY,
            matched_offset: BODY_START_OFFSET,
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
        expect(probe.skipped).toHaveBeenCalledWith(tx, FOR_TEST_SKIP_BODY, BODY_START_OFFSET);
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
        expect(probe.skipped).toHaveBeenCalledWith(tx, FOR_TEST_SKIP_BODY, BODY_START_OFFSET);
      });
    });

    describe('refusal path', () => {
      it('marks the PR refused, resolves the active item, records the refusal event, and never enqueues', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: FOR_TEST_REFUSAL_BODY });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(coderabbitComments.findCompletedReview).toHaveBeenCalledWith(pullRequestId);
        expect(pullRequests.recordReviewLimitDetection).toHaveBeenCalledWith(pullRequestId, frozenNow, tx);
        expect(coderabbitComments.upsert).toHaveBeenCalledWith(
          {
            comment_id: comment.commentId,
            pull_request_id: pullRequestId,
            url: comment.url,
            comment_type: 'review_refused',
            body: comment.body,
            matched_phrase: REFUSAL_PHRASE,
            matched_offset: REFUSAL_PREFIX.length,
            gh_created_at: new Date(comment.createdAt),
            gh_updated_at: new Date(comment.updatedAt),
            coderabbit_run_id: null,
          },
          tx,
        );
        expect(pullRequests.setPermanentRefusalAt).toHaveBeenCalledWith(pullRequestId, tx);
        expect(queue.markResolvedByPullRequestId).toHaveBeenCalledWith(pullRequestId, 'permanently_refused', tx);
        expect(probe.refused).toHaveBeenCalledWith(tx, REFUSAL_PHRASE, REFUSAL_PREFIX.length);
        expect(queue.enqueue).not.toHaveBeenCalled();
        expect(probe.enqueued).not.toHaveBeenCalled();
        expect(probe.skipped).not.toHaveBeenCalled();
        expect(probe.verdictResolved).not.toHaveBeenCalled();
      });
    });

    describe('exclusion path', () => {
      const IGNORE_AUTHOR = 'renovate';

      const withAuthorRule = () => {
        ignoreRules = new IgnoreRules(generateConfigData({ IGNORE_AUTHORS: [IGNORE_AUTHOR] }));
      };

      it('resolves the active item, records the excluded event, and never enqueues', async () => {
        withAuthorRule();
        const svc = createService();
        const comment = generateDetectedCommentHydrationData();
        const pullRequestId = getUniqueInt();
        pullRequests.findIgnoreRuleTarget.mockResolvedValue({ authorLogin: `${IGNORE_AUTHOR}-bot`, title: getUniqueString() });
        queue.markResolvedByPullRequestId.mockResolvedValue(1);

        await svc.handle(comment, pullRequestId);

        expect(pullRequests.findIgnoreRuleTarget).toHaveBeenCalledWith(pullRequestId);
        expect(pullRequests.recordReviewLimitDetection).toHaveBeenCalledWith(pullRequestId, frozenNow, tx);
        expect(queue.markResolvedByPullRequestId).toHaveBeenCalledWith(pullRequestId, 'excluded', tx);
        expect(probe.excluded).toHaveBeenCalledWith(tx, { field: 'author', pattern: IGNORE_AUTHOR });
        expect(queue.enqueue).not.toHaveBeenCalled();
        expect(probe.enqueued).not.toHaveBeenCalled();
        expect(probe.skipped).not.toHaveBeenCalled();
        expect(probe.refused).not.toHaveBeenCalled();
        expect(probe.alreadyExcluded).not.toHaveBeenCalled();
      });

      it('logs an already-excluded match when the resolution changes no row', async () => {
        withAuthorRule();
        const svc = createService();
        const comment = generateDetectedCommentHydrationData();
        const pullRequestId = getUniqueInt();
        pullRequests.findIgnoreRuleTarget.mockResolvedValue({ authorLogin: IGNORE_AUTHOR, title: getUniqueString() });
        queue.markResolvedByPullRequestId.mockResolvedValue(0);

        await svc.handle(comment, pullRequestId);

        expect(probe.alreadyExcluded).toHaveBeenCalledWith({ field: 'author', pattern: IGNORE_AUTHOR });
        expect(probe.excluded).not.toHaveBeenCalled();
        expect(queue.enqueue).not.toHaveBeenCalled();
      });

      it('reads the pull request row only when a rule is configured', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData();

        await svc.handle(comment, getUniqueInt());

        expect(pullRequests.findIgnoreRuleTarget).not.toHaveBeenCalled();
        expect(probe.excluded).not.toHaveBeenCalled();
      });

      it('continues to enqueue when the pull request row is missing', async () => {
        withAuthorRule();
        const svc = createService();
        const comment = generateDetectedCommentHydrationData();
        const pullRequestId = getUniqueInt();
        pullRequests.findIgnoreRuleTarget.mockResolvedValue(null);

        await svc.handle(comment, pullRequestId);

        expect(pullRequests.findIgnoreRuleTarget).toHaveBeenCalledWith(pullRequestId);
        expect(queue.markResolvedByPullRequestId).not.toHaveBeenCalled();
        expect(queue.enqueue).toHaveBeenCalled();
      });

      it('excludes ahead of the refusal branch when a comment is both excluded and refused', async () => {
        withAuthorRule();
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: FOR_TEST_REFUSAL_BODY });
        const pullRequestId = getUniqueInt();
        pullRequests.findIgnoreRuleTarget.mockResolvedValue({ authorLogin: IGNORE_AUTHOR, title: getUniqueString() });
        queue.markResolvedByPullRequestId.mockResolvedValue(1);

        await svc.handle(comment, pullRequestId);

        expect(queue.markResolvedByPullRequestId).toHaveBeenCalledWith(pullRequestId, 'excluded', tx);
        expect(pullRequests.setPermanentRefusalAt).not.toHaveBeenCalled();
        expect(probe.refused).not.toHaveBeenCalled();
        expect(probe.excluded).toHaveBeenCalledWith(tx, { field: 'author', pattern: IGNORE_AUTHOR });
      });
    });

    describe('verdict path', () => {
      it('does not enqueue review_approved comments and records the review', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: APPROVAL_BODY });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(pullRequests.recordReview).toHaveBeenCalledWith(pullRequestId, comment.url, 'review_approved', undefined, tx);
        expect(probe.verdictResolved).toHaveBeenCalledWith(tx, 'review_approved', APPROVAL_BODY, BODY_START_OFFSET);
        expect(queue.enqueue).not.toHaveBeenCalled();
      });

      it('does not enqueue review_changes_suggested comments and records the review', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: CHANGES_SUGGESTED_BODY });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(pullRequests.recordReview).toHaveBeenCalledWith(pullRequestId, comment.url, 'review_changes_suggested', undefined, tx);
        expect(probe.verdictResolved).toHaveBeenCalledWith(tx, 'review_changes_suggested', CHANGES_SUGGESTED_BODY, BODY_START_OFFSET);
        expect(queue.enqueue).not.toHaveBeenCalled();
      });

      it('still enqueues review_limited (non-verdict) comments', async () => {
        const svc = createService();
        const comment = generateDetectedCommentHydrationData({ body: RATE_LIMIT_BODY });
        const pullRequestId = getUniqueInt();

        await svc.handle(comment, pullRequestId);

        expect(queue.enqueue).toHaveBeenCalled();
        expect(pullRequests.recordReview).not.toHaveBeenCalled();
        expect(probe.verdictResolved).not.toHaveBeenCalled();
      });
    });
  });
});
