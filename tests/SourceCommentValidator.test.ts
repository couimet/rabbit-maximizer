import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { SourceCommentValidatorImpl } from '../src/SourceCommentValidator.js';

import { makeUniqueRepoName } from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it, jest } from '@jest/globals';

describe('SourceCommentValidator', () => {
  const FALLBACK_WAIT_SECONDS = 3600;

  const makeItem = (over: Record<string, unknown> = {}) =>
    ({
      id: getUniqueInt(),
      uuid: getUniqueString({ prefix: 'uuid-' }),
      repo_full_name: makeUniqueRepoName().fullName,
      pr_number: getUniqueInt(),
      status: 'pending',
      not_before: getUniqueDate(),
      attempts: 0,
      source_comment_id: getUniqueInt(),
      created_at: getUniqueDate(),
      updated_at: getUniqueDate(),
      ...over,
    }) as any;

  const makeGithub = (over: Record<string, unknown> = {}) =>
    ({
      fetchComment: jest.fn<any>(),
      findLatestReviewLimitComment: jest.fn<any>(),
      ...over,
    }) as unknown as CoderabbitGitHubClient;

  it('returns proceed when stored comment is still a valid rate-limit comment', async () => {
    const github = makeGithub({ fetchComment: jest.fn<any>().mockResolvedValue('rate limited by coderabbit.ai') });
    const validator = new SourceCommentValidatorImpl(github, { REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: FALLBACK_WAIT_SECONDS } as any);
    const outcome = await validator.validate(makeItem());
    expect(outcome).toStrictEqual({ action: 'proceed' });
  });

  it('returns reschedule when stored comment is stale and a replacement exists', async () => {
    const commentId = getUniqueInt();
    const repoFullName = makeUniqueRepoName().fullName;
    const prNumber = getUniqueInt();
    const latest = {
      repo_full_name: repoFullName,
      pr_number: prNumber,
      comment_id: commentId,
      url: `https://github.com/${repoFullName}/pull/${prNumber}#issuecomment-${commentId}`,
      created_at: getUniqueDate().toISOString(),
      updated_at: getUniqueDate().toISOString(),
    };
    const github = makeGithub({
      fetchComment: jest.fn<any>().mockResolvedValue(''),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(latest),
    });
    const validator = new SourceCommentValidatorImpl(github, { REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: FALLBACK_WAIT_SECONDS } as any);
    const outcome = await validator.validate(makeItem());
    expect(outcome).toStrictEqual({ action: 'reschedule', notBefore: expect.any(Date) });
  });

  it('returns skip when stored comment is stale and no replacement exists', async () => {
    const github = makeGithub({
      fetchComment: jest.fn<any>().mockResolvedValue(''),
      findLatestReviewLimitComment: jest.fn<any>().mockResolvedValue(undefined),
    });
    const validator = new SourceCommentValidatorImpl(github, { REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: FALLBACK_WAIT_SECONDS } as any);
    const outcome = await validator.validate(makeItem());
    expect(outcome).toStrictEqual({ action: 'skip' });
  });

  it('returns proceed when stored comment has retrigger marker but is still a rate-limit comment', async () => {
    const github = makeGithub({ fetchComment: jest.fn<any>().mockResolvedValue('rate limited by coderabbit.ai') });
    const validator = new SourceCommentValidatorImpl(github, { REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: FALLBACK_WAIT_SECONDS } as any);
    const outcome = await validator.validate(makeItem());
    expect(outcome).toStrictEqual({ action: 'proceed' });
  });
});
