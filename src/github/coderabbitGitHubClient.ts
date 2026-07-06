import { TYPES } from '../inversify-types.js';
import { REVIEW_BOT_LOGIN } from '../types/coderabbit.js';
import type { PRState } from '../types/PRState.js';
import type { RateLimitComment } from '../types/RateLimitComment.js';
import type { RepoFilter } from '../types/RepoFilter.js';

import { buildCommentBody } from './buildCommentBody.js';
import { buildSearchQuery } from './buildSearchQuery.js';
import { extractRepoFullName } from './extractRepoFullName.js';
import { hasRateLimitMarker } from './hasRateLimitMarker.js';
import { splitRepo } from './splitRepo.js';

import type { Logger } from '@couimet/logger-contract';
import type { Octokit } from '@octokit/rest';
import { inject, injectable } from 'inversify';

const SEARCH_PER_PAGE = 100;
const SEARCH_MAX_PAGES = 3;
const COMMENTS_FETCH_PER_PAGE = 100;

export interface CoderabbitGitHubClient {
  searchRateLimitComments(repoFilter: readonly RepoFilter[]): Promise<RateLimitComment[]>;

  fetchComment(owner: string, repo: string, commentId: number): Promise<string>;

  postRetrigger(repo: string, pr: number, sourceCommentUrl: string, runId: string): Promise<{ htmlUrl: string }>;

  getPRState(repo: string, pr: number): Promise<PRState>;

  findCompletedReview(owner: string, repo: string, pr: number, since: Date): Promise<{ htmlUrl: string } | undefined>;
}

@injectable()
export class CoderabbitGitHubClientImpl implements CoderabbitGitHubClient {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.Octokit) private readonly octokit: Octokit,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async searchRateLimitComments(repoFilter: readonly RepoFilter[]): Promise<RateLimitComment[]> {
    const query = buildSearchQuery(repoFilter);
    this.log.debug({ fn: 'searchRateLimitComments', query }, 'Searching for rate-limit comments');

    const results: RateLimitComment[] = [];
    for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
      // issuesAndPullRequests is the canonical GET /search/issues endpoint.
      // Octokit's generated types mark it deprecated pending a rename that
      // hasn't landed as of @octokit/rest v22.0.1.
      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q: query,
        sort: 'created',
        order: 'desc',
        per_page: SEARCH_PER_PAGE,
        page,
      });

      if (response.data.items.length === 0) break;

      for (const item of response.data.items) {
        const repoFullName = extractRepoFullName(item.repository_url);
        const { owner, repo } = splitRepo(repoFullName);

        const comments = await this.octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: item.number,
          sort: 'created',
          direction: 'desc',
          per_page: COMMENTS_FETCH_PER_PAGE,
        });

        const rateLimitComment = comments.data.find((c) => c.body && hasRateLimitMarker(c.body));

        if (rateLimitComment && rateLimitComment.body) {
          results.push({
            repo_full_name: repoFullName,
            pr_number: item.number,
            comment_id: rateLimitComment.id,
            url: rateLimitComment.html_url,
            created_at: rateLimitComment.created_at,
            updated_at: rateLimitComment.updated_at,
          });
        }
      }

      if (response.data.items.length < SEARCH_PER_PAGE) break;
    }

    return results;
  }

  async fetchComment(owner: string, repo: string, commentId: number): Promise<string> {
    this.log.debug({ fn: 'fetchComment', owner, repo, commentId }, 'Fetching comment body');

    const response = await this.octokit.rest.issues.getComment({
      owner,
      repo,
      comment_id: commentId,
    });

    return response.data.body ?? '';
  }

  async postRetrigger(repo: string, pr: number, sourceCommentUrl: string, runId: string): Promise<{ htmlUrl: string }> {
    const { owner, repo: repoName } = splitRepo(repo);
    const body = buildCommentBody(sourceCommentUrl, runId);

    this.log.info({ fn: 'postRetrigger', owner, repo: repoName, pr, runId }, 'Posting retrigger comment');

    const response = await this.octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: pr,
      body,
    });

    return { htmlUrl: response.data.html_url };
  }

  async getPRState(repo: string, pr: number): Promise<PRState> {
    const { owner, repo: repoName } = splitRepo(repo);

    this.log.debug({ fn: 'getPRState', owner, repo: repoName, pr }, 'Fetching PR state');

    const response = await this.octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: pr,
    });

    return { state: response.data.state, merged_at: response.data.merged_at };
  }

  async findCompletedReview(owner: string, repo: string, pr: number, since: Date): Promise<{ htmlUrl: string } | undefined> {
    this.log.debug({ fn: 'findCompletedReview', owner, repo, pr }, 'Searching for completed review comment');

    const response = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pr,
      sort: 'created',
      direction: 'desc',
      per_page: COMMENTS_FETCH_PER_PAGE,
    });

    const completedComment = response.data.find(
      (c) => c.user?.login === REVIEW_BOT_LOGIN && c.body && !hasRateLimitMarker(c.body) && new Date(c.created_at) > since,
    );

    if (completedComment) {
      this.log.debug(
        { fn: 'findCompletedReview', owner, repo, pr, commentId: completedComment.id, htmlUrl: completedComment.html_url },
        'Found completed review comment',
      );
      return { htmlUrl: completedComment.html_url };
    }

    return undefined;
  }
}
