import { type TriggerSource, TYPES } from '../domain.js';
import type { AcknowledgementResult, DetectedComment, DiscoveredPR, PRState, RepoFilter, ReviewLimitComment } from '../types/index.js';

import type { CompletedReview, FetchCommentResult, ListedComment, RetriggerComment } from './types/index.js';
import {
  buildCommentBody,
  buildOpenPRSearchQuery,
  buildSearchQuery,
  classifyCoderabbitComment,
  type CoderabbitReview,
  extractRepoFullName,
  hasOwnRetriggerMarker,
  hasRateLimitMarker,
  isAcknowledgementComment,
  isApprovalReviewSignal,
  isMatchingCoderabbitReview,
  isMatchingCompletedReview,
  normalizeCommentBody,
  splitRepo,
  SubmittedComment,
  SubmittedReview,
  toReviewState,
} from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Octokit } from '@octokit/rest';
import { inject, injectable } from 'inversify';

const SEARCH_PER_PAGE = 100;
const SEARCH_MAX_PAGES = 3;
const COMMENTS_FETCH_PER_PAGE = 100;
const OPEN_PR_SEARCH_PER_PAGE = 100;
const OPEN_PR_SEARCH_MAX_PAGES = 3;

export interface CoderabbitGitHubClient {
  searchReviewLimitComments(repoFilter: readonly RepoFilter[]): Promise<DetectedComment[]>;

  fetchComment(owner: string, repo: string, commentId: number): Promise<FetchCommentResult>;

  listComments(owner: string, repo: string, issueNumber: number): Promise<ListedComment[]>;

  listOpenPRs(repoFilter: readonly RepoFilter[]): Promise<DiscoveredPR[]>;

  postRetrigger(repo: string, pr: number, sourceCommentUrl: string, runId: string, triggerSource: TriggerSource): Promise<RetriggerComment>;

  getPRState(repo: string, pr: number): Promise<PRState>;

  findCompletedReview(owner: string, repo: string, pr: number, since: Date): Promise<CompletedReview | undefined>;

  findLatestCoderabbitReview(owner: string, repo: string, pr: number, since: Date): Promise<CoderabbitReview | undefined>;

  findLatestReviewLimitComment(owner: string, repo: string, pr: number): Promise<ReviewLimitComment | undefined>;

  findAcknowledgement(owner: string, repo: string, pr: number, since: Date): Promise<AcknowledgementResult | undefined>;
}

@injectable()
export class CoderabbitGitHubClientImpl implements CoderabbitGitHubClient {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.Octokit) private readonly octokit: Octokit,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async searchReviewLimitComments(repoFilter: readonly RepoFilter[]): Promise<DetectedComment[]> {
    const query = buildSearchQuery(repoFilter);
    this.log.debug({ fn: 'searchReviewLimitComments', query }, 'Searching for rate-limit comments');

