import { type Config, ConfigSchema } from './schemas/config.js';
import { type RepoFilter } from './types/RepoFilter.js';
import { Result } from './types/Result.js';

import dotenv from 'dotenv';

export type { Config };

dotenv.config();

/**
 * Convert empty-string env vars to undefined so Zod `.default()` and
 * `required_error` behave as expected.
 */
const emptyToUndefined = (val: string | undefined): string | undefined => (val === '' ? undefined : val);

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
  if (!val || val.trim() === '') return [];
  const raw = val.trim();
  let patterns: string[];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === 'string')) {
      patterns = parsed;
    } else {
      patterns = [];
    }
  } catch {
    // A leading "[" means JSON was intended; a parse failure here is malformed
    // input that should fail config validation, not silently become a pattern.
    if (raw.startsWith('[')) return [];
    patterns = [raw];
  }

  return patterns.map((p) => {
    const parts = p.split('/');
    if (parts.length === USER_PATTERN_PART_COUNT && parts[1] === '*') {
      return { pattern: p, scope: 'user' as const };
    }
    return { pattern: p, scope: 'repo' as const };
  });
};

/**
 * Parse and validate config from a raw env-like record.
 * Exported so tests can call it without triggering `process.exit`.
 */
export const parseConfig = (raw: Record<string, string | undefined>): Result<Config, string[]> => {
  // Keep alphabetically sorted by key.
  const prepped = {
    DATABASE_URL: emptyToUndefined(raw.DATABASE_URL),
    DETECTION_MODE: emptyToUndefined(raw.DETECTION_MODE),
    GITHUB_API_TIMEOUT: emptyToUndefined(raw.GITHUB_API_TIMEOUT),
    GITHUB_PAT: emptyToUndefined(raw.GITHUB_PAT),
    POLL_INTERVAL: emptyToUndefined(raw.POLL_INTERVAL),
    REPO_FILTER: parseRepoFilter(raw.REPO_FILTER),
    SCHEDULER_POST_COOLDOWN: emptyToUndefined(raw.SCHEDULER_POST_COOLDOWN),
    SCHEDULER_RETRY_BACKOFF_BASE: emptyToUndefined(raw.SCHEDULER_RETRY_BACKOFF_BASE),
    SCHEDULER_RETRY_BACKOFF_MAX: emptyToUndefined(raw.SCHEDULER_RETRY_BACKOFF_MAX),
    TUNNEL_URL: emptyToUndefined(raw.TUNNEL_URL),
    WEB_PORT: emptyToUndefined(raw.WEB_PORT),
    WEBHOOK_SECRET: emptyToUndefined(raw.WEBHOOK_SECRET),
  };

  const result = ConfigSchema.safeParse(prepped);

  if (!result.success) {
    return Result.err(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  return Result.ok(result.data);
};

/** @internal Exported for testing — logs every config issue and exits with code 1. */
export const exitWithConfigErrors = (issues: string[]): never => {
  const formatted = issues.map((i) => `  - ${i}`).join('\n');
  console.error(`[ERROR] Invalid config:\n${formatted}`);
  process.exit(1);
};

// Keep alphabetically sorted by key.
const parsed = parseConfig({
  DATABASE_URL: process.env.DATABASE_URL,
  DETECTION_MODE: process.env.DETECTION_MODE,
  GITHUB_API_TIMEOUT: process.env.GITHUB_API_TIMEOUT,
  GITHUB_PAT: process.env.GITHUB_PAT,
  POLL_INTERVAL: process.env.POLL_INTERVAL,
  REPO_FILTER: process.env.REPO_FILTER,
  SCHEDULER_POST_COOLDOWN: process.env.SCHEDULER_POST_COOLDOWN,
  SCHEDULER_RETRY_BACKOFF_BASE: process.env.SCHEDULER_RETRY_BACKOFF_BASE,
  SCHEDULER_RETRY_BACKOFF_MAX: process.env.SCHEDULER_RETRY_BACKOFF_MAX,
  TUNNEL_URL: process.env.TUNNEL_URL,
  WEB_PORT: process.env.WEB_PORT,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
});

/* c8 ignore start */
if (!parsed.success) {
  exitWithConfigErrors(parsed.error);
}
/* c8 ignore stop */

export const config: Readonly<Config> = Object.freeze(parsed.value);

/** Format the configured repo filter as a human-readable summary for logging. */
export const describeRepoFilter = (filter: RepoFilter[]): string => filter.map((f) => `${f.pattern} (${f.scope})`).join(', ');
