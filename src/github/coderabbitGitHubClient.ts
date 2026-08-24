import { type TriggerSource, TYPES } from '../domain.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../errors/index.js';
import type { AcknowledgementResult, DetectedComment, DiscoveredPR, PRState, RepoFilter, RetriggerDiagnosis, ReviewLimitComment } from '../types/index.js';

import type { CompletedReview, FetchCommentResult, ListedComment, RetriggerComment } from './types/index.js';
import {
  buildCommentBody,
  buildOpenPRSearchQuery,
  buildSearchQuery,
  classifyCoderabbitComment,
  extractRepoFullName,
  hasOwnRetriggerMarker,
  hasRateLimitMarker,
  hasRateLimitOrSkipMarker,
  isAcknowledgementComment,
  isApprovalReviewSignal,
  isMatchingCompletedReview,
  isReviewForRun,
  normalizeCommentBody,
  parseCommentUrl,
  splitRepo,
  SubmittedComment,
  SubmittedReview,
} from './index.js';

import type { Logger } from '@couimet/logger-contract';
import type { Octokit } from '@octokit/rest';
import { inject, injectable } from 'inversify';

const SEARCH_PER_PAGE = 100;
const SEARCH_MAX_PAGES = 3;
const COMMENTS_FETCH_PER_PAGE = 100;
const OPEN_PR_SEARCH_PER_PAGE = 100;
const OPEN_PR_SEARCH_MAX_PAGES = 3;
const UNKNOWN_USER = '<unknown>';

export interface CoderabbitGitHubClient {
  searchReviewLimitComments(repoFilter: readonly RepoFilter[]): Promise<DetectedComment[]>;

  fetchComment(owner: string, repo: string, commentId: number): Promise<FetchCommentResult>;
  fetchCommentByUrl(url: string): Promise<FetchCommentResult>;

  listComments(owner: string, repo: string, issueNumber: number): Promise<ListedComment[]>;

  listOpenPRs(repoFilter: readonly RepoFilter[]): Promise<DiscoveredPR[]>;

  postRetrigger(
    repo: string,
    pr: number,
    sourceCommentUrl: string | undefined,
    runId: string,
    triggerSource: TriggerSource,
    diagnosis: RetriggerDiagnosis | undefined,
  ): Promise<RetriggerComment>;

  getPRState(repo: string, pr: number): Promise<PRState>;
  getPRHeadSha(owner: string, repo: string, prNumber: number): Promise<string>;
  getCommitCommittedAt(owner: string, repo: string, sha: string): Promise<string>;

  findCompletedReview(
    owner: string,
    repo: string,
    pr: number,
    since: Date,
    expectedRunId: string | undefined,
    expectedHeadSha: string | undefined,
  ): Promise<CompletedReview | undefined>;

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

        const rateLimitComment = comments.data.find((c) => hasRateLimitOrSkipMarker(c.body));

        if (rateLimitComment && rateLimitComment.body) {
          results.push({
            repoFullName,
            prNumber: item.number,
            prTitle: item.title,
            body: rateLimitComment.body,
            commentType: classifyCoderabbitComment(rateLimitComment.body).classification,
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

    return { body: normalizeCommentBody(response.data.body), createdAt: response.data.created_at, updatedAt: response.data.updated_at };
  }

  // eslint-disable-next-line require-await
  async fetchCommentByUrl(url: string): Promise<FetchCommentResult> {
    const parsed = parseCommentUrl(url);
    if (!parsed) {
      throw new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.GITHUB_INVALID_COMMENT_URL,
        message: `Cannot parse comment URL: ${url}`,
        functionName: 'fetchCommentByUrl',
        details: { url },
      });
    }
    return this.fetchComment(parsed.owner, parsed.repo, parsed.commentId);
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
        results.push({
          body: normalizeCommentBody(c.body),
          id: c.id,
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
          user: c.user?.login ?? UNKNOWN_USER,
        });
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

  async postRetrigger(
    repo: string,
    pr: number,
    sourceCommentUrl: string | undefined,
    runId: string,
    triggerSource: TriggerSource,
    diagnosis: RetriggerDiagnosis | undefined,
  ): Promise<RetriggerComment> {
    const { owner, repo: repoName } = splitRepo(repo);
    const body = buildCommentBody(sourceCommentUrl, runId, triggerSource, diagnosis);

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

    return { state: response.data.state, merged_at: response.data.merged_at, closed_at: response.data.closed_at };
  }

  async getPRHeadSha(owner: string, repo: string, prNumber: number): Promise<string> {
    this.log.debug({ fn: 'getPRHeadSha', owner, repo, prNumber }, 'Fetching PR head sha');

    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return response.data.head.sha;
  }

  async getCommitCommittedAt(owner: string, repo: string, sha: string): Promise<string> {
    this.log.debug({ fn: 'getCommitCommittedAt', owner, repo, sha }, 'Fetching commit timestamp');

    const response = await this.octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });

    // Every commit has a committer date; the API type only marks it nullable.
    return response.data.commit.committer!.date!;
  }

  async findCompletedReview(
    owner: string,
    repo: string,
    pr: number,
    since: Date,
    expectedRunId: string | undefined,
    expectedHeadSha: string | undefined,
  ): Promise<CompletedReview | undefined> {
    this.log.debug({ fn: 'findCompletedReview', owner, repo, pr }, 'Searching for completed review');

    // listReviews returns reviews oldest-first, so the first accepted match is the OLDEST,
    // not the freshest. Scan every page and keep the newest accepted review.
    let latest: CompletedReview | undefined;
    for (let page = 1; ; page++) {
      const response = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pr,
        per_page: COMMENTS_FETCH_PER_PAGE,
        page,
      });

      for (const r of response.data) {
        const review = SubmittedReview.from(r);
        if (!isMatchingCompletedReview(review, since) || !isReviewForRun(review, expectedRunId, expectedHeadSha)) continue;
        latest = {
          htmlUrl: r.html_url,
          reviewId: r.id,
          // Body is a string here: isMatchingCompletedReview rejects bodyless reviews first.
          isApproval: isApprovalReviewSignal(r.body!),
          commitId: r.commit_id ?? undefined,
        };
      }

      if (response.data.length < COMMENTS_FETCH_PER_PAGE) break;
    }

    if (latest) {
      this.log.info({ fn: 'findCompletedReview', owner, repo, pr, reviewId: latest.reviewId, htmlUrl: latest.htmlUrl }, 'Found completed review');
    }
    return latest;
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
