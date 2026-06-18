import dotenv from "dotenv";
import { ConfigSchema, type Config } from "./schemas/config.js";
import { Result } from "./types/Result.js";

export type { Config };

dotenv.config();

/**
 * Convert empty-string env vars to undefined so Zod `.default()` and
 * `required_error` behave as expected.
 */
const emptyToUndefined = (val: string | undefined): string | undefined =>
  val === "" ? undefined : val;

/**
 * Parse REPO_FILTER from a JSON array string or a bare single pattern.
 *
 *   ["couimet/*", "other-org/repo"]  →  ["couimet/*", "other-org/repo"]
 *   couimet/*                        →  ["couimet/*"]
 */
const parseRepoFilter = (val: string | undefined): string[] => {
  if (!val || val === "") return [];
  try {
    const parsed = JSON.parse(val);
    if (
      Array.isArray(parsed) &&
      parsed.every((s: unknown) => typeof s === "string")
    ) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  // Bare string without brackets — treat as a single-entry list
  return [val];
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

/* istanbul ignore next */
if (!parsed.success) {
  exitWithConfigErrors(parsed.error);
}

export const config: Readonly<Config> = Object.freeze(parsed.value);
