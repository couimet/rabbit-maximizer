import pkg from '../../package.json' with { type: 'json' };
import { type CoderabbitGitHubClient, CoderabbitGitHubClientImpl } from '../../src/github/coderabbitGitHubClient.js';
import { TYPES } from '../../src/inversify-types.js';
import type { RepoFilter } from '../../src/types/RepoFilter.js';
import type { MockIssuesRest, MockPullsRest, MockSearchRest } from '../helpers/index.js';
import { createMockLogger, createMockOctokit } from '../helpers/index.js';
import { makeUniqueRepoName } from '../helpers/index.js';

import { getRandomString, getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Octokit } from '@octokit/rest';
import { Container } from 'inversify';

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

const MS_PER_HOUR = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * MS_PER_HOUR;
const SEARCH_PER_PAGE = 100;
const SEARCH_START_PAGE = 1;

describe('client', () => {
  let octokit: Octokit;
  let issues: MockIssuesRest;
  let pulls: MockPullsRest;
  let search: MockSearchRest;
  let logger: Logger;

  let frozenDate: Date;
  let prNumber: number;
  let triggerCommentId: number;
  let fetchCommentId: number;
  let runId: string;

  beforeEach(() => {
    frozenDate = getUniqueDate();
    prNumber = getUniqueInt();
    triggerCommentId = getUniqueInt();
    fetchCommentId = getUniqueInt();
    runId = getUniqueString({ prefix: 'run-' });

    jest.useFakeTimers();
    jest.setSystemTime(frozenDate);
    ({
      octokit,
      rest: { issues, pulls, search },
    } = createMockOctokit());
    logger = createMockLogger();
  });

  describe('postRetrigger', () => {
    it('posts a comment with the correct body template', async () => {
      const { owner, repo, fullName } = makeUniqueRepoName();
      const responseCommentId = getUniqueInt();
      issues.createComment.mockResolvedValue({
        data: {
          html_url: `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${responseCommentId}`,
        },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${triggerCommentId}`;
      const result = await client.postRetrigger(fullName, prNumber, triggerUrl, runId);

      const expectedBody = [
        '@coderabbitai full review',
        '',
        `🔧 rabbit-maximizer v${VERSION} run=${runId}`,
        '',
        '---',
        '',
        `🤖 rabbit-maximizer | ${REPO_URL} | v${VERSION} | run=${runId}`,
        `↩ Triggered by: ${triggerUrl}`,
      ].join('\n');

      expect(issues.createComment).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: prNumber,
        body: expectedBody,
      });

      expect(result.htmlUrl).toBe(`https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${responseCommentId}`);

      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: 'postRetrigger',
          owner,
          repo,
          pr: prNumber,
          runId,
        },
        'Posting retrigger comment',
      );
    });
  });

  describe('fetchComment', () => {
    it('returns the comment body from the API response', async () => {
      const { owner, repo } = makeUniqueRepoName();
      const bodyText = getRandomString();
      issues.getComment.mockResolvedValue({
        data: { body: bodyText },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const body = await client.fetchComment(owner, repo, fetchCommentId);

      expect(issues.getComment).toHaveBeenCalledWith({
        owner,
        repo,
        comment_id: fetchCommentId,
      });
      expect(body).toBe(bodyText);

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'fetchComment', owner, repo, commentId: fetchCommentId }, 'Fetching comment body');
    });

    it('returns empty string when the comment body is null', async () => {
      const { owner, repo } = makeUniqueRepoName();
      issues.getComment.mockResolvedValue({
        data: { body: null },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const body = await client.fetchComment(owner, repo, fetchCommentId);
      expect(body).toBe('');

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'fetchComment', owner, repo, commentId: fetchCommentId }, 'Fetching comment body');
    });
  });

  describe('searchRateLimitComments', () => {
    const userFilter: RepoFilter = { pattern: 'couimet/*', scope: 'user' };
    const repoFilter: RepoFilter = {
      pattern: 'other-org/specific-repo',
      scope: 'repo',
    };

    it('builds the correct search query with user and repo scopes', async () => {
      const twentyFourHoursAgo = new Date(frozenDate.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();

      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchRateLimitComments([userFilter, repoFilter]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo) created:>=${twentyFourHoursAgo}`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo) created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('omits the qualifier clause when the repo filter is empty', async () => {
      const twentyFourHoursAgo = new Date(frozenDate.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();

      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchRateLimitComments([]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open created:>=${twentyFourHoursAgo}`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('returns RateLimitComment objects for issues with matching comments', async () => {
      const twentyFourHoursAgo = new Date(frozenDate.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();
      const matchingCommentId = getUniqueInt();
      const matchingCommentUrl = `https://github.com/couimet/my-repo/issues/${prNumber}#issuecomment-${matchingCommentId}`;
      const matchingCreatedAt = new Date(frozenDate.getTime() - getUniqueInt() * MS_PER_HOUR).toISOString();
      const matchingUpdatedAt = new Date(frozenDate.getTime() - getUniqueInt() * MS_PER_HOUR).toISOString();
      const matchingBody = `${getRandomString()} rate limited by coderabbit.ai ${getRandomString()}`;

      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: 'https://api.github.com/repos/couimet/my-repo',
              number: prNumber,
            },
          ],
        },
      });

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: matchingCommentId,
            html_url: matchingCommentUrl,
            created_at: matchingCreatedAt,
            updated_at: matchingUpdatedAt,
            body: matchingBody,
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchRateLimitComments([userFilter]);

      expect(results).toStrictEqual([
        {
          repo_full_name: 'couimet/my-repo',
          pr_number: prNumber,
          comment_id: matchingCommentId,
          url: matchingCommentUrl,
          created_at: matchingCreatedAt,
          updated_at: matchingUpdatedAt,
        },
      ]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('excludes issues whose comments do not contain the rate-limit marker', async () => {
      const twentyFourHoursAgo = new Date(frozenDate.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();
      const nonMatchingCommentId = getUniqueInt();
      const nonMatchingBody = getRandomString();

      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: 'https://api.github.com/repos/couimet/my-repo',
              number: 1,
            },
          ],
        },
      });

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: nonMatchingCommentId,
            html_url: 'https://example.com',
            created_at: '2026-06-18T10:00:00Z',
            body: nonMatchingBody,
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchRateLimitComments([userFilter]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('returns empty array when search has no results', async () => {
      const twentyFourHoursAgo = new Date(frozenDate.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();

      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchRateLimitComments([userFilter]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
    });
  });

  describe('getPRState', () => {
    it('splits the repo string and calls pulls.get', async () => {
      const { owner, repo, fullName } = makeUniqueRepoName();
      pulls.get.mockResolvedValue({
        data: { state: 'open', merged_at: null },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      await client.getPRState(fullName, prNumber);

      expect(pulls.get).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
      });

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'getPRState', owner, repo, pr: prNumber }, 'Fetching PR state');
    });

    it('maps response to PRState', async () => {
      const { fullName } = makeUniqueRepoName();
      pulls.get.mockResolvedValue({
        data: { state: 'closed', merged_at: '2026-01-01T00:00:00Z' },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.getPRState(fullName, prNumber);

      expect(result).toStrictEqual({ state: 'closed', merged_at: '2026-01-01T00:00:00Z' });
    });
  });

  describe('findCompletedReview', () => {
    it('returns the comment URL when a non-rate-limit bot comment exists after the since date', async () => {
      const { owner, repo } = makeUniqueRepoName();
      const since = new Date('2026-06-15T00:00:00Z');
      const commentId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
      const createdAt = '2026-06-16T00:00:00Z';

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: commentId,
            html_url: htmlUrl,
            created_at: createdAt,
            body: '## Summary by CodeRabbit\n\nHere is your review.',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: prNumber,
        sort: 'created',
        direction: 'desc',
        per_page: 100,
      });
      expect(result).toStrictEqual({ htmlUrl });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findCompletedReview', owner, repo, pr: prNumber, commentId, htmlUrl }, 'Found completed review comment');
    });

    it('excludes comments containing the rate-limit marker', async () => {
      const { owner, repo } = makeUniqueRepoName();
      const since = new Date('2026-06-15T00:00:00Z');

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/rate-limit',
            created_at: '2026-06-16T00:00:00Z',
            body: 'You have rate limited by coderabbit.ai ... please wait 30 minutes.',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('excludes comments created before the since date', async () => {
      const { owner, repo } = makeUniqueRepoName();
      const since = new Date('2026-06-17T00:00:00Z');

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/old-review',
            created_at: '2026-06-16T00:00:00Z',
            body: '## Summary by CodeRabbit',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('returns undefined when no bot comments exist', async () => {
      const { owner, repo } = makeUniqueRepoName();
      const since = new Date('2026-06-15T00:00:00Z');

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/human',
            created_at: '2026-06-16T00:00:00Z',
            body: 'Looks good to me!',
            user: { login: 'human-user' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('returns undefined when comment body is empty', async () => {
      const { owner, repo } = makeUniqueRepoName();
      const since = new Date('2026-06-15T00:00:00Z');

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/empty',
            created_at: '2026-06-16T00:00:00Z',
            body: '',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });
  });

  describe('container binding', () => {
    it('resolves CoderabbitGitHubClient from the container with mock Octokit and Logger', () => {
      const container = new Container();

      container.bind<Octokit>(TYPES.Octokit).toConstantValue(octokit);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient).to(CoderabbitGitHubClientImpl);

      const client = container.get<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient);
      expect(client).toBeInstanceOf(CoderabbitGitHubClientImpl);
    });
  });
});
