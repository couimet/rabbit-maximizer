import { describe, it, expect, beforeEach } from "@jest/globals";
import { Container } from "inversify";
import type { Octokit } from "@octokit/rest";
import type { Logger } from "@couimet/logger-contract";
import {
  CoderabbitGitHubClientImpl,
  type CoderabbitGitHubClient,
} from "../../src/github/coderabbitGitHubClient.js";
import type { RepoFilter } from "../../src/types/RepoFilter.js";
import { TYPES } from "../../src/inversify-types.js";
import { createMockOctokit, createMockLogger } from "../helpers/index.js";
import type { MockIssuesRest, MockSearchRest } from "../helpers/index.js";
import pkg from "../../package.json" with { type: "json" };

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

describe("client", () => {
  let octokit: Octokit;
  let issues: MockIssuesRest;
  let search: MockSearchRest;
  let logger: Logger;

  beforeEach(() => {
    ({
      octokit,
      rest: { issues, search },
    } = createMockOctokit());
    logger = createMockLogger();
  });

  describe("postRetrigger", () => {
    it("posts a comment with the correct body template", async () => {
      issues.createComment.mockResolvedValue({
        data: {
          html_url: "https://github.com/owner/repo/issues/42#issuecomment-1",
        },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const result = await client.postRetrigger(
        "owner/repo",
        42,
        "https://github.com/owner/repo/issues/42#issuecomment-999",
        "run-abc",
      );

      const expectedBody = [
        "@coderabbitai full review",
        "",
        `🔧 rabbit-optimizer v${VERSION} run=run-abc`,
        "",
        "---",
        "",
        `🤖 rabbit-optimizer | ${REPO_URL} | v${VERSION} | run=run-abc`,
        "↩ Triggered by: https://github.com/owner/repo/issues/42#issuecomment-999",
      ].join("\n");

      expect(issues.createComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        body: expectedBody,
      });

      expect(result.htmlUrl).toBe(
        "https://github.com/owner/repo/issues/42#issuecomment-1",
      );

      expect(logger.info).toHaveBeenCalledWith(
        {
          fn: "postRetrigger",
          owner: "owner",
          repo: "repo",
          pr: 42,
          runId: "run-abc",
        },
        "Posting retrigger comment",
      );
    });
  });

  describe("fetchComment", () => {
    it("returns the comment body from the API response", async () => {
      issues.getComment.mockResolvedValue({
        data: { body: "the comment body" },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const body = await client.fetchComment("owner", "repo", 123);

      expect(issues.getComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        comment_id: 123,
      });
      expect(body).toBe("the comment body");

      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "fetchComment", owner: "owner", repo: "repo", commentId: 123 },
        "Fetching comment body",
      );
    });

    it("returns empty string when the comment body is null", async () => {
      issues.getComment.mockResolvedValue({
        data: { body: null },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const body = await client.fetchComment("owner", "repo", 123);
      expect(body).toBe("");

      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "fetchComment", owner: "owner", repo: "repo", commentId: 123 },
        "Fetching comment body",
      );
    });
  });

  describe("searchRateLimitComments", () => {
    const userFilter: RepoFilter = { pattern: "couimet/*", scope: "user" };
    const repoFilter: RepoFilter = {
      pattern: "other-org/specific-repo",
      scope: "repo",
    };

    it("builds the correct search query with user and repo scopes", async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchRateLimitComments([userFilter, repoFilter]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: expect.stringMatching(
          new RegExp(
            `^"reached your PR review rate limit" type:pr state:open \\(user:couimet OR repo:other-org\\/specific-repo\\) created:>=\\d{4}-\\d{2}-\\d{2}`,
          ),
        ),
        sort: "created",
        order: "desc",
        per_page: 100,
        page: 1,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        { fn: "searchRateLimitComments", query: expect.any(String) },
        "Searching for rate-limit comments",
      );
    });

    it("omits the qualifier clause when the repo filter is empty", async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      await client.searchRateLimitComments([]);

      expect(search.issuesAndPullRequests).toHaveBeenCalledWith({
        q: expect.stringMatching(
          new RegExp(
            `^"reached your PR review rate limit" type:pr state:open created:>=\\d{4}-\\d{2}-\\d{2}`,
          ),
        ),
        sort: "created",
        order: "desc",
        per_page: 100,
        page: 1,
      });
    });

    it("returns RateLimitComment objects for issues with matching comments", async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: "https://api.github.com/repos/couimet/my-repo",
              number: 42,
            },
          ],
        },
      });

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: 789,
            html_url:
              "https://github.com/couimet/my-repo/issues/42#issuecomment-789",
            created_at: "2026-06-18T10:00:00Z",
            body: "Some text. rate limited by coderabbit.ai. More text.",
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchRateLimitComments([userFilter]);

      expect(results).toStrictEqual([
        {
          repo_full_name: "couimet/my-repo",
          pr_number: 42,
          comment_id: 789,
          url: "https://github.com/couimet/my-repo/issues/42#issuecomment-789",
          created_at: "2026-06-18T10:00:00Z",
        },
      ]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: "searchRateLimitComments",
          query: expect.stringMatching(
            /^"reached your PR review rate limit" type:pr state:open user:couimet created:>=\d{4}-\d{2}-\d{2}/,
          ),
        },
        "Searching for rate-limit comments",
      );
    });

    it("excludes issues whose comments do not contain the rate-limit marker", async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: {
          items: [
            {
              repository_url: "https://api.github.com/repos/couimet/my-repo",
              number: 1,
            },
          ],
        },
      });

      issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1,
            html_url: "https://example.com",
            created_at: "2026-06-18T10:00:00Z",
            body: "not a rate-limit comment",
          },
        ],
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchRateLimitComments([userFilter]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: "searchRateLimitComments",
          query: expect.stringMatching(
            /^"reached your PR review rate limit" type:pr state:open user:couimet created:>=\d{4}-\d{2}-\d{2}/,
          ),
        },
        "Searching for rate-limit comments",
      );
    });

    it("returns empty array when search has no results", async () => {
      search.issuesAndPullRequests.mockResolvedValue({
        data: { items: [] },
      });

      const client = new CoderabbitGitHubClientImpl(octokit, logger);

      const results = await client.searchRateLimitComments([userFilter]);

      expect(results).toStrictEqual([]);

      expect(logger.debug).toHaveBeenCalledWith(
        {
          fn: "searchRateLimitComments",
          query: expect.stringMatching(
            /^"reached your PR review rate limit" type:pr state:open user:couimet created:>=\d{4}-\d{2}-\d{2}/,
          ),
        },
        "Searching for rate-limit comments",
      );
    });
  });

  describe("container binding", () => {
    it("resolves CoderabbitGitHubClient from the container with mock Octokit and Logger", () => {
      const container = new Container();

      container.bind<Octokit>(TYPES.Octokit).toConstantValue(octokit);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container
        .bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient)
        .to(CoderabbitGitHubClientImpl);

      const client = container.get<CoderabbitGitHubClient>(
        TYPES.CoderabbitGitHubClient,
      );
      expect(client).toBeInstanceOf(CoderabbitGitHubClientImpl);
    });
  });
});
