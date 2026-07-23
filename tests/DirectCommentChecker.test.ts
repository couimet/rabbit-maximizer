import { DirectCommentCheckerImpl } from '../src/services.js';
import type { OnDetectedCallback } from '../src/types/index.js';

import { createMockCoderabbitGitHubClient, createMockOnDetectedCallback, generateReviewRef } from './helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('DirectCommentCheckerImpl', () => {
  let github: ReturnType<typeof createMockCoderabbitGitHubClient>;
  let onDetected: jest.Mocked<OnDetectedCallback>;
  let logger: ReturnType<typeof createMockLogger>;
  let checker: DirectCommentCheckerImpl;

  beforeEach(() => {
    github = createMockCoderabbitGitHubClient();
    onDetected = createMockOnDetectedCallback();
    logger = createMockLogger();
    checker = new DirectCommentCheckerImpl(github, onDetected, logger);
  });

  it('fetches comments and calls onDetected for rate-limit comments', async () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const commentCreatedAt = getUniqueDate();
    const commentUpdatedAt = getUniqueDate();
    const commentId = getUniqueInt();
    github.listComments.mockResolvedValue([{ body: 'rate limited by coderabbit.ai', id: commentId, createdAt: commentCreatedAt, updatedAt: commentUpdatedAt }]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);

    const [owner, repo] = ref.repoFullName.split('/');
    expect(github.listComments).toHaveBeenCalledWith(owner, repo, ref.prNumber);
    expect(onDetected).toHaveBeenCalledWith(
      {
        url: `https://github.com/${ref.repoFullName}/pull/${ref.prNumber}#issuecomment-${commentId}`,
        repoFullName: ref.repoFullName,
        prNumber: ref.prNumber,
        commentId,
        createdAt: commentCreatedAt.toISOString(),
        updatedAt: commentUpdatedAt.toISOString(),
        prTitle: ref.prTitle,
        body: 'rate limited by coderabbit.ai',
        commentType: 'review_limited',
      },
      pullRequestId,
    );
  });

  it('skips comments without rate-limit marker', async () => {
    const ref = generateReviewRef();
    github.listComments.mockResolvedValue([{ body: 'regular comment', id: getUniqueInt(), createdAt: getUniqueDate(), updatedAt: getUniqueDate() }]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
  });

  it('skips comments with own retrigger marker', async () => {
    const ref = generateReviewRef();
    github.listComments.mockResolvedValue([
      {
        body: 'rate limited by coderabbit.ai\n\n<!-- rabbit-maximizer\n{"version":"0.1.0","triggerSource":"scheduler"}\n-->',
        id: getUniqueInt(),
        createdAt: getUniqueDate(),
        updatedAt: getUniqueDate(),
      },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(onDetected).not.toHaveBeenCalled();
  });

  it('continues processing remaining PRs when listComments throws for one', async () => {
    const ref1 = generateReviewRef();
    const ref2 = generateReviewRef();
    const apiError = new Error('API error');
    const goodComment = { body: 'rate limited by coderabbit.ai', id: getUniqueInt(), createdAt: getUniqueDate(), updatedAt: getUniqueDate() };
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
    await checker.check([]);

    expect(github.listComments).not.toHaveBeenCalled();
    expect(onDetected).not.toHaveBeenCalled();
  });

  it('logs found count when comments are detected', async () => {
    const ref = generateReviewRef();
    github.listComments.mockResolvedValue([
      { body: 'rate limited by coderabbit.ai', id: getUniqueInt(), createdAt: getUniqueDate(), updatedAt: getUniqueDate() },
    ]);

    await checker.check([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: getUniqueInt(), prTitle: ref.prTitle }]);

    expect(logger.info).toHaveBeenCalledWith({ fn: 'DirectCommentChecker.check', found: 1, checked: 1 }, 'Direct comment check found rate-limit comments');
  });
});