    const results: DetectedComment[] = [];
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
            repoFullName,
            prNumber: item.number,
            prTitle: item.title,
            body: rateLimitComment.body,
            commentType: classifyCoderabbitComment(rateLimitComment.body),
            commentId: rateLimitComment.id,
            url: rateLimitComment.html_url,
            createdAt: rateLimitComment.created_at,
            updatedAt: rateLimitComment.updated_at,
          });
        }
      }

      if (response.data.items.length < SEARCH_PER_PAGE) break;
    }

    return results;
  }

  async fetchComment(owner: string, repo: string, commentId: number): Promise<FetchCommentResult> {
    this.log.debug({ fn: 'fetchComment', owner, repo, commentId }, 'Fetching comment body');

    const response = await this.octokit.rest.issues.getComment({
      owner,
      repo,
      comment_id: commentId,
    });

    return { body: normalizeCommentBody(response.data.body), updatedAt: response.data.updated_at };
  }

  async listComments(owner: string, repo: string, issueNumber: number): Promise<ListedComment[]> {
    this.log.debug({ fn: 'listComments', owner, repo, issueNumber }, 'Listing issue comments');

    const results: ListedComment[] = [];
    for (let page = 1; ; page++) {
      const response = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: issueNumber,
        per_page: COMMENTS_FETCH_PER_PAGE,
        page,
      });

      for (const c of response.data) {
        results.push({ body: normalizeCommentBody(c.body), id: c.id, updatedAt: new Date(c.updated_at) });
      }

      if (response.data.length < COMMENTS_FETCH_PER_PAGE) break;
    }

    return results;
  }

  async listOpenPRs(repoFilter: readonly RepoFilter[]): Promise<DiscoveredPR[]> {
    const query = buildOpenPRSearchQuery(repoFilter);
    this.log.debug({ fn: 'listOpenPRs', query }, 'Searching for open PRs');

    const results: DiscoveredPR[] = [];
    for (let page = 1; page <= OPEN_PR_SEARCH_MAX_PAGES; page++) {
      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q: query,
        sort: 'created',
        order: 'desc',
        per_page: OPEN_PR_SEARCH_PER_PAGE,
        page,
      });

      if (response.data.items.length === 0) break;

      for (const item of response.data.items) {
        results.push({
          repoFullName: extractRepoFullName(item.repository_url),
          prNumber: item.number,
          prTitle: item.title,
          authorLogin: item.user?.login ?? '<unknown>',
        });
      }

      if (response.data.items.length < OPEN_PR_SEARCH_PER_PAGE) break;
    }

    return results;
  }

  async postRetrigger(repo: string, pr: number, sourceCommentUrl: string, runId: string, triggerSource: TriggerSource): Promise<RetriggerComment> {
    const { owner, repo: repoName } = splitRepo(repo);
    const body = buildCommentBody(sourceCommentUrl, runId, triggerSource);

    this.log.info({ fn: 'postRetrigger', owner, repo: repoName, pr, runId, triggerSource }, 'Posting retrigger comment');

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

  async findCompletedReview(owner: string, repo: string, pr: number, since: Date): Promise<CompletedReview | undefined> {
    this.log.debug({ fn: 'findCompletedReview', owner, repo, pr }, 'Searching for completed review');

    for (let page = 1; ; page++) {
      const response = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pr,
        per_page: COMMENTS_FETCH_PER_PAGE,
        page,
      });

      const completedReview = response.data.find((r) => isMatchingCompletedReview(SubmittedReview.from(r), since));

      if (completedReview) {
        this.log.info(
          { fn: 'findCompletedReview', owner, repo, pr, reviewId: completedReview.id, htmlUrl: completedReview.html_url },
          'Found completed review',
        );
        return { htmlUrl: completedReview.html_url, reviewId: completedReview.id, isApproval: isApprovalReviewSignal(completedReview.body!) };
      }

      if (response.data.length < COMMENTS_FETCH_PER_PAGE) break;
    }

    return undefined;
  }

  async findLatestCoderabbitReview(owner: string, repo: string, pr: number, since: Date): Promise<CoderabbitReview | undefined> {
    this.log.debug({ fn: 'findLatestCoderabbitReview', owner, repo, pr }, 'Searching for latest CodeRabbit review');

    for (let page = 1; ; page++) {
      const response = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pr,
        per_page: COMMENTS_FETCH_PER_PAGE,
        page,
      });

      const review = response.data.find((r) => isMatchingCoderabbitReview(SubmittedReview.from(r), since));

      if (review) {
        const state = toReviewState(review.state);
        this.log.debug({ fn: 'findLatestCoderabbitReview', owner, repo, pr, reviewId: review.id, state }, 'Found CodeRabbit review');
        return { htmlUrl: review.html_url, state };
      }

      if (response.data.length < COMMENTS_FETCH_PER_PAGE) break;
    }

    return undefined;
  }

  async findLatestReviewLimitComment(owner: string, repo: string, pr: number): Promise<ReviewLimitComment | undefined> {
    this.log.debug({ fn: 'findLatestReviewLimitComment', owner, repo, pr }, 'Searching for latest rate-limit comment');

    const response = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pr,
      sort: 'created',
      direction: 'desc',
      per_page: COMMENTS_FETCH_PER_PAGE,
    });

    const rateLimitComment = response.data.find((c) => c.body && hasRateLimitMarker(c.body) && !hasOwnRetriggerMarker(c.body));

    if (rateLimitComment) {
      this.log.debug(
        { fn: 'findLatestReviewLimitComment', owner, repo, pr, commentId: rateLimitComment.id, url: rateLimitComment.html_url },
        'Found latest rate-limit comment',
      );
      return {
        repoFullName: `${owner}/${repo}`,
        prNumber: pr,
        commentId: rateLimitComment.id,
        url: rateLimitComment.html_url,
        createdAt: rateLimitComment.created_at,
        updatedAt: rateLimitComment.updated_at,
      };
    }

    return undefined;
  }

  async findAcknowledgement(owner: string, repo: string, pr: number, since: Date): Promise<AcknowledgementResult | undefined> {
    this.log.debug({ fn: 'findAcknowledgement', owner, repo, pr }, 'Searching for acknowledgement comment');

    for (let page = 1; ; page++) {
      const response = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pr,
        since: since.toISOString(),
        sort: 'created',
        direction: 'desc',
        per_page: COMMENTS_FETCH_PER_PAGE,
        page,
      });

      const ackComment = response.data.find((c) => isAcknowledgementComment(SubmittedComment.from(c)));

      if (ackComment) {
        this.log.debug(
          { fn: 'findAcknowledgement', owner, repo, pr, commentId: ackComment.id, commentUrl: ackComment.html_url },
          'Found acknowledgement comment',
        );
        return { commentId: ackComment.id, commentUrl: ackComment.html_url };
      }

      if (response.data.length < COMMENTS_FETCH_PER_PAGE) break;
    }

    return undefined;
  }
}
