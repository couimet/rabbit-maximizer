import { type Config, ConfigSchema } from '../../src/schemas/index.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const DEFAULT_PAUSE_NOTIFICATION_INITIAL_DELAY_SEC = 1800;
const DEFAULT_PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC = 900;
const DEFAULT_MAX_RETRIGGER_ATTEMPTS = 10;
const DEFAULT_REVIEW_DETECTION_LOOKBACK_SEC = 7200;
const DEFAULT_MAX_RETRIGGER_AGE_SEC = 259200;
const DEFAULT_MAX_PR_STATE_FETCHES_PER_TICK = 5;
const ACCOUNT_COOLDOWN_SEC = 3600;
const DEFAULT_CODERABBIT_ACKNOWLEDGEMENT_PHRASES = ['auto-generated reply by CodeRabbit'];
const DEFAULT_CODERABBIT_APPROVAL_PHRASES = ['No actionable comments were generated in the recent review.'];
const DEFAULT_CODERABBIT_CHANGES_SUGGESTED_PHRASES = ['Actionable comments posted:'];
const DEFAULT_CODERABBIT_PAUSE_PHRASES = ['review paused by coderabbit.ai'];
const DEFAULT_CODERABBIT_RATE_LIMIT_PHRASES = ['rate limited by coderabbit.ai'];
const DEFAULT_CODERABBIT_REFUSAL_PHRASES = ['without an assigned CodeRabbit review seat'];
const DEFAULT_CODERABBIT_SKIP_PHRASES = ['skip review by coderabbit.ai'];
const DEFAULT_CODERABBIT_WALKTHROUGH_PHRASES = ['review_stack_entry_start'];
const DEFAULT_HEAD_DRIFT_GRACE_SEC = 900;

