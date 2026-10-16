import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from './errors/index.js';
import { type Config, CONFIG_KEYS, ConfigSchema } from './schemas/index.js';
import { type RepoFilter } from './types/index.js';
import { RabbitResult } from './domain.js';

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
 * Parse a list-valued env key from a JSON array string or a bare single value.
 *   ["seat is missing", "not allowed"]  →  ["seat is missing", "not allowed"]
 *   seat is missing                     →  ["seat is missing"]
 */
const parsePhraseList = (val: string | undefined): string[] | undefined => {
  if (!val || val.trim() === '') return undefined;
  const raw = val.trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === 'string')) return parsed;
    // A leading "[" means JSON was intended; anything else is a bare phrase.
    return raw.startsWith('[') ? [] : [raw];
  } catch {
    return raw.startsWith('[') ? [] : [raw];
  }
};

/**
 * Parse and validate config from a raw env-like record.
 * Exported so tests can call it without triggering `process.exit`.
 */
export const parseConfig = (raw: Record<string, string | undefined>): RabbitResult<Config> => {
  // Key order follows CONFIG_KEYS.
  const prepped = {
    [CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC]: emptyToUndefined(raw[CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC]),
    [CONFIG_KEYS.CODERABBIT_REFUSAL_PHRASES]: parsePhraseList(raw[CONFIG_KEYS.CODERABBIT_REFUSAL_PHRASES]),
    [CONFIG_KEYS.DATABASE_URL]: emptyToUndefined(raw[CONFIG_KEYS.DATABASE_URL]),
    [CONFIG_KEYS.DETECTION_MODE]: emptyToUndefined(raw[CONFIG_KEYS.DETECTION_MODE]),
    [CONFIG_KEYS.GITHUB_API_TIMEOUT_SEC]: emptyToUndefined(raw[CONFIG_KEYS.GITHUB_API_TIMEOUT_SEC]),
    [CONFIG_KEYS.GITHUB_PAT]: emptyToUndefined(raw[CONFIG_KEYS.GITHUB_PAT]),
    [CONFIG_KEYS.IGNORE_AUTHORS]: parsePhraseList(raw[CONFIG_KEYS.IGNORE_AUTHORS]),
    [CONFIG_KEYS.IGNORE_TITLES]: parsePhraseList(raw[CONFIG_KEYS.IGNORE_TITLES]),
    [CONFIG_KEYS.MAX_RETRIGGER_ATTEMPTS]: emptyToUndefined(raw[CONFIG_KEYS.MAX_RETRIGGER_ATTEMPTS]),
    [CONFIG_KEYS.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC]: emptyToUndefined(raw[CONFIG_KEYS.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC]),
    [CONFIG_KEYS.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC]: emptyToUndefined(raw[CONFIG_KEYS.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC]),
    [CONFIG_KEYS.POLL_INTERVAL_SEC]: emptyToUndefined(raw[CONFIG_KEYS.POLL_INTERVAL_SEC]),
    [CONFIG_KEYS.PR_SCANNER_INTERVAL_SEC]: emptyToUndefined(raw[CONFIG_KEYS.PR_SCANNER_INTERVAL_SEC]),
    [CONFIG_KEYS.REPO_FILTER]: parseRepoFilter(raw[CONFIG_KEYS.REPO_FILTER]),
    [CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC]: emptyToUndefined(raw[CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC]),
    [CONFIG_KEYS.REVIEW_LIMIT_BUFFER_SEC]: emptyToUndefined(raw[CONFIG_KEYS.REVIEW_LIMIT_BUFFER_SEC]),
    [CONFIG_KEYS.REVIEW_LIMIT_FALLBACK_WAIT_SEC]: emptyToUndefined(raw[CONFIG_KEYS.REVIEW_LIMIT_FALLBACK_WAIT_SEC]),
    [CONFIG_KEYS.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK]),
    [CONFIG_KEYS.SCHEDULER_MAX_RETRIGGER_AGE_SEC]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_MAX_RETRIGGER_AGE_SEC]),
    [CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC]),
    [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC]),
    [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC]),
    [CONFIG_KEYS.SCHEDULER_STALE_TICK_MULTIPLIER]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_STALE_TICK_MULTIPLIER]),
    [CONFIG_KEYS.SCHEDULER_TICK_INTERVAL_SEC]: emptyToUndefined(raw[CONFIG_KEYS.SCHEDULER_TICK_INTERVAL_SEC]),
    [CONFIG_KEYS.TUNNEL_URL]: emptyToUndefined(raw[CONFIG_KEYS.TUNNEL_URL]),
    [CONFIG_KEYS.WEB_PORT]: emptyToUndefined(raw[CONFIG_KEYS.WEB_PORT]),
    [CONFIG_KEYS.WEBHOOK_SECRET]: emptyToUndefined(raw[CONFIG_KEYS.WEBHOOK_SECRET]),
  };

  const result = ConfigSchema.safeParse(prepped);

  if (!result.success) {
    return RabbitResult.err(
      new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.CONFIG_VALIDATION_FAILED,
        message: 'Config validation failed',
        functionName: 'parseConfig',
        details: { issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      }),
    );
  }

  return RabbitResult.ok(result.data);
};

