import pkg from '../../package.json' with { type: 'json' };
import { type CoderabbitGitHubClient, CoderabbitGitHubClientImpl } from '../../src/github/coderabbitGitHubClient.js';
import { TYPES } from '../../src/inversify-types.js';
import { TriggerSource } from '../../src/types/index.js';
import type { RepoFilter } from '../../src/types/RepoFilter.js';
import type { MockIssuesRest, MockPullsRest, MockSearchRest } from '../helpers/index.js';
import { createMockOctokit } from '../helpers/index.js';

import { getRandomString, getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Octokit } from '@octokit/rest';
import { Container } from 'inversify';

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

const MS_PER_HOUR = 60 * 60 * 1000;
const SEARCH_PER_PAGE = 100;
const SEARCH_START_PAGE = 1;
const REVIEWS_PER_PAGE = 100;

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
      const { owner, repo, fullName } = getUniqueGitHubRepoRef();
      const responseCommentId = getUniqueInt();
      issues.createComment.mockResolvedValue({
        data: {
          html_url: `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${responseCommentId}`,
        },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${triggerCommentId}`;
      const result = await client.postRetrigger(fullName, prNumber, triggerUrl, runId, TriggerSource.scheduler);

      const expectedBody = [
        '@coderabbitai full review',
        '',
        `↩ Triggered by: ${triggerUrl}`,
        '',
        '---',
        '',
        `🤖 [rabbit-maximizer](${REPO_URL}) v${VERSION} — run=${runId}`,
        '',
        `<!-- rabbit-maximizer\n${JSON.stringify(
          {
            version: VERSION,
            runId,
            triggerSource: 'scheduler',
            sourceCommentUrl: triggerUrl,
            timestamp: frozenDate.toISOString(),
          },
          null,
          2,
        )}\n-->`,
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
          triggerSource: 'scheduler',
        },
        'Posting retrigger comment',
      );
    });

    it('posts a comment with manual marker and footer when triggerSource is dashboard_retrigger_now', async () => {
      const { owner, repo, fullName } = getUniqueGitHubRepoRef();
      const responseCommentId = getUniqueInt();
      issues.createComment.mockResolvedValue({
        data: {
          html_url: `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${responseCommentId}`,
        },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${triggerCommentId}`;
      const result = await client.postRetrigger(fullName, prNumber, triggerUrl, runId, TriggerSource.dashboard_retrigger_now);

      const expectedBody = [
        '@coderabbitai full review',
        '',
        '⚡ Triggered manually from dashboard',
        '',
        '---',
        '',
        `🤖 [rabbit-maximizer](${REPO_URL}) v${VERSION} — run=${runId}`,
        '',
        `<!-- rabbit-maximizer\n${JSON.stringify(
          {
            version: VERSION,
            runId,
            triggerSource: 'dashboard_retrigger_now',
            sourceCommentUrl: null,
            timestamp: frozenDate.toISOString(),
          },
          null,
          2,
        )}\n-->`,
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
          triggerSource: 'dashboard_retrigger_now',
        },
        'Posting retrigger comment',
      );
    });
  });

  describe('fetchComment', () => {
    it('returns the comment body and updatedAt from the API response', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const bodyText = getRandomString();
      const updatedAt = getUniqueDate();
      issues.getComment.mockResolvedValue({
        data: { body: bodyText, updated_at: updatedAt.toISOString() },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const result = await client.fetchComment(owner, repo, fetchCommentId);

      expect(issues.getComment).toHaveBeenCalledWith({
        owner,
        repo,
        comment_id: fetchCommentId,
      });
      expect(result).toStrictEqual({ body: bodyText, updatedAt: updatedAt.toISOString() });

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'fetchComment', owner, repo, commentId: fetchCommentId }, 'Fetching comment body');
    });

    it('returns empty body when the comment body is null', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const updatedAt = getUniqueDate();
      issues.getComment.mockResolvedValue({
        data: { body: null, updated_at: updatedAt.toISOString() },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const result = await client.fetchComment(owner, repo, fetchCommentId);
      expect(result).toStrictEqual({ body: '<EMPTY_BODY>', updatedAt: updatedAt.toISOString() });

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'fetchComment', owner, repo, commentId: fetchCommentId }, 'Fetching comment body');
    });
  });

  describe('listComments', () => {
    it('returns ListedComment objects for comments with a body', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const issueNumber = getUniqueInt();
      const commentId = getUniqueInt();
      const body = getRandomString();
      const updatedAt = getUniqueDate();

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: commentId,
            body,
            updated_at: updatedAt.toISOString(),
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.listComments(owner, repo, issueNumber);

      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page: 1,
      });
      expect(result).toStrictEqual([{ body, id: commentId, updatedAt }]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'listComments', owner, repo, issueNumber }, 'Listing issue comments');
    });

    it('uses <EMPTY_BODY> fallback for comments with null or undefined body', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const issueNumber = getUniqueInt();
      const commentId = getUniqueInt();
      const body = getRandomString();
      const updatedAt = getUniqueDate();
      const nullId = getUniqueInt();
      const nullUpdatedAt = getUniqueDate();
      const undefinedId = getUniqueInt();
      const undefinedUpdatedAt = getUniqueDate();

      issues.listComments.mockResolvedValue({
        data: [
          { id: nullId, body: null, updated_at: nullUpdatedAt.toISOString() },
          { id: undefinedId, body: undefined, updated_at: undefinedUpdatedAt.toISOString() },
          { id: commentId, body, updated_at: updatedAt.toISOString() },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.listComments(owner, repo, issueNumber);

      expect(result).toStrictEqual([
        { body: '<EMPTY_BODY>', id: nullId, updatedAt: nullUpdatedAt },
        { body: '<EMPTY_BODY>', id: undefinedId, updatedAt: undefinedUpdatedAt },
        { body, id: commentId, updatedAt },
      ]);
    });

    it('paginates to retrieve all comments', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const issueNumber = getUniqueInt();
      const firstPageIds = [getUniqueInt(), getUniqueInt()];
      const secondPageId = getUniqueInt();
      const firstPageDate = getUniqueDate();
      const secondPageDate = getUniqueDate();
      const reviewsPerPage = 100;

      issues.listComments
        .mockResolvedValueOnce({
          data: Array.from({ length: reviewsPerPage }, (_, i) => ({
            id: firstPageIds[i] ?? getUniqueInt(),
            body: `comment-${i}`,
            updated_at: firstPageDate.toISOString(),
          })),
        })
        .mockResolvedValueOnce({
          data: [{ id: secondPageId, body: 'second-page-comment', updated_at: secondPageDate.toISOString() }],
        });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.listComments(owner, repo, issueNumber);

      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page: 1,
      });
      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100,
        page: 2,
      });
      expect(result).toHaveLength(101);
      expect(result[100]).toStrictEqual({ body: 'second-page-comment', id: secondPageId, updatedAt: secondPageDate });
    });

    it('returns empty array when there are no comments', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const issueNumber = getUniqueInt();

      issues.listComments.mockResolvedValue({ data: [] });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.listComments(owner, repo, issueNumber);

      expect(result).toStrictEqual([]);
    });
  });

  describe('searchReviewLimitComments', () => {
    const USER_FILTER: RepoFilter = { pattern: 'couimet/*', scope: 'user' };
    const REPO_FILTER: RepoFilter = {
      pattern: 'other-org/specific-repo',
      scope: 'repo',
    };

    it('builds the correct search query with user and repo scopes', async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchReviewLimitComments([USER_FILTER, REPO_FILTER]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: `("review limit" OR "rate limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo)`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("review limit" OR "rate limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo)`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('omits the qualifier clause when the repo filter is empty', async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchReviewLimitComments([]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: `("review limit" OR "rate limit") type:pr state:open`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("review limit" OR "rate limit") type:pr state:open`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('returns DetectedComment objects for issues with matching comments', async () => {
      const matchingCommentId = getUniqueInt();
      const matchingCommentUrl = `https://github.com/couimet/my-repo/issues/${prNumber}#issuecomment-${matchingCommentId}`;
      const matchingCreatedAt = new Date(frozenDate.getTime() - getUniqueInt() * MS_PER_HOUR).toISOString();
      const matchingUpdatedAt = new Date(frozenDate.getTime() - getUniqueInt() * MS_PER_HOUR).toISOString();
      const matchingBody = `${getRandomString()} rate limited by coderabbit.ai ${getRandomString()}`;
      const prTitle = getUniqueString({ prefix: 'pr-title-' });

      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: 'https://api.github.com/repos/couimet/my-repo',
              number: prNumber,
              title: prTitle,
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

      const results = await client.searchReviewLimitComments([USER_FILTER]);

      expect(results).toStrictEqual([
        {
          repoFullName: 'couimet/my-repo',
          prNumber,
          prTitle,
          body: matchingBody,
          commentType: 'review_limited',
          commentId: matchingCommentId,
          url: matchingCommentUrl,
          createdAt: matchingCreatedAt,
          updatedAt: matchingUpdatedAt,
        },
      ]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("review limit" OR "rate limit") type:pr state:open user:couimet`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('excludes issues whose comments do not contain the rate-limit marker', async () => {
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
            created_at: getUniqueDate().toISOString(),
            body: nonMatchingBody,
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchReviewLimitComments([USER_FILTER]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("review limit" OR "rate limit") type:pr state:open user:couimet`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('returns empty array when search has no results', async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchReviewLimitComments([USER_FILTER]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("review limit" OR "rate limit") type:pr state:open user:couimet`,
        },
        'Searching for rate-limit comments',
      );
    });
  });

  describe('listOpenPRs', () => {
    const USER_FILTER: RepoFilter = { pattern: 'couimet/*', scope: 'user' };

    it('returns empty array when no repos match', async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const results = await client.listOpenPRs([USER_FILTER]);

      expect(results).toStrictEqual([]);
      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'is:pr state:open user:couimet',
        sort: 'created',
        order: 'desc',
        per_page: 100,
        page: 1,
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'listOpenPRs', query: 'is:pr state:open user:couimet' }, 'Searching for open PRs');
    });

    it('returns DiscoveredPR[] from search results', async () => {
      const { fullName } = getUniqueGitHubRepoRef();
      const prTitle = getUniqueString({ prefix: 'pr-title-' });
      const authorLogin = getUniqueString({ prefix: 'author-' });

      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: `https://api.github.com/repos/${fullName}`,
              number: prNumber,
              title: prTitle,
              user: { login: authorLogin },
            },
          ],
        },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const results = await client.listOpenPRs([USER_FILTER]);

      expect(results).toStrictEqual([
        {
          repoFullName: fullName,
          prNumber,
          prTitle,
          authorLogin,
        },
      ]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'listOpenPRs', query: 'is:pr state:open user:couimet' }, 'Searching for open PRs');
    });

    it('paginates through multiple pages', async () => {
      const { fullName } = getUniqueGitHubRepoRef();
      const page1Author = getUniqueString({ prefix: 'author1-' });
      const page2Author = getUniqueString({ prefix: 'author2-' });
      const page2Title = getUniqueString({ prefix: 'page2-' });

      search.issuesAndPullRequests
        .mockResolvedValueOnce({
          data: {
            items: Array.from({ length: 100 }, (_, _i) => ({
              repository_url: `https://api.github.com/repos/${fullName}`,
              number: getUniqueInt(),
              title: getUniqueString({ prefix: 'page1-' }),
              user: { login: page1Author },
            })),
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                repository_url: `https://api.github.com/repos/${fullName}`,
                number: prNumber,
                title: page2Title,
                user: { login: page2Author },
              },
            ],
          },
        });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const results = await client.listOpenPRs([USER_FILTER]);

      expect(results).toHaveLength(101);
      expect(results[100]).toStrictEqual({
        repoFullName: fullName,
        prNumber,
        prTitle: page2Title,
        authorLogin: page2Author,
      });
      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'is:pr state:open user:couimet',
        sort: 'created',
        order: 'desc',
        per_page: 100,
        page: 1,
      });
      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: 'is:pr state:open user:couimet',
        sort: 'created',
        order: 'desc',
        per_page: 100,
        page: 2,
      });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'listOpenPRs', query: 'is:pr state:open user:couimet' }, 'Searching for open PRs');
    });

    it('handles missing user.login (deleted account) by using <unknown>', async () => {
      const { fullName } = getUniqueGitHubRepoRef();
      const prTitle = getUniqueString({ prefix: 'pr-title-' });

      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: `https://api.github.com/repos/${fullName}`,
              number: prNumber,
              title: prTitle,
              user: null,
            },
          ],
        },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const results = await client.listOpenPRs([USER_FILTER]);

      expect(results).toStrictEqual([
        {
          repoFullName: fullName,
          prNumber,
          prTitle,
          authorLogin: '<unknown>',
        },
      ]);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'listOpenPRs', query: 'is:pr state:open user:couimet' }, 'Searching for open PRs');
    });
  });

  describe('getPRState', () => {
    it('splits the repo string and calls pulls.get', async () => {
      const { owner, repo, fullName } = getUniqueGitHubRepoRef();
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
      const { fullName } = getUniqueGitHubRepoRef();
      const mergedAt = getUniqueDate().toISOString();
      pulls.get.mockResolvedValue({
        data: { state: 'closed', merged_at: mergedAt },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.getPRState(fullName, prNumber);

      expect(result).toStrictEqual({ state: 'closed', merged_at: mergedAt });
    });
  });

  describe('findCompletedReview', () => {
    it('returns the review URL and ID when a completed CodeRabbit review with the actionable marker exists', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const reviewId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}#pullrequestreview-${reviewId}`;
      const submittedAt = new Date(since.getTime() + MS_PER_HOUR * 24).toISOString();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: reviewId,
            html_url: htmlUrl,
            submitted_at: submittedAt,
            body: '## Summary by CodeRabbit\n\n**Actionable comments posted: 1**\n\nHere is your review.',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(pulls.listReviews).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        page: 1,
      });
      expect(result).toStrictEqual({ htmlUrl, reviewId, isApproval: false });
      expect(logger.info).toHaveBeenCalledWith({ fn: 'findCompletedReview', owner, repo, pr: prNumber, reviewId, htmlUrl }, 'Found completed review');
    });

    it('matches the no-actionable completion signal', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const reviewId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}#pullrequestreview-${reviewId}`;
      const submittedAt = new Date(since.getTime() + MS_PER_HOUR * 24).toISOString();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: reviewId,
            html_url: htmlUrl,
            submitted_at: submittedAt,
            body: 'No actionable comments were generated in the recent review.',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toStrictEqual({ htmlUrl, reviewId, isApproval: true });
    });

    it('excludes reviews submitted before the since date', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/old-review',
            submitted_at: new Date(since.getTime() - MS_PER_HOUR * 24).toISOString(),
            body: '**Actionable comments posted: 2**',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('returns undefined when no CodeRabbit reviews exist', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/human-review',
            submitted_at: new Date(since.getTime() + MS_PER_HOUR * 24).toISOString(),
            body: 'Looks good to me!',
            user: { login: 'human-user' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('returns undefined when review body is empty', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/empty',
            submitted_at: new Date(since.getTime() + MS_PER_HOUR * 24).toISOString(),
            body: '',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('paginates to the next page when the first page has no match and is full', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const reviewId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}#pullrequestreview-${reviewId}`;
      const submittedAt = new Date(since.getTime() + MS_PER_HOUR * 24).toISOString();

      pulls.listReviews
        .mockResolvedValueOnce({
          data: Array.from({ length: REVIEWS_PER_PAGE }, () => ({
            id: getUniqueInt(),
            html_url: 'https://example.com/non-matching',
            submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
            body: 'Not a code review',
            user: { login: 'some-other-bot' },
          })),
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: reviewId,
              html_url: htmlUrl,
              submitted_at: submittedAt,
              body: '**Actionable comments posted: 1**',
              user: { login: 'coderabbitai[bot]' },
            },
          ],
        });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(pulls.listReviews).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
        per_page: REVIEWS_PER_PAGE,
        page: 1,
      });
      expect(pulls.listReviews).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
        per_page: REVIEWS_PER_PAGE,
        page: 2,
      });
      expect(result).toStrictEqual({ htmlUrl, reviewId, isApproval: false });
      expect(logger.info).toHaveBeenCalledWith({ fn: 'findCompletedReview', owner, repo, pr: prNumber, reviewId, htmlUrl }, 'Found completed review');
    });

    it('stops paginating when a page returns fewer than the per-page limit', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: Array.from({ length: 50 }, () => ({
          id: getUniqueInt(),
          html_url: 'https://example.com/non-matching',
          submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
          body: 'Not a code review',
          user: { login: 'some-other-bot' },
        })),
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findCompletedReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
      expect(pulls.listReviews).toHaveBeenCalledTimes(1);
    });
  });

  describe('findLatestCoderabbitReview', () => {
    it('returns the review URL and state when a CodeRabbit review exists after the since date', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const reviewId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}#pullrequestreview-${reviewId}`;
      const submittedAt = new Date(since.getTime() + MS_PER_HOUR * 24).toISOString();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: reviewId,
            html_url: htmlUrl,
            submitted_at: submittedAt,
            state: 'APPROVED',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(pulls.listReviews).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        page: 1,
      });
      expect(result).toStrictEqual({ htmlUrl, state: 'approved' });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'findLatestCoderabbitReview', owner, repo, pr: prNumber, reviewId, state: 'approved' },
        'Found CodeRabbit review',
      );
    });

    it('paginates to the next page when the first page has no match and is full', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const reviewId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}#pullrequestreview-${reviewId}`;
      const submittedAt = new Date(since.getTime() + MS_PER_HOUR * 24).toISOString();

      pulls.listReviews
        .mockResolvedValueOnce({
          data: Array.from({ length: REVIEWS_PER_PAGE }, () => ({
            id: getUniqueInt(),
            html_url: 'https://example.com/non-matching',
            submitted_at: new Date(since.getTime() + MS_PER_HOUR).toISOString(),
            state: 'COMMENTED',
            user: { login: 'some-other-bot' },
          })),
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: reviewId,
              html_url: htmlUrl,
              submitted_at: submittedAt,
              state: 'APPROVED',
              user: { login: 'coderabbitai[bot]' },
            },
          ],
        });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(pulls.listReviews).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
        per_page: REVIEWS_PER_PAGE,
        page: 1,
      });
      expect(pulls.listReviews).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number: prNumber,
        per_page: REVIEWS_PER_PAGE,
        page: 2,
      });
      expect(result).toStrictEqual({ htmlUrl, state: 'approved' });
    });

    it('returns CHANGES_REQUESTED when the review state is CHANGES_REQUESTED', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const reviewId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}#pullrequestreview-${reviewId}`;

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: reviewId,
            html_url: htmlUrl,
            submitted_at: new Date(since.getTime() + MS_PER_HOUR * 24).toISOString(),
            state: 'CHANGES_REQUESTED',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(result).toStrictEqual({ htmlUrl, state: 'changes_requested' });
    });

    it('excludes reviews with non-actionable states (COMMENTED, DISMISSED)', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/commented',
            submitted_at: new Date(since.getTime() + MS_PER_HOUR * 24).toISOString(),
            state: 'COMMENTED',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('excludes reviews from non-CodeRabbit users', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/human-review',
            submitted_at: new Date(since.getTime() + MS_PER_HOUR * 24).toISOString(),
            state: 'APPROVED',
            user: { login: 'human-reviewer' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('returns undefined when no reviews exist', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({ data: [] });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });

    it('excludes reviews submitted before the since date', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/old-review',
            submitted_at: new Date(since.getTime() - MS_PER_HOUR * 24).toISOString(),
            state: 'APPROVED',
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestCoderabbitReview(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
    });
  });

  describe('findLatestReviewLimitComment', () => {
    it('returns the latest rate-limit comment when one exists', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const rateLimitCommentId = getUniqueInt();
      const htmlUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${rateLimitCommentId}`;
      const created_at = getUniqueDate().toISOString();
      const updated_at = new Date(new Date(created_at).getTime() + MS_PER_HOUR).toISOString();

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/normal',
            created_at: getUniqueDate().toISOString(),
            updated_at: getUniqueDate().toISOString(),
            body: 'Looks good to me!',
          },
          {
            id: rateLimitCommentId,
            html_url: htmlUrl,
            created_at,
            updated_at,
            body: 'You have rate limited by coderabbit.ai ... please wait 30 minutes.',
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestReviewLimitComment(owner, repo, prNumber);

      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: prNumber,
        sort: 'created',
        direction: 'desc',
        per_page: 100,
      });
      expect(result).toStrictEqual({
        repoFullName: `${owner}/${repo}`,
        prNumber,
        commentId: rateLimitCommentId,
        url: htmlUrl,
        createdAt: created_at,
        updatedAt: updated_at,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'findLatestReviewLimitComment', owner, repo, pr: prNumber, commentId: rateLimitCommentId, url: htmlUrl },
        'Found latest rate-limit comment',
      );
    });

    it('returns undefined when no rate-limit comment exists', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/normal',
            created_at: getUniqueDate().toISOString(),
            updated_at: getUniqueDate().toISOString(),
            body: 'Just a normal comment.',
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestReviewLimitComment(owner, repo, prNumber);

      expect(result).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findLatestReviewLimitComment', owner, repo, pr: prNumber }, 'Searching for latest rate-limit comment');
    });

    it('skips comments with retrigger markers', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/retrigger',
            created_at: getUniqueDate().toISOString(),
            updated_at: getUniqueDate().toISOString(),
            body: 'rate limited by coderabbit.ai <!-- rabbit-maximizer run=abc123 -->',
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findLatestReviewLimitComment(owner, repo, prNumber);

      expect(result).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findLatestReviewLimitComment', owner, repo, pr: prNumber }, 'Searching for latest rate-limit comment');
    });
  });

  describe('findAcknowledgement', () => {
    it('paginates issue comments and returns the first acknowledgement from coderabbitai[bot]', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const ackCommentId = getUniqueInt();
      const ackCommentUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${ackCommentId}`;
      const ackBody = 'auto-generated reply by CodeRabbit';

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: ackCommentId,
            html_url: ackCommentUrl,
            body: ackBody,
            user: { login: 'coderabbitai[bot]' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findAcknowledgement(owner, repo, prNumber, since);

      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: prNumber,
        since: since.toISOString(),
        sort: 'created',
        direction: 'desc',
        per_page: 100,
        page: 1,
      });
      expect(result).toStrictEqual({ commentId: ackCommentId, commentUrl: ackCommentUrl });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findAcknowledgement', owner, repo, pr: prNumber }, 'Searching for acknowledgement comment');
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'findAcknowledgement', owner, repo, pr: prNumber, commentId: ackCommentId, commentUrl: ackCommentUrl },
        'Found acknowledgement comment',
      );
    });

    it('paginates to the next page when the first page has no match and is full', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();
      const ackCommentId = getUniqueInt();
      const ackCommentUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${ackCommentId}`;

      issues.listComments
        .mockResolvedValueOnce({
          data: Array.from({ length: 100 }, () => ({
            id: getUniqueInt(),
            html_url: 'https://example.com/non-matching',
            body: 'Just a normal comment',
            user: { login: 'someone-else' },
          })),
        })
        .mockResolvedValueOnce({
          data: [
            {
              id: ackCommentId,
              html_url: ackCommentUrl,
              body: 'auto-generated reply by CodeRabbit',
              user: { login: 'coderabbitai[bot]' },
            },
          ],
        });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findAcknowledgement(owner, repo, prNumber, since);

      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: prNumber,
        since: since.toISOString(),
        sort: 'created',
        direction: 'desc',
        per_page: 100,
        page: 1,
      });
      expect(issues.listComments).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: prNumber,
        since: since.toISOString(),
        sort: 'created',
        direction: 'desc',
        per_page: 100,
        page: 2,
      });
      expect(result).toStrictEqual({ commentId: ackCommentId, commentUrl: ackCommentUrl });
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findAcknowledgement', owner, repo, pr: prNumber }, 'Searching for acknowledgement comment');
      expect(logger.debug).toHaveBeenCalledWith(
        { fn: 'findAcknowledgement', owner, repo, pr: prNumber, commentId: ackCommentId, commentUrl: ackCommentUrl },
        'Found acknowledgement comment',
      );
    });

    it('stops paginating when a page returns fewer than the per-page limit', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      issues.listComments.mockResolvedValue({
        data: Array.from({ length: 50 }, () => ({
          id: getUniqueInt(),
          html_url: 'https://example.com/non-matching',
          body: 'Just a normal comment',
          user: { login: 'someone-else' },
        })),
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findAcknowledgement(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
      expect(issues.listComments).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findAcknowledgement', owner, repo, pr: prNumber }, 'Searching for acknowledgement comment');
    });

    it('returns undefined when no matching comment is found', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
      const since = getUniqueDate();

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: getUniqueInt(),
            html_url: 'https://example.com/normal',
            body: 'Just a normal comment.',
            user: { login: 'someone-else' },
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);
      const result = await client.findAcknowledgement(owner, repo, prNumber, since);

      expect(result).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'findAcknowledgement', owner, repo, pr: prNumber }, 'Searching for acknowledgement comment');
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