describe('ConfigSchema', () => {
  let githubPat: string;
  let webhookSecret: string;
  let tunnelUrl: string;
  let BASE: Config;

  beforeEach(() => {
    githubPat = getRandomString({ charset: 'alphanumeric', length: 20 });
    webhookSecret = getRandomString({ charset: 'alphanumeric', length: 16 });
    tunnelUrl = `https://${getRandomString({ charset: 'alpha', length: 8 })}.com`;
    BASE = {
      CODERABBIT_ACCOUNT_COOLDOWN_SEC: ACCOUNT_COOLDOWN_SEC,
      CODERABBIT_ACKNOWLEDGEMENT_PHRASES: DEFAULT_CODERABBIT_ACKNOWLEDGEMENT_PHRASES,
      CODERABBIT_APPROVAL_PHRASES: DEFAULT_CODERABBIT_APPROVAL_PHRASES,
      CODERABBIT_CHANGES_SUGGESTED_PHRASES: DEFAULT_CODERABBIT_CHANGES_SUGGESTED_PHRASES,
      CODERABBIT_PAUSE_PHRASES: DEFAULT_CODERABBIT_PAUSE_PHRASES,
      CODERABBIT_RATE_LIMIT_PHRASES: DEFAULT_CODERABBIT_RATE_LIMIT_PHRASES,
      CODERABBIT_REFUSAL_PHRASES: DEFAULT_CODERABBIT_REFUSAL_PHRASES,
      CODERABBIT_SKIP_PHRASES: DEFAULT_CODERABBIT_SKIP_PHRASES,
      CODERABBIT_WALKTHROUGH_PHRASES: DEFAULT_CODERABBIT_WALKTHROUGH_PHRASES,
      DETECTION_MODE: 'poll' as const,
      GITHUB_API_TIMEOUT_SEC: 10,
      GITHUB_PAT: githubPat,
      HEAD_DRIFT_GRACE_SEC: DEFAULT_HEAD_DRIFT_GRACE_SEC,
      IGNORE_AUTHORS: [],
      IGNORE_TITLES: [],
      PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: DEFAULT_PAUSE_NOTIFICATION_INITIAL_DELAY_SEC,
      PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: DEFAULT_PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC,
      MAX_RETRIGGER_ATTEMPTS: DEFAULT_MAX_RETRIGGER_ATTEMPTS,
      POLL_INTERVAL_SEC: 90,
      PR_SCANNER_INTERVAL_SEC: 300,
      REVIEW_DETECTION_LOOKBACK_SEC: DEFAULT_REVIEW_DETECTION_LOOKBACK_SEC,
      REVIEW_LIMIT_BUFFER_SEC: 60,
      REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600,
      DATABASE_URL: 'file:./data/rabbit-maximizer.db',
      REPO_FILTER: [{ pattern: 'couimet/*', scope: 'user' as const }],
      SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK: DEFAULT_MAX_PR_STATE_FETCHES_PER_TICK,
      SCHEDULER_MAX_RETRIGGER_AGE_SEC: DEFAULT_MAX_RETRIGGER_AGE_SEC,
      SCHEDULER_RETRIGGER_SPACING_SEC: 180,
      SCHEDULER_RETRY_BACKOFF_BASE_SEC: 60,
      SCHEDULER_RETRY_BACKOFF_MAX_SEC: 3600,
      SCHEDULER_STALE_TICK_MULTIPLIER: 4,
      SCHEDULER_TICK_INTERVAL_SEC: 10,
      WEB_PORT: 3000,
    };
  });

  // -- Success cases -----------------------------------------------------------

  it('accepts a valid poll config', () => {
    expect(ConfigSchema.safeParse(BASE).success).toBe(true);
  });

  it('accepts a valid webhook config with both webhook vars', () => {
    expect(
      ConfigSchema.safeParse({
        ...BASE,
        DETECTION_MODE: 'webhook',
        WEBHOOK_SECRET: webhookSecret,
        TUNNEL_URL: tunnelUrl,
      }).success,
    ).toBe(true);
  });

  it('applies default DETECTION_MODE when missing', () => {
    const { DETECTION_MODE: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DETECTION_MODE).toBe('poll');
    }
  });

  it('applies default POLL_INTERVAL_SEC when missing', () => {
    const { POLL_INTERVAL_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLL_INTERVAL_SEC).toBe(90);
    }
  });

  it('applies default SCHEDULER_TICK_INTERVAL_SEC when missing', () => {
    const { SCHEDULER_TICK_INTERVAL_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SCHEDULER_TICK_INTERVAL_SEC).toBe(10);
    }
  });

  it('applies default PAUSE_NOTIFICATION_INITIAL_DELAY_SEC when missing', () => {
    const { PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC).toBe(DEFAULT_PAUSE_NOTIFICATION_INITIAL_DELAY_SEC);
    }
  });

  it('applies default PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC when missing', () => {
    const { PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC).toBe(DEFAULT_PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC);
    }
  });

  it('coerces numeric POLL_INTERVAL_SEC from a string', () => {
    const customPollIntervalSec = 120;
    const result = ConfigSchema.safeParse({ ...BASE, POLL_INTERVAL_SEC: String(customPollIntervalSec) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLL_INTERVAL_SEC).toBe(customPollIntervalSec);
    }
  });

  it('defaults PR_SCANNER_INTERVAL_SEC to 300', () => {
    const { PR_SCANNER_INTERVAL_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PR_SCANNER_INTERVAL_SEC).toBe(300);
    }
  });

  it('coerces numeric PR_SCANNER_INTERVAL_SEC from a string', () => {
    const customPrScannerIntervalSec = 450;
    const result = ConfigSchema.safeParse({ ...BASE, PR_SCANNER_INTERVAL_SEC: String(customPrScannerIntervalSec) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PR_SCANNER_INTERVAL_SEC).toBe(customPrScannerIntervalSec);
    }
  });

  it('applies default REVIEW_DETECTION_LOOKBACK_SEC when missing', () => {
    const { REVIEW_DETECTION_LOOKBACK_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REVIEW_DETECTION_LOOKBACK_SEC).toBe(DEFAULT_REVIEW_DETECTION_LOOKBACK_SEC);
    }
  });

  it('applies default MAX_RETRIGGER_ATTEMPTS when missing', () => {
    const { MAX_RETRIGGER_ATTEMPTS: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MAX_RETRIGGER_ATTEMPTS).toBe(DEFAULT_MAX_RETRIGGER_ATTEMPTS);
    }
  });

  it('applies default SCHEDULER_MAX_RETRIGGER_AGE_SEC when missing', () => {
    const { SCHEDULER_MAX_RETRIGGER_AGE_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SCHEDULER_MAX_RETRIGGER_AGE_SEC).toBe(DEFAULT_MAX_RETRIGGER_AGE_SEC);
    }
  });

  it('applies default SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK when missing', () => {
    const { SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK).toBe(DEFAULT_MAX_PR_STATE_FETCHES_PER_TICK);
    }
  });

  it('coerces numeric REVIEW_DETECTION_LOOKBACK_SEC from a string', () => {
    const customLookbackSec = 3600;
    const result = ConfigSchema.safeParse({ ...BASE, REVIEW_DETECTION_LOOKBACK_SEC: String(customLookbackSec) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REVIEW_DETECTION_LOOKBACK_SEC).toBe(customLookbackSec);
    }
  });

  it('coerces numeric MAX_RETRIGGER_ATTEMPTS from a string', () => {
    const customMaxAttempts = 5;
    const result = ConfigSchema.safeParse({ ...BASE, MAX_RETRIGGER_ATTEMPTS: String(customMaxAttempts) });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MAX_RETRIGGER_ATTEMPTS).toBe(customMaxAttempts);
    }
  });

  it('applies default CODERABBIT_REFUSAL_PHRASES when missing', () => {
    const { CODERABBIT_REFUSAL_PHRASES: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CODERABBIT_REFUSAL_PHRASES).toStrictEqual(DEFAULT_CODERABBIT_REFUSAL_PHRASES);
    }
  });

  it('applies the shipped CodeRabbit phrase defaults when every phrase key is missing', () => {
    const {
      CODERABBIT_ACKNOWLEDGEMENT_PHRASES: _acknowledgement,
      CODERABBIT_APPROVAL_PHRASES: _approval,
      CODERABBIT_CHANGES_SUGGESTED_PHRASES: _changesSuggested,
      CODERABBIT_PAUSE_PHRASES: _pause,
      CODERABBIT_RATE_LIMIT_PHRASES: _rateLimit,
      CODERABBIT_REFUSAL_PHRASES: _refusal,
      CODERABBIT_SKIP_PHRASES: _skip,
      CODERABBIT_WALKTHROUGH_PHRASES: _walkthrough,
      ...rest
    } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect({
        acknowledgement: result.data.CODERABBIT_ACKNOWLEDGEMENT_PHRASES,
        approval: result.data.CODERABBIT_APPROVAL_PHRASES,
        changesSuggested: result.data.CODERABBIT_CHANGES_SUGGESTED_PHRASES,
        pause: result.data.CODERABBIT_PAUSE_PHRASES,
        rateLimit: result.data.CODERABBIT_RATE_LIMIT_PHRASES,
        refusal: result.data.CODERABBIT_REFUSAL_PHRASES,
        skip: result.data.CODERABBIT_SKIP_PHRASES,
        walkthrough: result.data.CODERABBIT_WALKTHROUGH_PHRASES,
      }).toStrictEqual({
        acknowledgement: ['auto-generated reply by CodeRabbit'],
        approval: ['No actionable comments were generated in the recent review.'],
        changesSuggested: ['Actionable comments posted:'],
        pause: ['review paused by coderabbit.ai'],
        rateLimit: ['rate limited by coderabbit.ai'],
        refusal: ['without an assigned CodeRabbit review seat'],
        skip: ['skip review by coderabbit.ai'],
        walkthrough: ['review_stack_entry_start'],
      });
    }
  });

  it('applies the default HEAD_DRIFT_GRACE_SEC when missing', () => {
    const { HEAD_DRIFT_GRACE_SEC: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.HEAD_DRIFT_GRACE_SEC).toBe(900);
    }
  });

  it('applies an empty IGNORE_AUTHORS list when missing', () => {
    const { IGNORE_AUTHORS: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.IGNORE_AUTHORS).toStrictEqual([]);
    }
  });

  it('applies an empty IGNORE_TITLES list when missing', () => {
    const { IGNORE_TITLES: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.IGNORE_TITLES).toStrictEqual([]);
    }
  });

  it('accepts IGNORE_AUTHORS and IGNORE_TITLES patterns that compile', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_AUTHORS: ['renovate', '^dependabot'], IGNORE_TITLES: ['^chore\\('] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.IGNORE_AUTHORS).toStrictEqual(['renovate', '^dependabot']);
      expect(result.data.IGNORE_TITLES).toStrictEqual(['^chore\\(']);
    }
  });

  // -- Failure cases -----------------------------------------------------------

  it('rejects an invalid DETECTION_MODE', () => {
    expect(ConfigSchema.safeParse({ ...BASE, DETECTION_MODE: 'invalid' }).success).toBe(false);
  });

  it('rejects missing GITHUB_PAT', () => {
    const { GITHUB_PAT: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('GITHUB_PAT'))).toBe(true);
    }
  });

  it('rejects empty GITHUB_PAT', () => {
    expect(ConfigSchema.safeParse({ ...BASE, GITHUB_PAT: '' }).success).toBe(false);
  });

  it('rejects negative POLL_INTERVAL_SEC', () => {
    expect(ConfigSchema.safeParse({ ...BASE, POLL_INTERVAL_SEC: -5 }).success).toBe(false);
  });

  it('rejects negative PR_SCANNER_INTERVAL_SEC', () => {
    expect(ConfigSchema.safeParse({ ...BASE, PR_SCANNER_INTERVAL_SEC: -5 }).success).toBe(false);
  });

  it('rejects empty REPO_FILTER array', () => {
    expect(ConfigSchema.safeParse({ ...BASE, REPO_FILTER: [] }).success).toBe(false);
  });

  it('rejects REPO_FILTER with empty pattern strings', () => {
    expect(
      ConfigSchema.safeParse({
        ...BASE,
        REPO_FILTER: [{ pattern: '', scope: 'user' as const }],
      }).success,
    ).toBe(false);
  });

  it('rejects an empty CODERABBIT_REFUSAL_PHRASES array', () => {
    const result = ConfigSchema.safeParse({ ...BASE, CODERABBIT_REFUSAL_PHRASES: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('CODERABBIT_REFUSAL_PHRASES'))).toBe(true);
    }
  });

  it('rejects a CODERABBIT_REFUSAL_PHRASES entry that is an empty string', () => {
    const result = ConfigSchema.safeParse({ ...BASE, CODERABBIT_REFUSAL_PHRASES: [''] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('CODERABBIT_REFUSAL_PHRASES'))).toBe(true);
    }
  });

  it('rejects an IGNORE_AUTHORS entry with an unclosed group', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_AUTHORS: ['(unclosed'] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('IGNORE_AUTHORS'))).toBe(true);
    }
  });

  it('rejects an IGNORE_AUTHORS entry that is an empty string', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_AUTHORS: [''] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('IGNORE_AUTHORS'))).toBe(true);
    }
  });

  it('rejects a non-array IGNORE_AUTHORS value', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_AUTHORS: 'renovate' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('IGNORE_AUTHORS'))).toBe(true);
    }
  });

  it('rejects an IGNORE_TITLES entry with an unterminated character class', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_TITLES: ['[unterminated'] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('IGNORE_TITLES'))).toBe(true);
    }
  });

  it('rejects an IGNORE_TITLES entry that is an empty string', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_TITLES: [''] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('IGNORE_TITLES'))).toBe(true);
    }
  });

  it('rejects a non-array IGNORE_TITLES value', () => {
    const result = ConfigSchema.safeParse({ ...BASE, IGNORE_TITLES: 'chore' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('IGNORE_TITLES'))).toBe(true);
    }
  });

  it('rejects RETRY_BACKOFF_MAX_SEC lower than RETRY_BACKOFF_BASE_SEC', () => {
    const result = ConfigSchema.safeParse({ ...BASE, SCHEDULER_RETRY_BACKOFF_BASE_SEC: 120, SCHEDULER_RETRY_BACKOFF_MAX_SEC: 60 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('SCHEDULER_RETRY_BACKOFF_MAX_SEC'))).toBe(true);
    }
  });

  it('rejects SCHEDULER_RETRIGGER_SPACING_SEC lower than POLL_INTERVAL_SEC', () => {
    const result = ConfigSchema.safeParse({ ...BASE, SCHEDULER_RETRIGGER_SPACING_SEC: 30, POLL_INTERVAL_SEC: 90 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('SCHEDULER_RETRIGGER_SPACING_SEC'))).toBe(true);
    }
  });

  it('rejects SCHEDULER_RETRIGGER_SPACING_SEC >= CODERABBIT_ACCOUNT_COOLDOWN_SEC', () => {
    const result = ConfigSchema.safeParse({
      ...BASE,
      SCHEDULER_RETRIGGER_SPACING_SEC: ACCOUNT_COOLDOWN_SEC,
      CODERABBIT_ACCOUNT_COOLDOWN_SEC: ACCOUNT_COOLDOWN_SEC,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('SCHEDULER_RETRIGGER_SPACING_SEC'))).toBe(true);
    }
  });

  it('rejects negative REVIEW_DETECTION_LOOKBACK_SEC', () => {
    expect(ConfigSchema.safeParse({ ...BASE, REVIEW_DETECTION_LOOKBACK_SEC: -1 }).success).toBe(false);
  });

  it('rejects negative MAX_RETRIGGER_ATTEMPTS', () => {
    expect(ConfigSchema.safeParse({ ...BASE, MAX_RETRIGGER_ATTEMPTS: -1 }).success).toBe(false);
  });

  it('rejects negative SCHEDULER_MAX_RETRIGGER_AGE_SEC', () => {
    expect(ConfigSchema.safeParse({ ...BASE, SCHEDULER_MAX_RETRIGGER_AGE_SEC: -1 }).success).toBe(false);
  });

  it('rejects zero SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK', () => {
    expect(ConfigSchema.safeParse({ ...BASE, SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK: 0 }).success).toBe(false);
  });

  it('rejects negative SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK', () => {
    expect(ConfigSchema.safeParse({ ...BASE, SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK: -1 }).success).toBe(false);
  });

  it('rejects REVIEW_DETECTION_LOOKBACK_SEC > CODERABBIT_ACCOUNT_COOLDOWN_SEC * 2', () => {
    const result = ConfigSchema.safeParse({ ...BASE, REVIEW_DETECTION_LOOKBACK_SEC: 7201, CODERABBIT_ACCOUNT_COOLDOWN_SEC: 3600 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('REVIEW_DETECTION_LOOKBACK_SEC'))).toBe(true);
    }
  });

  // -- Webhook refinement ------------------------------------------------------

  it('rejects webhook mode without WEBHOOK_SECRET', () => {
    const result = ConfigSchema.safeParse({
      ...BASE,
      DETECTION_MODE: 'webhook',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('WEBHOOK_SECRET'))).toBe(true);
    }
  });

  it('rejects webhook mode without TUNNEL_URL', () => {
    const result = ConfigSchema.safeParse({
      ...BASE,
      DETECTION_MODE: 'webhook',
      WEBHOOK_SECRET: webhookSecret,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('TUNNEL_URL'))).toBe(true);
    }
  });

  it('rejects webhook mode with empty WEBHOOK_SECRET string', () => {
    expect(
      ConfigSchema.safeParse({
        ...BASE,
        DETECTION_MODE: 'webhook',
        WEBHOOK_SECRET: '',
        TUNNEL_URL: tunnelUrl,
      }).success,
    ).toBe(false);
  });
});
