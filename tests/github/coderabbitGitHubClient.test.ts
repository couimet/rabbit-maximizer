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
    it('returns the comment body from the API response', async () => {
      const { owner, repo } = getUniqueGitHubRepoRef();
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
      const { owner, repo } = getUniqueGitHubRepoRef();
      issues.getComment.mockResolvedValue({
        data: { body: null },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const body = await client.fetchComment(owner, repo, fetchCommentId);
      expect(body).toBe('');

      expect(logger.debug).toHaveBeenCalledWith({ fn: 'fetchComment', owner, repo, commentId: fetchCommentId }, 'Fetching comment body');
    });
  });

  describe('searchReviewLimitComments', () => {
    const userFilter: RepoFilter = { pattern: 'couimet/*', scope: 'user' };
    const repoFilter: RepoFilter = {
      pattern: 'other-org/specific-repo',
      scope: 'repo',
    };

    it('builds the correct search query with user and repo scopes', async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchReviewLimitComments([userFilter, repoFilter]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo)`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open (user:couimet OR repo:other-org/specific-repo)`,
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
        q: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open`,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page: SEARCH_START_PAGE,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open`,
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

      const results = await client.searchReviewLimitComments([userFilter]);

      expect(results).toStrictEqual([
        {
          repo_full_name: 'couimet/my-repo',
          pr_number: prNumber,
          pr_title: prTitle,
          comment_id: matchingCommentId,
          url: matchingCommentUrl,
          created_at: matchingCreatedAt,
          updated_at: matchingUpdatedAt,
        },
      ]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open user:couimet`,
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

      const results = await client.searchReviewLimitComments([userFilter]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open user:couimet`,
        },
        'Searching for rate-limit comments',
      );
    });

    it('returns empty array when search has no results', async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchReviewLimitComments([userFilter]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: 'searchReviewLimitComments',
          query: `("reached your PR review rate limit" OR "reached your PR review limit") type:pr state:open user:couimet`,
        },
        'Searching for rate-limit comments',
      );
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
        sort: 'created',
        direction: 'desc',
        per_page: 100,
      });
      expect(result).toStrictEqual({ htmlUrl, reviewId });
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

      expect(result).toStrictEqual({ htmlUrl, reviewId });
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
        repo_full_name: `${owner}/${repo}`,
        pr_number: prNumber,
        comment_id: rateLimitCommentId,
        url: htmlUrl,
        created_at,
        updated_at,
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
