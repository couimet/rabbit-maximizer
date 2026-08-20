import { buildCommentUrl } from '../src/github/buildCommentUrl.js';
import { DirectCommentCheckerImpl } from '../src/services.js';
import type { OnDetectedCallback } from '../src/types/index.js';

import { createMockCoderabbitCommentRepo, createMockCoderabbitGitHubClient, createMockOnDetectedCallback, generateReviewRef } from './helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const SKIPPED_COMMENT_BODY = 'skip review by coderabbit.ai';
const APPROVED_COMMENT_BODY =
  'No actionable comments were generated in the recent review.\n\n<!-- rabbit-maximizer\n{"version":"0.1.0","triggerSource":"scheduler"}\n-->';
const REVIEW_LIMITED_BODY = 'rate limited by coderabbit.ai';
const REVIEW_LIMITED_WITH_WAIT = 'rate limited by coderabbit.ai\n\n**Next review available in:** **34 minutes**';
const ONE_MINUTE_MS = 60_000;

describe('DirectCommentCheckerImpl', () => {
  let github: ReturnType<typeof createMockCoderabbitGitHubClient>;
  let onDetected: jest.Mocked<OnDetectedCallback>;
  let coderabbitComments: ReturnType<typeof createMockCoderabbitCommentRepo>;
  let logger: ReturnType<typeof createMockLogger>;
  let checker: DirectCommentCheckerImpl;

  beforeEach(() => {
    github = createMockCoderabbitGitHubClient();
    onDetected = createMockOnDetectedCallback();
    coderabbitComments = createMockCoderabbitCommentRepo();
    coderabbitComments.findByCommentId.mockResolvedValue(undefined);
    logger = createMockLogger();
    checker = new DirectCommentCheckerImpl(github, onDetected, coderabbitComments, logger);
  });

  it('fetches comments and calls onDetected for rate-limit comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    const [owner, repo] = ref.repoFullName.split('/');
    expect(github.listComments).toHaveBeenCalledWith(owner, repo, ref.prNumber);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: REVIEW_LIMITED_BODY,
        commentType: 'review_limited',
      },
      pullRequestId,
    );
    expect(candidates).toStrictEqual([{ updatedAt: commentUpdatedAt, waitSeconds: undefined }]);
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('skips comments with unknown classification', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: 'regular comment', id: commentId, createdAt: getUniqueDate(), updatedAt: getUniqueDate() },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
    expect(candidates).toStrictEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentChecker.check', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment with unknown classification',
    );
  });

  it('detects review_skipped comments and calls onDetected', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: SKIPPED_COMMENT_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    const [owner, repo] = ref.repoFullName.split('/');
    expect(github.listComments).toHaveBeenCalledWith(owner, repo, ref.prNumber);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: SKIPPED_COMMENT_BODY,
        commentType: 'review_skipped',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('skips stale comments already processed and not edited since', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const lastSeenAt = new Date(commentUpdatedAt.getTime() + ONE_MINUTE_MS);
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_BODY, id: commentId, createdAt: commentUpdatedAt, updatedAt: commentUpdatedAt },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, commentId);
    expect(onDetected).not.toHaveBeenCalled();
    // Freshness gate sits around onDetected only — the candidates push stays ungated
    expect(candidates).toStrictEqual([{ updatedAt: commentUpdatedAt, waitSeconds: undefined }]);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'DirectCommentChecker.check', repo: ref.repoFullName, pr: ref.prNumber, commentId },
      'Skipping comment already processed and not edited since',
    );
  });

  it('calls onDetected for edited comments with updatedAt newer than last_seen_at', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const commentUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: SKIPPED_COMMENT_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);
    coderabbitComments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: SKIPPED_COMMENT_BODY,
        commentType: 'review_skipped',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('calls onDetected for first-seen comments with no stored row', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_BODY, id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(coderabbitComments.findByCommentId).toHaveBeenCalledWith(pullRequestId, commentId);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: REVIEW_LIMITED_BODY,
        commentType: 'review_limited',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('skips comments with own retrigger marker', async () => {
    const ref = generateReviewRef();
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: 'rate limited by coderabbit.ai\n\n<!-- rabbit-maximizer\n{"version":"0.1.0","triggerSource":"scheduler"}\n-->',
        id: getUniqueInt(),
        createdAt: getUniqueDate(),
        updatedAt: getUniqueDate(),
      },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('forwards review_approved comments with own retrigger marker (not skipped)', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      {
        user: 'coderabbitai[bot]',
        body: APPROVED_COMMENT_BODY,
        id: commentId,
        createdAt: commentCreatedAt,
        updatedAt: commentUpdatedAt,
      },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(onDetected).toHaveBeenCalledWith(
      {
        url: buildCommentUrl(ref.repoFullName, ref.prNumber, commentId),
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: APPROVED_COMMENT_BODY,
        commentType: 'review_approved',
      },
      pullRequestId,
    );
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('continues processing remaining PRs when listComments throws for one', async () => {
    const ref1 = generateReviewRef();
    const ref2 = generateReviewRef();
    const apiError = new Error('API error');
    const goodComment = {
      user: 'coderabbitai[bot]',
      body: 'rate limited by coderabbit.ai',
      id: getUniqueInt(),
      createdAt: getUniqueDate(),
      updatedAt: getUniqueDate(),
    };
    github.listComments.mockRejectedValueOnce(apiError).mockResolvedValueOnce([goodComment]);

    await checker.check([
      { repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, pullRequestId: getUniqueInt(), prTitle: ref1.prTitle },
      { repoFullName: ref2.repoFullName, prNumber: ref2.prNumber, pullRequestId: getUniqueInt(), prTitle: ref2.prTitle },
    ]);

    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DirectCommentChecker.check', repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, error: apiError },
      'Failed to direct-check PR comments; continuing',
    );
    expect(onDetected).toHaveBeenCalledTimes(1);
  });

  it('does nothing when input array is empty', async () => {
    const candidates = await checker.check([]);

    expect(github.listComments).not.toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
    expect(candidates).toStrictEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('skips non-CodeRabbit comments even when they contain the rate-limit marker', async () => {
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    github.listComments.mockResolvedValue([
      { user: 'some-other-user', body: 'rate limited by coderabbit.ai', id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('returns ReviewLimitCandidate with parsed waitSeconds for review_limited comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: REVIEW_LIMITED_WITH_WAIT, id: commentId, createdAt: getUniqueDate(), updatedAt: commentUpdatedAt },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(candidates).toStrictEqual([{ updatedAt: commentUpdatedAt, waitSeconds: 2040 }]);
    expect(onDetected).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('returns empty array for review_skipped comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    github.listComments.mockResolvedValue([
      { user: 'coderabbitai[bot]', body: SKIPPED_COMMENT_BODY, id: getUniqueInt(), createdAt: getUniqueDate(), updatedAt: getUniqueDate() },
    ]);

    const candidates = await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    expect(candidates).toStrictEqual([]);
    expect(onDetected).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found comments');
  });

  it('truncates and warns when PR count exceeds the direct-check limit', async () => {
    const ref = generateReviewRef();
    github.listComments.mockResolvedValue([]);
    const prs = Array.from({ length: 130 }, () => ({
      repoFullName: ref.repoFullName,
      prNumber: getUniqueInt(),
      pullRequestId: getUniqueInt(),
      prTitle: ref.prTitle,
    }));

    await checker.check(prs);

    expect(github.listComments).toHaveBeenCalledTimes(125);
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'DirectCommentChecker.check', prCount: 130, maxDirectCheckPRs: 125 },
      'PR count exceeds direct-check limit; truncating to prevent API rate-limit exhaustion',
    );
  });
});
