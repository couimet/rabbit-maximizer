import dotenv from "dotenv";
import { ConfigSchema, type Config } from "./schemas/config.js";
import { type RepoFilter } from "./types/RepoFilter.js";
import { Result } from "./types/Result.js";

export type { Config };

dotenv.config();

/**
 * Convert empty-string env vars to undefined so Zod `.default()` and
 * `required_error` behave as expected.
 */
const emptyToUndefined = (val: string | undefined): string | undefined =>
  val === "" ? undefined : val;

const USER_PATTERN_PART_COUNT = 2;

/**
 * Parse REPO_FILTER from a JSON array string or a bare single pattern.
 * Infers the scope from pattern syntax:
 *   owner/*       → scope: "user"
 *   owner/repo    → scope: "repo"
 *
 *   ["couimet/*", "other-org/repo"]  →  [{pattern:"couimet/*", scope:"user"}, {pattern:"other-org/repo", scope:"repo"}]
 *   couimet/*                        →  [{pattern:"couimet/*", scope:"user"}]
 */
const parseRepoFilter = (val: string | undefined): RepoFilter[] => {
  if (!val || val.trim() === "") return [];
  const raw = val.trim();
  let patterns: string[];
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every((s: unknown) => typeof s === "string")
    ) {
      patterns = parsed;
    } else {
      patterns = [];
    }
  } catch {
    // A leading "[" means JSON was intended; a parse failure here is malformed
    // input that should fail config validation, not silently become a pattern.
    if (raw.startsWith("[")) return [];
    patterns = [raw];
  }

  return patterns.map((p) => {
    const parts = p.split("/");
    if (parts.length === USER_PATTERN_PART_COUNT && parts[1] === "*") {
      return { pattern: p, scope: "user" as const };
    }
    return { pattern: p, scope: "repo" as const };
  });
};

/**
 * Parse and validate config from a raw env-like record.
 * Exported so tests can call it without triggering `process.exit`.
 */
export const parseConfig = (
  raw: Record<string, string | undefined>,
): Result<Config, string[]> => {
  const prepped = {
    DETECTION_MODE: emptyToUndefined(raw.DETECTION_MODE),
    GITHUB_PAT: emptyToUndefined(raw.GITHUB_PAT),
    POLL_INTERVAL: emptyToUndefined(raw.POLL_INTERVAL),
    DATABASE_URL: emptyToUndefined(raw.DATABASE_URL),
    REPO_FILTER: parseRepoFilter(raw.REPO_FILTER),
    WEBHOOK_SECRET: emptyToUndefined(raw.WEBHOOK_SECRET),
    TUNNEL_URL: emptyToUndefined(raw.TUNNEL_URL),
  };

  const result = ConfigSchema.safeParse(prepped);

  if (!result.success) {
    return Result.err(
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }

  return Result.ok(result.data);
};

/** @internal Exported for testing — logs every config issue and exits with code 1. */
export const exitWithConfigErrors = (issues: string[]): never => {
  const formatted = issues.map((i) => `  - ${i}`).join("\n");
  console.error(`[ERROR] Invalid config:\n${formatted}`);
  process.exit(1);
};

const parsed = parseConfig({
  DETECTION_MODE: process.env.DETECTION_MODE,
  GITHUB_PAT: process.env.GITHUB_PAT,
  POLL_INTERVAL: process.env.POLL_INTERVAL,
  DATABASE_URL: process.env.DATABASE_URL,
  REPO_FILTER: process.env.REPO_FILTER,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  TUNNEL_URL: process.env.TUNNEL_URL,
});

/* c8 ignore start */
if (!parsed.success) {
  exitWithConfigErrors(parsed.error);
}
/* c8 ignore stop */

export const config: Readonly<Config> = Object.freeze(parsed.value);

/** Format the configured repo filter as a human-readable summary for logging. */
export const describeRepoFilter = (filter: RepoFilter[]): string =>
  filter.map((f) => `${f.pattern} (${f.scope})`).join(", ");
