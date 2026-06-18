import { jest, describe, it, expect } from "@jest/globals";
import { Container } from "inversify";
import type { Octokit } from "@octokit/rest";
import type { Logger } from "@couimet/logger-contract";
import {
  hasRateLimitMarker,
  hasOwnRetriggerMarker,
  parseWaitSeconds,
  CoderabbitGitHubClientImpl,
  type CoderabbitGitHubClient,
} from "../src/coderabbit-github.js";
import {
  REVIEW_BOT_RATE_LIMIT_MARKER,
  REVIEW_BOT_RATE_LIMIT_SEARCH_TEXT,
  REVIEW_BOT_SELF_MARKER_PREFIX,
  REVIEW_BOT_RETRIGGER_COMMAND,
} from "../src/types/coderabbit.js";
import type { RepoFilter } from "../src/types/RepoFilter.js";
import { TYPES } from "../src/inversify-types.js";
import pkg from "../package.json" with { type: "json" };

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

const mockOctokit = (overrides: Partial<Octokit> = {}): Octokit =>
  ({ ...overrides }) as unknown as Octokit;

const mockLogger = (): Logger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("hasRateLimitMarker", () => {
  it("returns true when the body contains the rate-limit marker", () => {
    expect(
      hasRateLimitMarker(`some text ${REVIEW_BOT_RATE_LIMIT_MARKER} more text`),
    ).toBe(true);
  });

  it("returns false when the body does not contain the marker", () => {
    expect(hasRateLimitMarker("some random comment body")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(hasRateLimitMarker("")).toBe(false);
  });
});

describe("hasOwnRetriggerMarker", () => {
  it("returns true when the body contains the own marker prefix", () => {
    expect(
      hasOwnRetriggerMarker(
        `${REVIEW_BOT_SELF_MARKER_PREFIX} v0.1.0 run=abc123`,
      ),
    ).toBe(true);
  });

  it("returns false when the body contains only the rate-limit marker", () => {
    expect(hasOwnRetriggerMarker(REVIEW_BOT_RATE_LIMIT_MARKER)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(hasOwnRetriggerMarker("")).toBe(false);
  });
});

describe("parseWaitSeconds", () => {
  it("extracts minutes and seconds from the standard CodeRabbit format", () => {
    const body =
      "Please wait 11 minutes and 35 seconds before requesting another review.";
    expect(parseWaitSeconds(body)).toBe(11 * 60 + 35);
  });

  it("handles singular minute and second", () => {
    const body =
      "Please wait 1 minute and 1 second before requesting another review.";
    expect(parseWaitSeconds(body)).toBe(61);
  });

  it("handles minutes only (no seconds clause)", () => {
    const body = "Please wait 5 minutes before requesting another review.";
    expect(parseWaitSeconds(body)).toBe(300);
  });

  it("is case-insensitive", () => {
    const body =
      "PLEASE WAIT 2 MINUTES AND 30 SECONDS BEFORE REQUESTING ANOTHER REVIEW.";
    expect(parseWaitSeconds(body)).toBe(150);
  });

  it("returns undefined when the body does not match the expected format", () => {
    expect(parseWaitSeconds("some random text")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(parseWaitSeconds("")).toBeUndefined();
  });

  it("returns undefined when no numeric value is present", () => {
    expect(
      parseWaitSeconds(
        "Please wait minutes and seconds before requesting another review.",
      ),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// CoderabbitGitHubClientImpl.postRetrigger
// ---------------------------------------------------------------------------

describe("postRetrigger", () => {
  it("posts a comment with the correct body template", async () => {
    const createComment = jest.fn<any>().mockResolvedValue({
      data: {
        html_url: "https://github.com/owner/repo/issues/42#issuecomment-1",
      },
    });

    const octokit = mockOctokit({
      rest: { issues: { createComment } },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
    const client = new CoderabbitGitHubClientImpl(octokit, logger);

    const result = await client.postRetrigger(
      "owner/repo",
      42,
      "https://github.com/owner/repo/issues/42#issuecomment-999",
      "run-abc",
    );

    const expectedBody = [
      REVIEW_BOT_RETRIGGER_COMMAND,
      "",
      `🔧 rabbit-optimizer v${VERSION} run=run-abc`,
      "",
      "---",
      "",
      `🤖 rabbit-optimizer | ${REPO_URL} | v${VERSION} | run=run-abc`,
      "↩ Triggered by: https://github.com/owner/repo/issues/42#issuecomment-999",
    ].join("\n");

    expect(createComment).toHaveBeenCalledWith({
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

// ---------------------------------------------------------------------------
// CoderabbitGitHubClientImpl.fetchComment
// ---------------------------------------------------------------------------

describe("fetchComment", () => {
  it("returns the comment body from the API response", async () => {
    const getComment = jest.fn<any>().mockResolvedValue({
      data: { body: "the comment body" },
    });

    const octokit = mockOctokit({
      rest: { issues: { getComment } },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
    const client = new CoderabbitGitHubClientImpl(octokit, logger);

    const body = await client.fetchComment("owner", "repo", 123);

    expect(getComment).toHaveBeenCalledWith({
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
    const getComment = jest.fn<any>().mockResolvedValue({
      data: { body: null },
    });

    const octokit = mockOctokit({
      rest: { issues: { getComment } },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
    const client = new CoderabbitGitHubClientImpl(octokit, logger);

    const body = await client.fetchComment("owner", "repo", 123);
    expect(body).toBe("");
  });
});

// ---------------------------------------------------------------------------
// CoderabbitGitHubClientImpl.searchRateLimitComments
// ---------------------------------------------------------------------------

describe("searchRateLimitComments", () => {
  const userFilter: RepoFilter = { pattern: "couimet/*", scope: "user" };
  const repoFilter: RepoFilter = {
    pattern: "other-org/specific-repo",
    scope: "repo",
  };

  it("builds the correct search query with user and repo scopes", async () => {
    const issuesAndPullRequests = jest.fn<any>().mockResolvedValue({
      data: { items: [] },
    });

    const octokit = mockOctokit({
      rest: {
        search: { issuesAndPullRequests },
        issues: { listComments: jest.fn() },
      },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
    const client = new CoderabbitGitHubClientImpl(octokit, logger);

    await client.searchRateLimitComments([userFilter, repoFilter]);

    expect(issuesAndPullRequests).toHaveBeenCalledWith({
      q: expect.stringMatching(
        new RegExp(
          `^"reached your PR review rate limit" type:pr state:open user:couimet repo:other-org\\/specific-repo created:>=\\d{4}-\\d{2}-\\d{2}`,
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

  it("returns RateLimitComment objects for issues with matching comments", async () => {
    const issuesAndPullRequests = jest.fn<any>().mockResolvedValue({
      data: {
        items: [
          {
            repository_url: "https://api.github.com/repos/couimet/my-repo",
            number: 42,
          },
        ],
      },
    });

    const listComments = jest.fn<any>().mockResolvedValue({
      data: [
        {
          id: 789,
          html_url:
            "https://github.com/couimet/my-repo/issues/42#issuecomment-789",
          created_at: "2026-06-18T10:00:00Z",
          body: `Some text. ${REVIEW_BOT_RATE_LIMIT_MARKER}. More text.`,
        },
      ],
    });

    const octokit = mockOctokit({
      rest: { search: { issuesAndPullRequests }, issues: { listComments } },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
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
  });

  it("excludes issues whose comments do not contain the rate-limit marker", async () => {
    const issuesAndPullRequests = jest.fn<any>().mockResolvedValue({
      data: {
        items: [
          {
            repository_url: "https://api.github.com/repos/couimet/my-repo",
            number: 1,
          },
        ],
      },
    });

    const listComments = jest.fn<any>().mockResolvedValue({
      data: [
        {
          id: 1,
          html_url: "https://example.com",
          created_at: "2026-06-18T10:00:00Z",
          body: "not a rate-limit comment",
        },
      ],
    });

    const octokit = mockOctokit({
      rest: { search: { issuesAndPullRequests }, issues: { listComments } },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
    const client = new CoderabbitGitHubClientImpl(octokit, logger);

    const results = await client.searchRateLimitComments([userFilter]);

    expect(results).toStrictEqual([]);
  });

  it("returns empty array when search has no results", async () => {
    const issuesAndPullRequests = jest.fn<any>().mockResolvedValue({
      data: { items: [] },
    });

    const octokit = mockOctokit({
      rest: {
        search: { issuesAndPullRequests },
        issues: { listComments: jest.fn() },
      },
    } as unknown as Octokit["rest"]);

    const logger = mockLogger();
    const client = new CoderabbitGitHubClientImpl(octokit, logger);

    const results = await client.searchRateLimitComments([userFilter]);

    expect(results).toStrictEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Inversify container binding
// ---------------------------------------------------------------------------

describe("container binding", () => {
  it("resolves CoderabbitGitHubClient from the container with mock Octokit and Logger", () => {
    const container = new Container();

    container.bind<Octokit>(TYPES.Octokit).toConstantValue(mockOctokit());
    container.bind<Logger>(TYPES.Logger).toConstantValue(mockLogger());
    container
      .bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient)
      .to(CoderabbitGitHubClientImpl);

    const client = container.get<CoderabbitGitHubClient>(
      TYPES.CoderabbitGitHubClient,
    );
    expect(client).toBeInstanceOf(CoderabbitGitHubClientImpl);
  });
});
