import pkg from '../../package.json' with { type: 'json' };
import { type CoderabbitGitHubClient, CoderabbitGitHubClientImpl } from '../../src/github/coderabbitGitHubClient.js';
import { TYPES } from '../../src/inversify-types.js';
import type { RepoFilter } from '../../src/types/RepoFilter.js';
import type { MockIssuesRest, MockSearchRest } from '../helpers/index.js';
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
      rest: { issues, search },
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
        `🔧 rabbit-optimizer v${VERSION} run=${runId}`,
        '',
        '---',
        '',
        `🤖 rabbit-optimizer | ${REPO_URL} | v${VERSION} | run=${runId}`,
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
        q: `"reached your PR review rate limit" type:pr state:open (user:couimet OR repo:other-org/specific-repo) created:>=${twentyFourHoursAgo}`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `"reached your PR review rate limit" type:pr state:open (user:couimet OR repo:other-org/specific-repo) created:>=${twentyFourHoursAgo}`,
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
        q: `"reached your PR review rate limit" type:pr state:open created:>=${twentyFourHoursAgo}`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `"reached your PR review rate limit" type:pr state:open created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('returns RateLimitComment objects for issues with matching comments', async () => {
      const twentyFourHoursAgo = new Date(frozenDate.getTime() - TWENTY_FOUR_HOURS_MS).toISOString();
      const matchingCommentId = getUniqueInt();
      const matchingCommentUrl = `https://github.com/couimet/my-repo/issues/${prNumber}#issuecomment-${matchingCommentId}`;
      const matchingCreatedAt = new Date(frozenDate.getTime() - getUniqueInt() * MS_PER_HOUR).toISOString();
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
        },
      ]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchRateLimitComments',
          query: `"reached your PR review rate limit" type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
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
          query: `"reached your PR review rate limit" type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
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
          query: `"reached your PR review rate limit" type:pr state:open user:couimet created:>=${twentyFourHoursAgo}`,
        },
        'Searching for rate-limit comments',
      );
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
