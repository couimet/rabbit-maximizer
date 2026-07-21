import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { ReviewTrigger } from '../src/ReviewTrigger.js';
import { TriggerSource } from '../src/types/index.js';

import { createMockProbeFactory } from './helpers/createMockProbeFactory.js';
import { createMockPullRequestRepo, createMockQueueRepo, generateQueueItemHydrationData } from './helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

const POST_COOLDOWN_SEC = 3600;

const setup = () => {
  const github = {
    fetchComment: jest.fn(),
    findLatestReviewLimitComment: jest.fn(),
    postRetrigger: jest.fn(),
  } as unknown as jest.Mocked<CoderabbitGitHubClient>;
  const probeFactory = createMockProbeFactory({ createReviewRetriggerProbe: jest.fn() });
  const queue = createMockQueueRepo();
  const pullRequests = createMockPullRequestRepo();
  const tx = {} as Prisma.TransactionClient;
  const prisma = { $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)) } as unknown as PrismaClient;
  const logger = createMockLogger();
  const cfg = { SCHEDULER_POST_COOLDOWN_SEC: POST_COOLDOWN_SEC, REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600, REVIEW_LIMIT_BUFFER_SEC: 60 } as any;

  const reviewTrigger = new ReviewTrigger(github, probeFactory, queue, pullRequests, prisma, cfg, logger);

  return { github, probeFactory, prisma, tx, logger, reviewTrigger, queue, pullRequests };
};

describe('ReviewTrigger', () => {
  let commentUrl: string;
  let staleCommentId: number;
  let newCommentId: number;
  let newCommentUrl: string;

  beforeEach(() => {
    commentUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
    staleCommentId = getUniqueInt();
    newCommentId = getUniqueInt();
    newCommentUrl = getUniqueString({ prefix: 'https://gh/c/new-comment-' });
  });

  it('returns ok with retriggeredCommentUrl when source comment is valid', async () => {
    const { github, probeFactory, logger, reviewTrigger, queue, pullRequests } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockResolvedValue({ body: 'rate limited by coderabbit.ai', updatedAt: getUniqueDate().toISOString() });
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.dashboard_retrigger_now);

    expect(result.success).toBe(true);
    expect(result.value).toStrictEqual({ retriggeredCommentUrl: commentUrl });
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, expect.any(Date), commentUrl, expect.anything());
    expect(pullRequests.incrementRetriggerCount).toHaveBeenCalledWith(item.pull_request_id, expect.anything());
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId: expect.any(String) as unknown as string },
      'Posting retrigger',
    );
  });

  it('returns err with RETRIGGER_STALE_COMMENT_SKIP when no replacement found', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockResolvedValue({ body: 'stale body without rate-limit marker', updatedAt: getUniqueDate().toISOString() });
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(probe.staleCommentSkipped).toHaveBeenCalled();
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_SKIP');
  });

  it('returns err with RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED when replacement is deleted', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockResolvedValueOnce({ body: 'stale body', updatedAt: getUniqueDate().toISOString() });
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: getUniqueGitHubRepoRef().fullName,
      prNumber: getUniqueInt(),
      createdAt: getUniqueDate().toISOString(),
      updatedAt: getUniqueDate().toISOString(),
    });
    github.fetchComment.mockRejectedValueOnce({ status: 404 });
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(probe.staleCommentReplacementDeleted).toHaveBeenCalledWith(newCommentId);
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED');
  });

  it('returns err with RETRIGGER_STALE_COMMENT_RESCHEDULE when source comment was replaced', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockResolvedValueOnce({ body: 'stale body', updatedAt: getUniqueDate().toISOString() });
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: getUniqueGitHubRepoRef().fullName,
      prNumber: getUniqueInt(),
      createdAt: getUniqueDate().toISOString(),
      updatedAt: getUniqueDate().toISOString(),
    });
    github.fetchComment.mockResolvedValueOnce({ body: '[rate limit](...) wait 3600 seconds', updatedAt: getUniqueDate().toISOString() });
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(probe.staleCommentRescheduled).toHaveBeenCalledWith(expect.any(Date));
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_RESCHEDULE');
  });

  it('returns err when stored comment was deleted (404)', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockRejectedValueOnce({ status: 404 });
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_SKIP');
  });

  it('throws when fetchComment fails with non-terminal error', async () => {
    const { github, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockRejectedValue({ status: 500 });

    await expect(reviewTrigger.trigger(item, TriggerSource.scheduler)).rejects.toStrictEqual({ status: 500 });
  });

  it('throws when replacement comment fetch fails with non-terminal error', async () => {
    const { github, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId });
    github.fetchComment.mockResolvedValueOnce({ body: 'stale body', updatedAt: getUniqueDate().toISOString() });
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: getUniqueGitHubRepoRef().fullName,
      prNumber: getUniqueInt(),
      createdAt: getUniqueDate().toISOString(),
      updatedAt: getUniqueDate().toISOString(),
    });
    github.fetchComment.mockRejectedValueOnce({ status: 500 });

    await expect(reviewTrigger.trigger(item, TriggerSource.scheduler)).rejects.toStrictEqual({ status: 500 });
  });
});