/** @internal Exported for testing — logs every config issue and exits with code 1. */
export const exitWithConfigErrors = (error: RabbitMaximizerError): never => {
  const issues: string[] = (error.details?.issues as string[]) ?? [];
  const formatted = issues.map((i) => `  - ${i}`).join('\n');
  console.error(`[ERROR] Invalid config:\n${formatted}`);
  process.exit(1);
};

// Key order follows CONFIG_KEYS.
const parsed = parseConfig({
  [CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC]: process.env[CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC],
  [CONFIG_KEYS.CODERABBIT_REFUSAL_PHRASES]: process.env[CONFIG_KEYS.CODERABBIT_REFUSAL_PHRASES],
  [CONFIG_KEYS.DATABASE_URL]: process.env[CONFIG_KEYS.DATABASE_URL],
  [CONFIG_KEYS.DETECTION_MODE]: process.env[CONFIG_KEYS.DETECTION_MODE],
  [CONFIG_KEYS.GITHUB_API_TIMEOUT_SEC]: process.env[CONFIG_KEYS.GITHUB_API_TIMEOUT_SEC],
  [CONFIG_KEYS.GITHUB_PAT]: process.env[CONFIG_KEYS.GITHUB_PAT],
  [CONFIG_KEYS.IGNORE_AUTHORS]: process.env[CONFIG_KEYS.IGNORE_AUTHORS],
  [CONFIG_KEYS.IGNORE_TITLES]: process.env[CONFIG_KEYS.IGNORE_TITLES],
  [CONFIG_KEYS.MAX_RETRIGGER_ATTEMPTS]: process.env[CONFIG_KEYS.MAX_RETRIGGER_ATTEMPTS],
  [CONFIG_KEYS.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC]: process.env[CONFIG_KEYS.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC],
  [CONFIG_KEYS.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC]: process.env[CONFIG_KEYS.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC],
  [CONFIG_KEYS.POLL_INTERVAL_SEC]: process.env[CONFIG_KEYS.POLL_INTERVAL_SEC],
  [CONFIG_KEYS.PR_SCANNER_INTERVAL_SEC]: process.env[CONFIG_KEYS.PR_SCANNER_INTERVAL_SEC],
  [CONFIG_KEYS.REPO_FILTER]: process.env[CONFIG_KEYS.REPO_FILTER],
  [CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC]: process.env[CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC],
  [CONFIG_KEYS.REVIEW_LIMIT_BUFFER_SEC]: process.env[CONFIG_KEYS.REVIEW_LIMIT_BUFFER_SEC],
  [CONFIG_KEYS.REVIEW_LIMIT_FALLBACK_WAIT_SEC]: process.env[CONFIG_KEYS.REVIEW_LIMIT_FALLBACK_WAIT_SEC],
  [CONFIG_KEYS.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK]: process.env[CONFIG_KEYS.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK],
  [CONFIG_KEYS.SCHEDULER_MAX_RETRIGGER_AGE_SEC]: process.env[CONFIG_KEYS.SCHEDULER_MAX_RETRIGGER_AGE_SEC],
  [CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC]: process.env[CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC],
  [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC]: process.env[CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC],
  [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC]: process.env[CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC],
  [CONFIG_KEYS.SCHEDULER_STALE_TICK_MULTIPLIER]: process.env[CONFIG_KEYS.SCHEDULER_STALE_TICK_MULTIPLIER],
  [CONFIG_KEYS.SCHEDULER_TICK_INTERVAL_SEC]: process.env[CONFIG_KEYS.SCHEDULER_TICK_INTERVAL_SEC],
  [CONFIG_KEYS.TUNNEL_URL]: process.env[CONFIG_KEYS.TUNNEL_URL],
  [CONFIG_KEYS.WEB_PORT]: process.env[CONFIG_KEYS.WEB_PORT],
  [CONFIG_KEYS.WEBHOOK_SECRET]: process.env[CONFIG_KEYS.WEBHOOK_SECRET],
});

/* c8 ignore start */
if (!parsed.success) {
  exitWithConfigErrors(parsed.error);
}
/* c8 ignore stop */

export const config: Readonly<Config> = Object.freeze(parsed.value);

/** Format the configured repo filter as a human-readable summary for logging. */
export const describeRepoFilter = (filter: RepoFilter[]): string => filter.map((f) => `${f.pattern} (${f.scope})`).join(', ');
