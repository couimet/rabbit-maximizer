import { jest, describe, it, expect } from "@jest/globals";
import {
  config,
  describeRepoFilter,
  exitWithConfigErrors,
  parseConfig,
  type Config,
} from "../src/config.js";

describe("parseConfig", () => {
  const BASE: Record<string, string> = {
    DETECTION_MODE: "poll",
    GITHUB_PAT: "ghp_test123",
    POLL_INTERVAL: "90",
    DATABASE_URL: "file:../data/rabbit-optimizer.db",
    REPO_FILTER: "couimet/*",
  };

  const env = (
    overrides: Record<string, string | undefined> = {},
  ): Record<string, string | undefined> => ({ ...BASE, ...overrides });

  // -- Failure cases ---------------------------------------------------------

  it("fails when GITHUB_PAT is missing", () => {
    const result = parseConfig(env({ GITHUB_PAT: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("GITHUB_PAT"))).toBe(true);
    }
  });

  it("fails when DETECTION_MODE is invalid", () => {
    const result = parseConfig(env({ DETECTION_MODE: "invalid" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("DETECTION_MODE"))).toBe(true);
    }
  });

  it("fails when DETECTION_MODE=webhook and WEBHOOK_SECRET is missing", () => {
    const result = parseConfig(env({ DETECTION_MODE: "webhook" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("WEBHOOK_SECRET"))).toBe(true);
    }
  });

  it("fails when DETECTION_MODE=webhook and TUNNEL_URL is missing", () => {
    const result = parseConfig(
      env({ DETECTION_MODE: "webhook", WEBHOOK_SECRET: "secret123" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("TUNNEL_URL"))).toBe(true);
    }
  });

  it("fails when GITHUB_PAT is empty string", () => {
    const result = parseConfig(env({ GITHUB_PAT: "" }));
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
    const result = parseConfig(env({ REPO_FILTER: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("fails when REPO_FILTER is an empty array", () => {
    const result = parseConfig(env({ REPO_FILTER: "[]" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("succeeds with poll mode and no webhook vars", () => {
    const result = parseConfig(env());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.DETECTION_MODE).toBe("poll");
      expect(result.value.GITHUB_PAT).toBe("ghp_test123");
      expect(result.value.REPO_FILTER).toStrictEqual([
        { pattern: "couimet/*", scope: "user" },
      ]);
    }
  });

  it("falls back to empty array when REPO_FILTER JSON is not a string array", () => {
    const result = parseConfig(env({ REPO_FILTER: "[1,2,3]" }));
    // parseRepoFilter returns [] (not a string array), schema fails on .min(1)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.some((i) => i.includes("REPO_FILTER"))).toBe(true);
    }
  });

  it("parses REPO_FILTER as JSON array with multiple entries", () => {
    const result = parseConfig(
      env({ REPO_FILTER: '["couimet/*","other-org/specific-repo"]' }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.REPO_FILTER).toStrictEqual([
        { pattern: "couimet/*", scope: "user" },
        { pattern: "other-org/specific-repo", scope: "repo" },
      ]);
    }
  });

  it("succeeds with webhook mode and both webhook vars set", () => {
    const result = parseConfig(
      env({
        DETECTION_MODE: "webhook",
        WEBHOOK_SECRET: "secret123",
        TUNNEL_URL: "https://example.com",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.DETECTION_MODE).toBe("webhook");
      expect(result.value.WEBHOOK_SECRET).toBe("secret123");
      expect(result.value.TUNNEL_URL).toBe("https://example.com");
    }
  });

  it("returns data that can produce a frozen config", () => {
    const result = parseConfig(env());
    expect(result.success).toBe(true);
    if (result.success) {
      const frozen: Readonly<Config> = Object.freeze(result.value);
      expect(Object.isFrozen(frozen)).toBe(true);
    }
  });
});

describe("auto-validated config export", () => {
  it("exports a frozen config object", () => {
    // The .env on disk has all required vars set, so the module-level
    // auto-validation passed and config is available.
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
