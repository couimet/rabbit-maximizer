import { z } from 'zod';

// Keep keys alphabetically sorted.
export const ConfigSchema = z
  .object({
    CODERABBIT_ACCOUNT_COOLDOWN_SEC: z.coerce.number().int().positive('CODERABBIT_ACCOUNT_COOLDOWN_SEC must be a positive integer').default(3600),
    DATABASE_URL: z.string().min(1).default('file:./data/rabbit-maximizer.db'),
    DETECTION_MODE: z.enum(['poll', 'webhook']).default('poll'),
    GITHUB_API_TIMEOUT_SEC: z.coerce.number().int().positive('GITHUB_API_TIMEOUT_SEC must be a positive integer').default(10),
    GITHUB_PAT: z.string({ error: 'GITHUB_PAT is required' }).min(1, 'GITHUB_PAT is required'),
    MAX_RETRIGGER_ATTEMPTS: z.coerce.number().int().positive('MAX_RETRIGGER_ATTEMPTS must be a positive integer').default(10),
    PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: z.coerce.number().int().positive('PAUSE_NOTIFICATION_INITIAL_DELAY_SEC must be a positive integer').default(1800),
    PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: z.coerce.number().int().positive('PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC must be a positive integer').default(900),
    POLL_INTERVAL_SEC: z.coerce.number().int().positive('POLL_INTERVAL_SEC must be a positive integer').default(90),
    PR_SCANNER_INTERVAL_SEC: z.coerce.number().int().positive('PR_SCANNER_INTERVAL_SEC must be a positive integer').default(300),
    REVIEW_DETECTION_LOOKBACK_SEC: z.coerce.number().int().positive('REVIEW_DETECTION_LOOKBACK_SEC must be a positive integer').default(7200),
    REVIEW_LIMIT_BUFFER_SEC: z.coerce.number().int().positive('REVIEW_LIMIT_BUFFER_SEC must be a positive integer').default(60),
    REVIEW_LIMIT_FALLBACK_WAIT_SEC: z.coerce.number().int().positive('REVIEW_LIMIT_FALLBACK_WAIT_SEC must be a positive integer').default(3600),
    REPO_FILTER: z
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
        { error: 'REPO_FILTER is required' },
      )
      .min(1, 'REPO_FILTER must have at least one entry'),
    SCHEDULER_MAX_RETRIGGER_AGE_SEC: z.coerce.number().int().positive('SCHEDULER_MAX_RETRIGGER_AGE_SEC must be a positive integer').default(259200),
    SCHEDULER_RETRIGGER_SPACING_SEC: z.coerce.number().int().positive('SCHEDULER_RETRIGGER_SPACING_SEC must be a positive integer').default(180),
    SCHEDULER_RETRY_BACKOFF_BASE_SEC: z.coerce.number().int().positive('SCHEDULER_RETRY_BACKOFF_BASE_SEC must be a positive integer').default(60),
    SCHEDULER_RETRY_BACKOFF_MAX_SEC: z.coerce.number().int().positive('SCHEDULER_RETRY_BACKOFF_MAX_SEC must be a positive integer').default(3600),
    SCHEDULER_STALE_TICK_MULTIPLIER: z.coerce.number().int().positive('SCHEDULER_STALE_TICK_MULTIPLIER must be a positive integer').default(4),
    SCHEDULER_TICK_INTERVAL_SEC: z.coerce.number().int().positive('SCHEDULER_TICK_INTERVAL_SEC must be a positive integer').default(10),
    TUNNEL_URL: z.string().optional(),
    WEB_PORT: z.coerce.number().int().positive('WEB_PORT must be a positive integer').default(3000),
    WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.SCHEDULER_RETRY_BACKOFF_MAX_SEC < cfg.SCHEDULER_RETRY_BACKOFF_BASE_SEC) {
      ctx.addIssue({
        code: 'custom',
        message: 'SCHEDULER_RETRY_BACKOFF_MAX_SEC must be >= SCHEDULER_RETRY_BACKOFF_BASE_SEC',
        path: ['SCHEDULER_RETRY_BACKOFF_MAX_SEC'],
      });
    }

    if (cfg.SCHEDULER_RETRIGGER_SPACING_SEC < cfg.POLL_INTERVAL_SEC) {
      ctx.addIssue({
        code: 'custom',
        message: 'SCHEDULER_RETRIGGER_SPACING_SEC must be >= POLL_INTERVAL_SEC',
        path: ['SCHEDULER_RETRIGGER_SPACING_SEC'],
      });
    }

    if (cfg.SCHEDULER_RETRIGGER_SPACING_SEC >= cfg.CODERABBIT_ACCOUNT_COOLDOWN_SEC) {
      ctx.addIssue({
        code: 'custom',
        message: 'SCHEDULER_RETRIGGER_SPACING_SEC must be < CODERABBIT_ACCOUNT_COOLDOWN_SEC',
        path: ['SCHEDULER_RETRIGGER_SPACING_SEC'],
      });
    }

    if (cfg.REVIEW_DETECTION_LOOKBACK_SEC > cfg.CODERABBIT_ACCOUNT_COOLDOWN_SEC * 2) {
      ctx.addIssue({
        code: 'custom',
        message: 'REVIEW_DETECTION_LOOKBACK_SEC must be <= CODERABBIT_ACCOUNT_COOLDOWN_SEC * 2',
        path: ['REVIEW_DETECTION_LOOKBACK_SEC'],
      });
    }

    if (cfg.DETECTION_MODE === 'webhook') {
      if (!cfg.WEBHOOK_SECRET || cfg.WEBHOOK_SECRET.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'WEBHOOK_SECRET is required when DETECTION_MODE=webhook',
          path: ['WEBHOOK_SECRET'],
        });
      }
      if (!cfg.TUNNEL_URL || cfg.TUNNEL_URL.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'TUNNEL_URL is required when DETECTION_MODE=webhook',
          path: ['TUNNEL_URL'],
        });
      }
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
