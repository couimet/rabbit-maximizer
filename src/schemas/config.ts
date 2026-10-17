import {
  REVIEW_BOT_ACKNOWLEDGEMENT_MARKER,
  REVIEW_BOT_ACTIONABLE_SIGNAL,
  REVIEW_BOT_NO_ACTIONABLE_SIGNAL,
  REVIEW_BOT_PAUSE_MARKER,
  REVIEW_BOT_RATE_LIMIT_MARKER,
  REVIEW_BOT_SKIP_MARKER,
  REVIEW_STACK_MARKER,
} from '../github/coderabbitConstants.js';
import { isCompilableRegex } from '../utils/isCompilableRegex.js';

import { CONFIG_KEYS } from './configKeys.js';
import { phraseList } from './phraseList.js';
import { positiveInt } from './positiveInt.js';

import { z } from 'zod';

// Key order follows CONFIG_KEYS.
export const ConfigSchema = z
  .object({
    [CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC]: positiveInt(CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC, 3600),
    [CONFIG_KEYS.CODERABBIT_ACKNOWLEDGEMENT_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_ACKNOWLEDGEMENT_PHRASES, [REVIEW_BOT_ACKNOWLEDGEMENT_MARKER]),
    [CONFIG_KEYS.CODERABBIT_APPROVAL_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_APPROVAL_PHRASES, [REVIEW_BOT_NO_ACTIONABLE_SIGNAL]),
    [CONFIG_KEYS.CODERABBIT_CHANGES_SUGGESTED_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_CHANGES_SUGGESTED_PHRASES, [REVIEW_BOT_ACTIONABLE_SIGNAL]),
    [CONFIG_KEYS.CODERABBIT_PAUSE_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_PAUSE_PHRASES, [REVIEW_BOT_PAUSE_MARKER]),
    [CONFIG_KEYS.CODERABBIT_RATE_LIMIT_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_RATE_LIMIT_PHRASES, [REVIEW_BOT_RATE_LIMIT_MARKER]),
    [CONFIG_KEYS.CODERABBIT_REFUSAL_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_REFUSAL_PHRASES, ['without an assigned CodeRabbit review seat']),
    [CONFIG_KEYS.CODERABBIT_SKIP_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_SKIP_PHRASES, [REVIEW_BOT_SKIP_MARKER]),
    [CONFIG_KEYS.CODERABBIT_WALKTHROUGH_PHRASES]: phraseList(CONFIG_KEYS.CODERABBIT_WALKTHROUGH_PHRASES, [REVIEW_STACK_MARKER]),
    [CONFIG_KEYS.DATABASE_URL]: z.string().min(1).default('file:./data/rabbit-maximizer.db'),
    [CONFIG_KEYS.DETECTION_MODE]: z.enum(['poll', 'webhook']).default('poll'),
    [CONFIG_KEYS.GITHUB_API_TIMEOUT_SEC]: positiveInt(CONFIG_KEYS.GITHUB_API_TIMEOUT_SEC, 10),
    [CONFIG_KEYS.GITHUB_PAT]: z.string({ error: `${CONFIG_KEYS.GITHUB_PAT} is required` }).min(1, `${CONFIG_KEYS.GITHUB_PAT} is required`),
    [CONFIG_KEYS.HEAD_DRIFT_GRACE_SEC]: positiveInt(CONFIG_KEYS.HEAD_DRIFT_GRACE_SEC, 900),
    [CONFIG_KEYS.IGNORE_AUTHORS]: z
      .array(
        z
          .string()
          .min(1, `${CONFIG_KEYS.IGNORE_AUTHORS} entries must be non-empty`)
          .refine(isCompilableRegex, { error: (issue) => `${CONFIG_KEYS.IGNORE_AUTHORS} entry is not a valid regular expression: ${String(issue.input)}` }),
        { error: `${CONFIG_KEYS.IGNORE_AUTHORS} must be a list of strings` },
      )
      .default([]),
    [CONFIG_KEYS.IGNORE_TITLES]: z
      .array(
        z
          .string()
          .min(1, `${CONFIG_KEYS.IGNORE_TITLES} entries must be non-empty`)
          .refine(isCompilableRegex, { error: (issue) => `${CONFIG_KEYS.IGNORE_TITLES} entry is not a valid regular expression: ${String(issue.input)}` }),
        { error: `${CONFIG_KEYS.IGNORE_TITLES} must be a list of strings` },
      )
      .default([]),
    [CONFIG_KEYS.MAX_RETRIGGER_ATTEMPTS]: positiveInt(CONFIG_KEYS.MAX_RETRIGGER_ATTEMPTS, 10),
    [CONFIG_KEYS.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC]: positiveInt(CONFIG_KEYS.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC, 1800),
    [CONFIG_KEYS.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC]: positiveInt(CONFIG_KEYS.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC, 900),
    [CONFIG_KEYS.POLL_INTERVAL_SEC]: positiveInt(CONFIG_KEYS.POLL_INTERVAL_SEC, 90),
    [CONFIG_KEYS.PR_SCANNER_INTERVAL_SEC]: positiveInt(CONFIG_KEYS.PR_SCANNER_INTERVAL_SEC, 300),
    [CONFIG_KEYS.REPO_FILTER]: z
      .array(
        z.discriminatedUnion('scope', [
          z.object({
            pattern: z.string().min(1),
            scope: z.literal('user'),
          }),
          z.object({
            pattern: z.string().min(1),
            scope: z.literal('repo'),
          }),
        ]),
        { error: `${CONFIG_KEYS.REPO_FILTER} is required` },
      )
      .min(1, `${CONFIG_KEYS.REPO_FILTER} must have at least one entry`),
    [CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC]: positiveInt(CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC, 7200),
    [CONFIG_KEYS.REVIEW_LIMIT_BUFFER_SEC]: positiveInt(CONFIG_KEYS.REVIEW_LIMIT_BUFFER_SEC, 60),
    [CONFIG_KEYS.REVIEW_LIMIT_FALLBACK_WAIT_SEC]: positiveInt(CONFIG_KEYS.REVIEW_LIMIT_FALLBACK_WAIT_SEC, 3600),
    [CONFIG_KEYS.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK]: positiveInt(CONFIG_KEYS.SCHEDULER_MAX_PR_STATE_FETCHES_PER_TICK, 5),
    [CONFIG_KEYS.SCHEDULER_MAX_RETRIGGER_AGE_SEC]: positiveInt(CONFIG_KEYS.SCHEDULER_MAX_RETRIGGER_AGE_SEC, 259200),
    [CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC]: positiveInt(CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC, 180),
    [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC]: positiveInt(CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC, 60),
    [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC]: positiveInt(CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC, 3600),
    [CONFIG_KEYS.SCHEDULER_STALE_TICK_MULTIPLIER]: positiveInt(CONFIG_KEYS.SCHEDULER_STALE_TICK_MULTIPLIER, 4),
    [CONFIG_KEYS.SCHEDULER_TICK_INTERVAL_SEC]: positiveInt(CONFIG_KEYS.SCHEDULER_TICK_INTERVAL_SEC, 10),
    [CONFIG_KEYS.TUNNEL_URL]: z.string().optional(),
    [CONFIG_KEYS.WEB_PORT]: positiveInt(CONFIG_KEYS.WEB_PORT, 3000),
    [CONFIG_KEYS.WEBHOOK_SECRET]: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.SCHEDULER_RETRY_BACKOFF_MAX_SEC < cfg.SCHEDULER_RETRY_BACKOFF_BASE_SEC) {
      ctx.addIssue({
        code: 'custom',
        message: `${CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC} must be >= ${CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_BASE_SEC}`,
        path: [CONFIG_KEYS.SCHEDULER_RETRY_BACKOFF_MAX_SEC],
      });
    }

    if (cfg.SCHEDULER_RETRIGGER_SPACING_SEC < cfg.POLL_INTERVAL_SEC) {
      ctx.addIssue({
        code: 'custom',
        message: `${CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC} must be >= ${CONFIG_KEYS.POLL_INTERVAL_SEC}`,
        path: [CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC],
      });
    }

    if (cfg.SCHEDULER_RETRIGGER_SPACING_SEC >= cfg.CODERABBIT_ACCOUNT_COOLDOWN_SEC) {
      ctx.addIssue({
        code: 'custom',
        message: `${CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC} must be < ${CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC}`,
        path: [CONFIG_KEYS.SCHEDULER_RETRIGGER_SPACING_SEC],
      });
    }

    if (cfg.REVIEW_DETECTION_LOOKBACK_SEC > cfg.CODERABBIT_ACCOUNT_COOLDOWN_SEC * 2) {
      ctx.addIssue({
        code: 'custom',
        message: `${CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC} must be <= ${CONFIG_KEYS.CODERABBIT_ACCOUNT_COOLDOWN_SEC} * 2`,
        path: [CONFIG_KEYS.REVIEW_DETECTION_LOOKBACK_SEC],
      });
    }

    if (cfg.DETECTION_MODE === 'webhook') {
      if (!cfg.WEBHOOK_SECRET || cfg.WEBHOOK_SECRET.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${CONFIG_KEYS.WEBHOOK_SECRET} is required when ${CONFIG_KEYS.DETECTION_MODE}=webhook`,
          path: [CONFIG_KEYS.WEBHOOK_SECRET],
        });
      }
      if (!cfg.TUNNEL_URL || cfg.TUNNEL_URL.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${CONFIG_KEYS.TUNNEL_URL} is required when ${CONFIG_KEYS.DETECTION_MODE}=webhook`,
          path: [CONFIG_KEYS.TUNNEL_URL],
        });
      }
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
