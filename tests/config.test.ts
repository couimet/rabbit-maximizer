import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { getRandomString } from "@couimet/dynamic-testing";
import {
  config,
  describeRepoFilter,
  exitWithConfigErrors,
  parseConfig,
  type Config,
} from "../src/config.js";

describe("parseConfig", () => {
  let githubPat: string;
  let webhookSecret: string;
  let tunnelUrl: string;
  let BASE: Record<string, string>;

  beforeEach(() => {
    githubPat = getRandomString({ charset: "alphanumeric", length: 20 });
    webhookSecret = getRandomString({ charset: "alphanumeric", length: 16 });
    tunnelUrl = `https://${getRandomString({ charset: "alpha", length: 8 })}.com`;
    BASE = {
      DETECTION_MODE: "poll",
      GITHUB_PAT: githubPat,
      POLL_INTERVAL: "90",
      DATABASE_URL: "file:../data/rabbit-optimizer.db",
      REPO_FILTER: "couimet/*",
    };
  });

  const env = (
    base: Record<string, string>,
    overrides: Record<string, string | undefined> = {},
  ): Record<string, string | undefined> => ({ ...base, ...overrides });

  // -- Failure cases ---------------------------------------------------------

  it("fails when GITHUB_PAT is missing", () => {
    const result = parseConfig(env(BASE, { GITHUB_PAT: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("GITHUB_PAT"))).toBe(true);
    }
  });

  it("fails when DETECTION_MODE is invalid", () => {
    const result = parseConfig(env(BASE, { DETECTION_MODE: "invalid" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("DETECTION_MODE"))).toBe(true);
    }
  });

  it("fails when DETECTION_MODE=webhook and WEBHOOK_SECRET is missing", () => {
    const result = parseConfig(env(BASE, { DETECTION_MODE: "webhook" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("WEBHOOK_SECRET"))).toBe(true);
    }
  });

  it("fails when DETECTION_MODE=webhook and TUNNEL_URL is missing", () => {
    const result = parseConfig(
      env(BASE, { DETECTION_MODE: "webhook", WEBHOOK_SECRET: webhookSecret }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("TUNNEL_URL"))).toBe(true);
    }
  });

  it("fails when GITHUB_PAT is empty string", () => {
    const result = parseConfig(env(BASE, { GITHUB_PAT: "" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("GITHUB_PAT"))).toBe(true);
    }
  });

  // -- Success cases ---------------------------------------------------------

  it("applies default POLL_INTERVAL when absent", () => {
    const { POLL_INTERVAL: _, ...rest } = BASE;
    const result = parseConfig(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.POLL_INTERVAL).toBe(90);
    }
  });

  it("applies default DATABASE_URL when absent", () => {
    const { DATABASE_URL: _, ...rest } = BASE;
    const result = parseConfig(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.DATABASE_URL).toBe(
        "file:../data/rabbit-optimizer.db",
      );
    }
  });

  it("applies default DETECTION_MODE when absent", () => {
    const { DETECTION_MODE: _, ...rest } = BASE;
    const result = parseConfig(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.DETECTION_MODE).toBe("poll");
    }
  });

  it("fails when REPO_FILTER is missing", () => {
    const result = parseConfig(env(BASE, { REPO_FILTER: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("fails when REPO_FILTER is an empty array", () => {
    const result = parseConfig(env(BASE, { REPO_FILTER: "[]" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("fails when REPO_FILTER is a malformed JSON array rather than treating it as a bare pattern", () => {
    const result = parseConfig(env(BASE, { REPO_FILTER: '["couimet/*"' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("parses REPO_FILTER as JSON array with multiple entries", () => {
    const result = parseConfig(
      env(BASE, { REPO_FILTER: '["couimet/*","other-org/specific-repo"]' }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.REPO_FILTER).toStrictEqual([
        { pattern: "couimet/*", scope: "user" },
        { pattern: "other-org/specific-repo", scope: "repo" },
      ]);
    }
  });

  it("succeeds with poll mode and no webhook vars", () => {
    const result = parseConfig(BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.DETECTION_MODE).toBe("poll");
      expect(result.value.GITHUB_PAT).toBe(githubPat);
      expect(result.value.REPO_FILTER).toStrictEqual([
        { pattern: "couimet/*", scope: "user" },
      ]);
    }
  });

  it("falls back to empty array when REPO_FILTER JSON is not a string array", () => {
    const result = parseConfig(env(BASE, { REPO_FILTER: "[1,2,3]" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("succeeds with webhook mode and both webhook vars set", () => {
    const result = parseConfig(
      env(BASE, {
        DETECTION_MODE: "webhook",
        WEBHOOK_SECRET: webhookSecret,
        TUNNEL_URL: tunnelUrl,
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.DETECTION_MODE).toBe("webhook");
      expect(result.value.WEBHOOK_SECRET).toBe(webhookSecret);
      expect(result.value.TUNNEL_URL).toBe(tunnelUrl);
    }
  });

  it("returns data that can produce a frozen config", () => {
    const result = parseConfig(BASE);
    expect(result.success).toBe(true);
    if (result.success) {
      const frozen: Readonly<Config> = Object.freeze(result.value);
      expect(Object.isFrozen(frozen)).toBe(true);
    }
  });
});

describe("auto-validated config export", () => {
  it("exports a frozen config object", () => {
    expect(Object.isFrozen(config)).toBe(true);
    expect(typeof config.GITHUB_PAT).toBe("string");
    expect(typeof config.DETECTION_MODE).toBe("string");
  });
});

describe("exitWithConfigErrors", () => {
  it("calls console.error and process.exit with code 1", () => {
    jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit(1)");
    });
    const mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => exitWithConfigErrors(["GITHUB_PAT: required"])).toThrow(
      "process.exit(1)",
    );
    expect(mockConsoleError).toHaveBeenCalledWith(
      "[ERROR] Invalid config:\n  - GITHUB_PAT: required",
    );
  });
});

describe("describeRepoFilter", () => {
  it("formats a single user-scope filter", () => {
    expect(describeRepoFilter([{ pattern: "couimet/*", scope: "user" }])).toBe(
      "couimet/* (user)",
    );
  });

  it("formats a single repo-scope filter", () => {
    expect(
      describeRepoFilter([{ pattern: "other-org/repo", scope: "repo" }]),
    ).toBe("other-org/repo (repo)");
  });

  it("joins multiple filters with commas", () => {
    expect(
      describeRepoFilter([
        { pattern: "couimet/*", scope: "user" },
        { pattern: "other-org/repo", scope: "repo" },
      ]),
    ).toBe("couimet/* (user), other-org/repo (repo)");
  });

  it("returns empty string for an empty filter list", () => {
    expect(describeRepoFilter([])).toBe("");
  });
});
