import { z } from 'zod';

// Keep keys alphabetically sorted.
export const ConfigSchema = z
  .object({
    DATABASE_URL: z.string().min(1).default('file:./data/rabbit-maximizer.db'),
    DETECTION_MODE: z.enum(['poll', 'webhook']).default('poll'),
    GITHUB_API_TIMEOUT: z.coerce.number().int().positive('GITHUB_API_TIMEOUT must be a positive integer').default(10_000),
    GITHUB_PAT: z.string({ error: 'GITHUB_PAT is required' }).min(1, 'GITHUB_PAT is required'),
    POLL_INTERVAL: z.coerce.number().int().positive('POLL_INTERVAL must be a positive integer').default(90),
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
    SCHEDULER_POST_COOLDOWN: z.coerce.number().int().positive('SCHEDULER_POST_COOLDOWN must be a positive integer').default(3600),
    SCHEDULER_RETRY_BACKOFF_BASE: z.coerce.number().int().positive('SCHEDULER_RETRY_BACKOFF_BASE must be a positive integer').default(60),
    SCHEDULER_RETRY_BACKOFF_MAX: z.coerce.number().int().positive('SCHEDULER_RETRY_BACKOFF_MAX must be a positive integer').default(3600),
    TUNNEL_URL: z.string().optional(),
    WEB_PORT: z.coerce.number().int().positive('WEB_PORT must be a positive integer').default(3000),
    WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.SCHEDULER_RETRY_BACKOFF_MAX < cfg.SCHEDULER_RETRY_BACKOFF_BASE) {
      ctx.addIssue({
        code: 'custom',
        message: 'SCHEDULER_RETRY_BACKOFF_MAX must be >= SCHEDULER_RETRY_BACKOFF_BASE',
        path: ['SCHEDULER_RETRY_BACKOFF_MAX'],
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
