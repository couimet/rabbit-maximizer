import { inject, injectable } from "inversify";
import type { Octokit } from "@octokit/rest";
import type { Logger } from "@couimet/logger-contract";
import type { RepoFilter } from "./types/RepoFilter.js";
import type { RateLimitComment } from "./types/RateLimitComment.js";
import {
  REVIEW_BOT_RATE_LIMIT_MARKER,
  REVIEW_BOT_RATE_LIMIT_SEARCH_TEXT,
  REVIEW_BOT_RETRIGGER_COMMAND,
  REVIEW_BOT_SELF_MARKER_PREFIX,
} from "./types/coderabbit.js";
import { TYPES } from "./inversify-types.js";
import pkg from "../package.json" with { type: "json" };

const { version } = pkg;
const repoUrl = pkg.repository.url;

const SEARCH_PER_PAGE = 100;
const SEARCH_MAX_PAGES = 3;
const COMMENTS_FETCH_PER_PAGE = 10;

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface CoderabbitGitHubClient {
  searchRateLimitComments(
    repoFilter: readonly RepoFilter[],
  ): Promise<RateLimitComment[]>;

  fetchComment(owner: string, repo: string, commentId: number): Promise<string>;

  postRetrigger(
    repo: string,
    pr: number,
    sourceCommentUrl: string,
    runId: string,
  ): Promise<{ htmlUrl: string }>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

@injectable()
export class CoderabbitGitHubClientImpl implements CoderabbitGitHubClient {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.Octokit) private readonly octokit: Octokit,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async searchRateLimitComments(
    repoFilter: readonly RepoFilter[],
  ): Promise<RateLimitComment[]> {
    const query = buildSearchQuery(repoFilter);
    this.log.debug(
      { fn: "searchRateLimitComments", query },
      "Searching for rate-limit comments",
    );

    const results: RateLimitComment[] = [];
    for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
      // issuesAndPullRequests is the canonical GET /search/issues endpoint.
      // Octokit's generated types mark it deprecated pending a rename that
      // hasn't landed as of @octokit/rest v22.0.1.
      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q: query,
        sort: "created",
        order: "desc",
        per_page: SEARCH_PER_PAGE,
        page,
      });

      if (response.data.items.length === 0) break;

      for (const item of response.data.items) {
        const repoFullName = extractRepoFullName(item.repository_url);
        const { owner, repo } = splitRepo(repoFullName);

        // Fetch recent comments to find the rate-limit marker comment
        const comments = await this.octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: item.number,
          sort: "created",
          direction: "desc",
          per_page: COMMENTS_FETCH_PER_PAGE,
        });

        const rateLimitComment = comments.data.find(
          (c) => c.body && hasRateLimitMarker(c.body),
        );

        if (rateLimitComment && rateLimitComment.body) {
          results.push({
            repo_full_name: repoFullName,
            pr_number: item.number,
            comment_id: rateLimitComment.id,
            url: rateLimitComment.html_url,
            created_at: rateLimitComment.created_at,
          });
        }
      }

      if (response.data.items.length < SEARCH_PER_PAGE) break;
    }

    return results;
  }

  async fetchComment(
    owner: string,
    repo: string,
    commentId: number,
  ): Promise<string> {
    this.log.debug(
      { fn: "fetchComment", owner, repo, commentId },
      "Fetching comment body",
    );

    const response = await this.octokit.rest.issues.getComment({
      owner,
      repo,
      comment_id: commentId,
    });

    return response.data.body ?? "";
  }

  async postRetrigger(
    repo: string,
    pr: number,
    sourceCommentUrl: string,
    runId: string,
  ): Promise<{ htmlUrl: string }> {
    const [owner, repoName] = repo.split("/");
    const body = buildCommentBody(sourceCommentUrl, runId);

    this.log.info(
      { fn: "postRetrigger", owner, repo: repoName, pr, runId },
      "Posting retrigger comment",
    );

    const response = await this.octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: pr,
      body,
    });

    return { htmlUrl: response.data.html_url };
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — exported standalone (no container needed)
// ---------------------------------------------------------------------------

/** Check if a comment body contains the CodeRabbit rate-limit marker. */
export const hasRateLimitMarker = (body: string): boolean =>
  body.includes(REVIEW_BOT_RATE_LIMIT_MARKER);

/** Check if a comment body contains this tool's own marker (prevents self-retriggering). */
export const hasOwnRetriggerMarker = (body: string): boolean =>
  body.includes(REVIEW_BOT_SELF_MARKER_PREFIX);

/**
 * Best-effort extraction of wait time in seconds from a CodeRabbit rate-limit
 * comment body.
 *
 * Target format (confirmed):
 *   "Please wait {X} minutes and {Y} seconds before requesting another review."
 *
 * Singular forms ("1 minute", "1 second") are handled. Returns `undefined`
 * when no parseable wait time is found.
 */
export const parseWaitSeconds = (body: string): number | undefined => {
  const match = body.match(
    /please wait (\d+) minutes?(?: and (\d+) seconds?)? before requesting another review/i,
  );
  if (!match) return undefined;

  const minutes = parseInt(match[1], 10);
  const seconds = match[2] ? parseInt(match[2], 10) : 0;
  return minutes * 60 + seconds;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the GitHub issue search query from a list of repo filter entries.
 *
 * Scopes:
 *   user — `user:<owner>` qualifier (wildcard patterns like `owner/*`)
 *   repo — `repo:<owner>/<name>` qualifier (explicit repos)
 */
const buildSearchQuery = (repoFilter: readonly RepoFilter[]): string => {
  const qualifiers = repoFilter.map((f) => {
    if (f.scope === "user") {
      const owner = f.pattern.split("/")[0];
      return `user:${owner}`;
    }
    return `repo:${f.pattern}`;
  });

  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  return [
    `"${REVIEW_BOT_RATE_LIMIT_SEARCH_TEXT}"`,
    "type:pr",
    "state:open",
    ...qualifiers,
    `created:>=${twentyFourHoursAgo}`,
  ].join(" ");
};

/** Map a GitHub search result item to a RateLimitComment. */
const extractRepoFullName = (repositoryUrl: string): string =>
  repositoryUrl.replace("https://api.github.com/repos/", "");

/** Split a "owner/repo" string into its two parts. */
const splitRepo = (fullName: string): { owner: string; repo: string } => {
  const [owner, repo] = fullName.split("/");
  return { owner, repo };
};

/** Build the comment body for a retrigger post. */
const buildCommentBody = (sourceCommentUrl: string, runId: string): string => {
  const marker = `🔧 rabbit-optimizer v${version} run=${runId}`;
  const footer = [
    `🤖 rabbit-optimizer | ${repoUrl} | v${version} | run=${runId}`,
    `↩ Triggered by: ${sourceCommentUrl}`,
  ].join("\n");

  return [REVIEW_BOT_RETRIGGER_COMMAND, "", marker, "", "---", "", footer].join(
    "\n",
  );
};
