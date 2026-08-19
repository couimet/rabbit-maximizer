import { QueueStatus, TriggerSource } from '../src/domain.js';
import { StaleCommentRescheduledError } from '../src/errors/index.js';
import type { CoderabbitGitHubClient } from '../src/github/index.js';
import { ReviewTrigger } from '../src/services.js';

import {
  createMockProbeFactory,
  createMockPullRequestRepo,
  createMockQueueRepo,
  createMockReviewRetriggerProbe,
  createMockSystemStateRepository,
  generateQueueItemHydrationData,
  generateReviewRef,
} from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

const ACCOUNT_COOLDOWN_SEC = 3600;
const MS_PER_SECOND = 1000;
const ACCOUNT_COOLDOWN_MS = ACCOUNT_COOLDOWN_SEC * MS_PER_SECOND;

const setup = () => {
  const github = {
    fetchComment: jest.fn(),
    fetchCommentByUrl: jest.fn(),
    findLatestReviewLimitComment: jest.fn(),
    postRetrigger: jest.fn(),
  } as unknown as jest.Mocked<CoderabbitGitHubClient>;
  const probeFactory = createMockProbeFactory({ createReviewRetriggerProbe: jest.fn() });
  const queue = createMockQueueRepo();
  const pullRequests = createMockPullRequestRepo();
  const systemState = createMockSystemStateRepository();
  const tx = {} as Prisma.TransactionClient;
  const prisma = { $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)) } as unknown as PrismaClient;
  const logger = createMockLogger();
  const cfg = { CODERABBIT_ACCOUNT_COOLDOWN_SEC: ACCOUNT_COOLDOWN_SEC, REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600, REVIEW_LIMIT_BUFFER_SEC: 60 } as any;

  const reviewTrigger = new ReviewTrigger(github, probeFactory, queue, pullRequests, prisma, systemState, cfg, logger);

  return { github, probeFactory, prisma, tx, logger, reviewTrigger, queue, pullRequests, systemState };
};

const makeFetchResult = (body: string) => ({ body, createdAt: getUniqueDate().toISOString(), updatedAt: getUniqueDate().toISOString() });

