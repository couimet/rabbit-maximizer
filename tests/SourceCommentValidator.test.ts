import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { SourceCommentValidatorImpl } from '../src/SourceCommentValidator.js';

import { createMockCoderabbitGitHubClient, createMockLogger, makeUniqueRepoName } from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('SourceCommentValidator', () => {
  const FALLBACK_WAIT_SECONDS = 3600;

  let logger: Logger;
  let owner: string;
  let repo: string;
  let repoFullName: string;

  beforeEach(() => {
    logger = createMockLogger();
    const name = makeUniqueRepoName();
    owner = name.owner;
    repo = name.repo;
    repoFullName = name.fullName;
  });

  const makeItem = (over: Record<string, unknown> = {}) =>
    ({
      id: getUniqueInt(),
      uuid: getUniqueString({ prefix: 'uuid-' }),
      repo_full_name: repoFullName,
      pr_number: getUniqueInt(),
      status: 'pending',
      not_before: getUniqueDate(),
      attempts: 0,
      source_comment_id: getUniqueInt(),
      created_at: getUniqueDate(),
      updated_at: getUniqueDate(),
      ...over,
    }) as any;

  const createValidator = (github: jest.Mocked<CoderabbitGitHubClient>) =>
    new SourceCommentValidatorImpl(github, { REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: FALLBACK_WAIT_SECONDS } as any, logger);

  it('returns proceed when stored comment is still a valid rate-limit comment', async () => {
    const commentId = getUniqueInt();
    const item = makeItem({ source_comment_id: commentId });
    const github = createMockCoderabbitGitHubClient({ fetchComment: jest.fn<any>().mockResolvedValue('rate limited by coderabbit.ai') });
    const validator = createValidator(github);
    const outcome = await validator.validate(item);
    expect(outcome).toStrictEqual({ action: 'proceed' });
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'SourceCommentValidator.validate', owner, repo, commentId },
      'Stored comment is still a valid rate-limit comment; proceeding',
    );
  });

  it('returns reschedule when stored comment is stale and a replacement exists', async () => {
    const storedCommentId = getUniqueInt();
    const newCommentId = getUniqueInt();
    const prNumber = getUniqueInt();
    const item = makeItem({ source_comment_id: storedCommentId, pr_number: prNumber });
    const latest = {
      repo_full_name: repoFullName,
      pr_number: prNumber,
      comment_id: newCommentId,
      url: `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${newCommentId}`,
      created_at: getUniqueDate().toISOString(),
      updated_at: getUniqueDate().toISOString(),
    };
    const github = createMockCoderabbitGitHubClient({
      fetchComment: jest.fn<any>().mockResolvedValue(''),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(latest),
    });
    const validator = createValidator(github);
    const outcome = await validator.validate(item);
    const expectedNotBefore = new Date(new Date(latest.updated_at).getTime() + FALLBACK_WAIT_SECONDS * 1000);
    expect(outcome).toStrictEqual({
      action: 'reschedule',
      notBefore: expectedNotBefore,
      sourceComment: { commentId: newCommentId, commentUrl: latest.url },
    });
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'SourceCommentValidator.validate', owner, repo, pr: prNumber, newCommentId },
      'Stale source comment replaced; rescheduling with updated comment identity',
    );
  });

  it('returns skip when stored comment is stale and no replacement exists', async () => {
    const commentId = getUniqueInt();
    const prNumber = getUniqueInt();
    const item = makeItem({ source_comment_id: commentId, pr_number: prNumber });
    const github = createMockCoderabbitGitHubClient({
      fetchComment: jest.fn<any>().mockResolvedValue(''),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(undefined),
    });
    const validator = createValidator(github);
    const outcome = await validator.validate(item);
    expect(outcome).toStrictEqual({ action: 'skip' });
    expect(logger.warn).toHaveBeenCalledWith(
      { fn: 'SourceCommentValidator.validate', owner, repo, pr: prNumber },
      'Stale source comment with no replacement; skipping',
    );
  });

  it('falls through to findLatestReviewLimitComment when stored comment has both rate-limit and retrigger markers', async () => {
    const storedCommentId = getUniqueInt();
    const newCommentId = getUniqueInt();
    const prNumber = getUniqueInt();
    const item = makeItem({ source_comment_id: storedCommentId, pr_number: prNumber });
    const latest = {
      repo_full_name: repoFullName,
      pr_number: prNumber,
      comment_id: newCommentId,
      url: `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${newCommentId}`,
      created_at: getUniqueDate().toISOString(),
      updated_at: getUniqueDate().toISOString(),
    };
    const github = createMockCoderabbitGitHubClient({
      fetchComment: jest.fn<any>().mockResolvedValue('rate limited by coderabbit.ai <!-- rabbit-maximizer run=abc123 -->'),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(latest),
    });
    const validator = createValidator(github);
    const outcome = await validator.validate(item);
    const expectedNotBefore = new Date(new Date(latest.updated_at).getTime() + FALLBACK_WAIT_SECONDS * 1000);
    expect(outcome).toStrictEqual({ action: 'reschedule', notBefore: expectedNotBefore, sourceComment: { commentId: newCommentId, commentUrl: latest.url } });
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'SourceCommentValidator.validate', owner, repo, pr: prNumber, newCommentId },
      'Stale source comment replaced; rescheduling with updated comment identity',
    );
  });

  it('falls through to findLatestReviewLimitComment when fetchComment returns 404', async () => {
    const storedCommentId = getUniqueInt();
    const newCommentId = getUniqueInt();
    const prNumber = getUniqueInt();
    const item = makeItem({ source_comment_id: storedCommentId, pr_number: prNumber });
    const latest = {
      repo_full_name: repoFullName,
      pr_number: prNumber,
      comment_id: newCommentId,
      url: `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${newCommentId}`,
      created_at: getUniqueDate().toISOString(),
      updated_at: getUniqueDate().toISOString(),
    };
    const notFoundError = { status: 404 };
    const github = createMockCoderabbitGitHubClient({
      fetchComment: jest.fn<any>().mockRejectedValueOnce(notFoundError).mockResolvedValue(''),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(latest),
    });
    const validator = createValidator(github);
    const outcome = await validator.validate(item);
    const expectedNotBefore = new Date(new Date(latest.updated_at).getTime() + FALLBACK_WAIT_SECONDS * 1000);
    expect(outcome).toStrictEqual({ action: 'reschedule', notBefore: expectedNotBefore, sourceComment: { commentId: newCommentId, commentUrl: latest.url } });
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'SourceCommentValidator.validate', owner, repo, commentId: storedCommentId, status: 404 },
      'Source comment deleted; falling back to latest rate-limit comment',
    );
  });

  it('falls through to findLatestReviewLimitComment when fetchComment returns 410', async () => {
    const storedCommentId = getUniqueInt();
    const newCommentId = getUniqueInt();
    const prNumber = getUniqueInt();
    const item = makeItem({ source_comment_id: storedCommentId, pr_number: prNumber });
    const latest = {
      repo_full_name: repoFullName,
      pr_number: prNumber,
      comment_id: newCommentId,
      url: `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${newCommentId}`,
      created_at: getUniqueDate().toISOString(),
      updated_at: getUniqueDate().toISOString(),
    };
    const goneError = { status: 410 };
    const github = createMockCoderabbitGitHubClient({
      fetchComment: jest.fn<any>().mockRejectedValueOnce(goneError).mockResolvedValue(''),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(latest),
    });
    const validator = createValidator(github);
    const outcome = await validator.validate(item);
    const expectedNotBefore = new Date(new Date(latest.updated_at).getTime() + FALLBACK_WAIT_SECONDS * 1000);
    expect(outcome).toStrictEqual({ action: 'reschedule', notBefore: expectedNotBefore, sourceComment: { commentId: newCommentId, commentUrl: latest.url } });
    expect(logger.debug).toHaveBeenCalledWith(
      { fn: 'SourceCommentValidator.validate', owner, repo, commentId: storedCommentId, status: 410 },
      'Source comment deleted; falling back to latest rate-limit comment',
    );
  });

  it('rethrows when fetchComment fails with a non-terminal error', async () => {
    const serverError = { status: 500 };
    const commentId = getUniqueInt();
    const item = makeItem({ source_comment_id: commentId });
    const github = createMockCoderabbitGitHubClient({
      fetchComment: jest.fn<any>().mockRejectedValue(serverError),
    });
    const validator = createValidator(github);
    await expect(validator.validate(item)).rejects.toBe(serverError);
  });
});
