import { type Config, ConfigSchema } from '../../src/schemas/config.js';

import { getRandomString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const DEFAULT_PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES = 30;
const DEFAULT_PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES = 15;

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
      DETECTION_MODE: 'poll' as const,
      GITHUB_API_TIMEOUT_MS: 10_000,
      GITHUB_PAT: githubPat,
      PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES: DEFAULT_PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES,
      PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES: DEFAULT_PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES,
      POLL_INTERVAL: 90,
      REVIEW_LIMIT_BUFFER_SECONDS: 60,
      REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: 3600,
      DATABASE_URL: 'file:./data/rabbit-maximizer.db',
      REPO_FILTER: [{ pattern: 'couimet/*', scope: 'user' as const }],
      SCHEDULER_POST_COOLDOWN: 3600,
      SCHEDULER_RETRY_BACKOFF_BASE: 60,
      SCHEDULER_RETRY_BACKOFF_MAX: 3600,
      SCHEDULER_TICK_INTERVAL_MS: 10_000,
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

  it('applies default POLL_INTERVAL when missing', () => {
    const { POLL_INTERVAL: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLL_INTERVAL).toBe(90);
    }
  });

  it('applies default SCHEDULER_TICK_INTERVAL_MS when missing', () => {
    const { SCHEDULER_TICK_INTERVAL_MS: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SCHEDULER_TICK_INTERVAL_MS).toBe(10_000);
    }
  });

  it('applies default PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES when missing', () => {
    const { PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES).toBe(DEFAULT_PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES);
    }
  });

  it('applies default PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES when missing', () => {
    const { PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES: _, ...rest } = BASE;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES).toBe(DEFAULT_PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES);
    }
  });

  it('coerces numeric POLL_INTERVAL from a string', () => {
    const result = ConfigSchema.safeParse({ ...BASE, POLL_INTERVAL: '120' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.POLL_INTERVAL).toBe(120);
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

  it('rejects negative POLL_INTERVAL', () => {
    expect(ConfigSchema.safeParse({ ...BASE, POLL_INTERVAL: -5 }).success).toBe(false);
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

  it('rejects RETRY_BACKOFF_MAX lower than RETRY_BACKOFF_BASE', () => {
    const result = ConfigSchema.safeParse({ ...BASE, SCHEDULER_RETRY_BACKOFF_BASE: 120, SCHEDULER_RETRY_BACKOFF_MAX: 60 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('SCHEDULER_RETRY_BACKOFF_MAX'))).toBe(true);
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