describe('ReviewTrigger', () => {
  let commentUrl: string;
  let staleCommentId: number;
  let newCommentId: number;
  let newCommentUrl: string;
  let frozenNow: Date;

  beforeEach(() => {
    commentUrl = getUniqueString({ prefix: 'https://gh/c/retriggered-' });
    staleCommentId = getUniqueInt();
    newCommentId = getUniqueInt();
    newCommentUrl = getUniqueString({ prefix: 'https://gh/c/new-comment-' });
    frozenNow = getUniqueDate();
    jest.useFakeTimers();
    jest.setSystemTime(frozenNow);
  });

  it('returns ok with retriggeredCommentUrl when source comment is valid (dashboard, no diagnosis)', async () => {
    const { github, probeFactory, logger, reviewTrigger, queue, pullRequests, tx, systemState } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    github.fetchComment.mockResolvedValue(makeFetchResult('rate limited by coderabbit.ai'));
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.dashboard_retrigger_now);

    expect(result).toBeSuccess({ retriggeredCommentUrl: commentUrl });
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
    expect(pullRequests.incrementRetriggerCount).toHaveBeenCalledWith(item.pull_request_id, tx);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId: expect.any(String) as unknown as string },
      'Posting retrigger',
    );
    expect(github.postRetrigger).toHaveBeenCalledWith(
      item.repo_full_name,
      item.pr_number,
      item.source_comment_url,
      expect.any(String) as unknown as string,
      'dashboard_retrigger_now',
      undefined,
    );
    expect(systemState.setNextReviewAvailableAt).toHaveBeenCalledWith(new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), tx);
  });

  it('returns ok and passes diagnosis when source comment is valid (scheduler)', async () => {
    const { github, probeFactory, logger, reviewTrigger, queue, tx } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    const createdAt = getUniqueDate().toISOString();
    const updatedAt = getUniqueDate().toISOString();
    github.fetchComment.mockResolvedValue({ body: 'rate limited by coderabbit.ai', createdAt, updatedAt });
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(true);
    expect(github.postRetrigger).toHaveBeenCalledWith(
      item.repo_full_name,
      item.pr_number,
      item.source_comment_url,
      expect.any(String) as unknown as string,
      'scheduler',
      {
        sourceComment: {
          url: item.source_comment_url,
          createdAt,
          updatedAt,
          classification: 'review_limited',
          matchedMarker: 'rate limited by coderabbit.ai',
        },
        waitSeconds: undefined,
        decision: 'source',
      },
    );
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId: expect.any(String) as unknown as string },
      'Posting retrigger',
    );
  });

  it('returns err with RETRIGGER_STALE_COMMENT_SKIP when no replacement found and source body is non-empty', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    github.fetchComment.mockResolvedValue(makeFetchResult('stale body without rate-limit marker'));
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(probe.staleCommentSkipped).toHaveBeenCalled();
    expect(result).toHaveDetailedError('RETRIGGER_STALE_COMMENT_SKIP', {
      message: 'No replacement rate-limit comment found',
      functionName: 'ReviewTrigger.trigger',
    });
  });

  it('posts retrigger without reply target and passes direct diagnosis when source comment is deleted and no replacement exists', async () => {
    const { github, probeFactory, reviewTrigger, queue, tx, logger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    github.fetchComment.mockRejectedValue({ status: 404 });
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result).toBeSuccess({ retriggeredCommentUrl: commentUrl });
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id },
      'No review-limit comment found; posting retrigger without a reply target',
    );
    expect(github.postRetrigger).toHaveBeenCalledWith(item.repo_full_name, item.pr_number, undefined, expect.any(String) as unknown as string, 'scheduler', {
      sourceComment: {
        url: item.source_comment_url,
        createdAt: '',
        updatedAt: '',
        classification: 'unknown',
        matchedMarker: undefined,
      },
      waitSeconds: undefined,
      decision: 'direct',
    });
  });

  it('posts retrigger without diagnosis when source comment is deleted and no replacement exists (dashboard)', async () => {
    const { github, probeFactory, reviewTrigger, queue, tx } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    github.fetchComment.mockRejectedValue({ status: 404 });
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.dashboard_retrigger_now);

    expect(result.success).toBe(true);
    expect(github.postRetrigger).toHaveBeenCalledWith(
      item.repo_full_name,
      item.pr_number,
      undefined,
      expect.any(String) as unknown as string,
      'dashboard_retrigger_now',
      undefined,
    );
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
  });

  it('returns err with RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED when replacement is deleted', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    const replacementRef = generateReviewRef();
    github.fetchComment.mockResolvedValueOnce(makeFetchResult('stale body'));
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: replacementRef.repoFullName,
      prNumber: replacementRef.prNumber,
      createdAt: getUniqueDate().toISOString(),
      updatedAt: getUniqueDate().toISOString(),
    });
    github.fetchComment.mockRejectedValueOnce({ status: 404 });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(probe.staleCommentReplacementDeleted).toHaveBeenCalledWith(newCommentId);
    expect(result).toHaveDetailedError('RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED', {
      message: 'Replacement comment was deleted before fetch',
      functionName: 'ReviewTrigger.trigger',
    });
  });

  it('returns err with RETRIGGER_STALE_COMMENT_RESCHEDULE when source comment was replaced', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    const replacementRef = generateReviewRef();
    const updatedAt = frozenNow;
    const waitSeconds = 3600;
    const bufferSeconds = 60;
    const rescheduleEarliest = new Date(updatedAt.getTime() + (waitSeconds + bufferSeconds) * MS_PER_SECOND);
    const sourceFetch = makeFetchResult('stale body');
    github.fetchComment.mockResolvedValueOnce(sourceFetch);
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: replacementRef.repoFullName,
      prNumber: replacementRef.prNumber,
      createdAt: getUniqueDate().toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    github.fetchComment.mockResolvedValueOnce(makeFetchResult('[rate limit](...) wait 3600 seconds'));
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(probe.staleCommentRescheduled).toHaveBeenCalledWith(rescheduleEarliest);
    expect(result).toHaveDetailedError('RETRIGGER_STALE_COMMENT_RESCHEDULE', {
      message: 'Source comment was replaced; item must be rescheduled',
      functionName: 'ReviewTrigger.trigger',
    });
    expect(result.error).toBeInstanceOf(StaleCommentRescheduledError);
    const err = result.error as StaleCommentRescheduledError;
    expect(err.sourceComment).toStrictEqual({ commentId: newCommentId, commentUrl: newCommentUrl });
    expect(err.originalSource).toStrictEqual({
      url: item.source_comment_url,
      createdAt: sourceFetch.createdAt,
      updatedAt: sourceFetch.updatedAt,
      classification: 'unknown',
      matchedMarker: undefined,
    });
    expect(err.rescheduleEarliest).toStrictEqual(rescheduleEarliest);
  });

  it('preserves the first source comment url across repeated replacements in the reschedule error', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({
      source_comment_id: staleCommentId,
      status: QueueStatus.pending,
      original_source_comment_url: 'https://github.com/gh-owner-1/gh-repo-2/pull/3#issuecomment-99',
    });
    const replacementRef = generateReviewRef();
    const sourceFetch = makeFetchResult('stale body');
    github.fetchComment.mockResolvedValueOnce(sourceFetch);
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: replacementRef.repoFullName,
      prNumber: replacementRef.prNumber,
      createdAt: getUniqueDate().toISOString(),
      updatedAt: getUniqueDate().toISOString(),
    });
    github.fetchComment.mockResolvedValueOnce(makeFetchResult('[rate limit](...) wait 3600 seconds'));
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result).toHaveDetailedError('RETRIGGER_STALE_COMMENT_RESCHEDULE', {
      message: 'Source comment was replaced; item must be rescheduled',
      functionName: 'ReviewTrigger.trigger',
    });
    const err = result.error as StaleCommentRescheduledError;
    expect(err.originalSource).toStrictEqual({
      url: item.original_source_comment_url,
      createdAt: sourceFetch.createdAt,
      updatedAt: sourceFetch.updatedAt,
      classification: 'unknown',
      matchedMarker: undefined,
    });
  });

  it('throws when fetchComment fails with non-terminal error', async () => {
    const { github, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    github.fetchComment.mockRejectedValue({ status: 500 });

    await expect(reviewTrigger.trigger(item, TriggerSource.scheduler)).rejects.toStrictEqual({ status: 500 });
  });

  it('throws when replacement comment fetch fails with non-terminal error', async () => {
    const { github, reviewTrigger } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    const replacementRef = generateReviewRef();
    github.fetchComment.mockResolvedValueOnce(makeFetchResult('stale body'));
    github.findLatestReviewLimitComment.mockResolvedValue({
      commentId: newCommentId,
      url: newCommentUrl,
      repoFullName: replacementRef.repoFullName,
      prNumber: replacementRef.prNumber,
      createdAt: getUniqueDate().toISOString(),
      updatedAt: getUniqueDate().toISOString(),
    });
    github.fetchComment.mockRejectedValueOnce({ status: 500 });

    await expect(reviewTrigger.trigger(item, TriggerSource.scheduler)).rejects.toStrictEqual({ status: 500 });
  });

  it('returns err with RETRIGGER_ITEM_NOT_PENDING when item is not pending', async () => {
    const { github, probeFactory, reviewTrigger, logger } = setup();
    const item = generateQueueItemHydrationData({ status: QueueStatus.retriggered });

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result).toHaveDetailedError('RETRIGGER_ITEM_NOT_PENDING', {
      message: 'Item is not in pending status',
      functionName: 'ReviewTrigger.trigger',
      details: { status: 'retriggered' },
    });
    expect(logger.warn).toHaveBeenCalledWith({ fn: 'ReviewTrigger.trigger', queueId: item.id, status: 'retriggered' }, 'Item not pending; refusing to trigger');
    expect(github.fetchComment).not.toHaveBeenCalled();
    expect(github.postRetrigger).not.toHaveBeenCalled();
    expect(probeFactory.createReviewRetriggerProbe).not.toHaveBeenCalled();
  });

  it('builds replacement diagnosis when item has original_source_comment_url', async () => {
    const { github, probeFactory, logger, reviewTrigger, queue, tx } = setup();
    const item = generateQueueItemHydrationData({
      source_comment_id: staleCommentId,
      status: QueueStatus.pending,
      original_source_comment_url: 'https://github.com/gh-owner-1/gh-repo-2/pull/3#issuecomment-99',
    });
    const replacementCreatedAt = getUniqueDate().toISOString();
    const replacementUpdatedAt = getUniqueDate().toISOString();
    const originalCreatedAt = getUniqueDate().toISOString();
    const originalUpdatedAt = getUniqueDate().toISOString();
    github.fetchComment.mockResolvedValue({
      body: 'rate limited by coderabbit.ai Please wait 10 minutes before requesting another review.',
      createdAt: replacementCreatedAt,
      updatedAt: replacementUpdatedAt,
    });
    github.fetchCommentByUrl.mockResolvedValue({
      body: 'rate limited by coderabbit.ai',
      createdAt: originalCreatedAt,
      updatedAt: originalUpdatedAt,
    });
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(true);
    expect(github.postRetrigger).toHaveBeenCalledWith(
      item.repo_full_name,
      item.pr_number,
      item.source_comment_url,
      expect.any(String) as unknown as string,
      'scheduler',
      {
        sourceComment: {
          url: item.original_source_comment_url,
          createdAt: originalCreatedAt,
          updatedAt: originalUpdatedAt,
          classification: 'review_limited',
          matchedMarker: 'rate limited by coderabbit.ai',
        },
        replacementComment: {
          url: item.source_comment_url,
          createdAt: replacementCreatedAt,
          updatedAt: replacementUpdatedAt,
          classification: 'review_limited',
          matchedMarker: 'rate limited by coderabbit.ai',
        },
        waitSeconds: 600,
        decision: 'replacement',
      },
    );
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId: expect.any(String) as unknown as string },
      'Posting retrigger',
    );
  });

  it('falls back to empty diagnosis when original source comment returns 404', async () => {
    const { github, probeFactory, logger, reviewTrigger, queue, tx } = setup();
    const item = generateQueueItemHydrationData({
      source_comment_id: staleCommentId,
      status: QueueStatus.pending,
      original_source_comment_url: 'https://github.com/gh-owner-1/gh-repo-2/pull/3#issuecomment-99',
    });
    const replacementCreatedAt = getUniqueDate().toISOString();
    const replacementUpdatedAt = getUniqueDate().toISOString();
    github.fetchComment.mockResolvedValue({
      body: 'rate limited by coderabbit.ai',
      createdAt: replacementCreatedAt,
      updatedAt: replacementUpdatedAt,
    });
    github.fetchCommentByUrl.mockRejectedValue({ status: 404 });
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(true);
    expect(github.postRetrigger).toHaveBeenCalledWith(
      item.repo_full_name,
      item.pr_number,
      item.source_comment_url,
      expect.any(String) as unknown as string,
      'scheduler',
      {
        sourceComment: {
          url: item.original_source_comment_url,
          createdAt: '',
          updatedAt: '',
          classification: 'unknown',
          matchedMarker: undefined,
        },
        replacementComment: {
          url: item.source_comment_url,
          createdAt: replacementCreatedAt,
          updatedAt: replacementUpdatedAt,
          classification: 'review_limited',
          matchedMarker: 'rate limited by coderabbit.ai',
        },
        waitSeconds: undefined,
        decision: 'replacement',
      },
    );
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
    expect(logger.info).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.trigger', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id, runId: expect.any(String) as unknown as string },
      'Posting retrigger',
    );
  });

  it('falls back to empty diagnosis and logs warn when original source comment fetch fails with server error', async () => {
    const { github, probeFactory, logger, reviewTrigger, queue, tx } = setup();
    const item = generateQueueItemHydrationData({
      source_comment_id: staleCommentId,
      status: QueueStatus.pending,
      original_source_comment_url: 'https://github.com/gh-owner-1/gh-repo-2/pull/3#issuecomment-99',
    });
    const replacementCreatedAt = getUniqueDate().toISOString();
    const replacementUpdatedAt = getUniqueDate().toISOString();
    const fetchError = { status: 500 };
    github.fetchComment.mockResolvedValue({
      body: 'rate limited by coderabbit.ai',
      createdAt: replacementCreatedAt,
      updatedAt: replacementUpdatedAt,
    });
    github.fetchCommentByUrl.mockRejectedValue(fetchError);
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'ReviewTrigger.buildReplacementDiagnosis', originalUrl: item.original_source_comment_url, error: fetchError },
      'Failed to fetch original source comment; falling back to empty diagnosis',
    );
    expect(github.postRetrigger).toHaveBeenCalledWith(
      item.repo_full_name,
      item.pr_number,
      item.source_comment_url,
      expect.any(String) as unknown as string,
      'scheduler',
      {
        sourceComment: {
          url: item.original_source_comment_url,
          createdAt: '',
          updatedAt: '',
          classification: 'unknown',
          matchedMarker: undefined,
        },
        replacementComment: {
          url: item.source_comment_url,
          createdAt: replacementCreatedAt,
          updatedAt: replacementUpdatedAt,
          classification: 'review_limited',
          matchedMarker: 'rate limited by coderabbit.ai',
        },
        waitSeconds: undefined,
        decision: 'replacement',
      },
    );
    expect(queue.markRetriggered).toHaveBeenCalledWith(item.id, new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS), commentUrl, tx);
  });

  it('preserves existing later cooldown when bumping nextReviewAvailableAt', async () => {
    const { github, probeFactory, reviewTrigger, systemState, tx } = setup();
    const item = generateQueueItemHydrationData({ source_comment_id: staleCommentId, status: QueueStatus.pending });
    const laterCooldown = new Date(frozenNow.getTime() + ACCOUNT_COOLDOWN_MS * 2);
    systemState.getNextReviewAvailableAt.mockResolvedValue(laterCooldown);
    github.fetchComment.mockResolvedValue(makeFetchResult('rate limited by coderabbit.ai'));
    github.postRetrigger.mockResolvedValue({ htmlUrl: commentUrl });
    const probe = createMockReviewRetriggerProbe();
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(systemState.setNextReviewAvailableAt).toHaveBeenCalledWith(laterCooldown, tx);
  });
});
