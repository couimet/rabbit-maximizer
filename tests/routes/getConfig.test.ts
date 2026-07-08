import type { Config } from '../../src/config.js';
import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetConfigHandler } from '../../src/routes/getConfig.js';

import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  DATABASE_URL: 'file:./data/rabbit-maximizer.db',
  DETECTION_MODE: 'poll',
  GITHUB_API_TIMEOUT_MS: 10_000,
  GITHUB_PAT: 'ghp_fake',
  PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES: 30,
  PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES: 15,
  POLL_INTERVAL: 90,
  REPO_FILTER: [{ pattern: 'couimet/*', scope: 'user' }],
  REVIEW_LIMIT_BUFFER_SECONDS: 60,
  REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: 3600,
  SCHEDULER_POST_COOLDOWN: 3600,
  SCHEDULER_RETRY_BACKOFF_BASE: 60,
  SCHEDULER_RETRY_BACKOFF_MAX: 3600,
  SCHEDULER_TICK_INTERVAL_MS: 10_000,
  TUNNEL_URL: undefined,
  WEB_PORT: 3000,
  WEBHOOK_SECRET: undefined,
  ...overrides,
});

describe('getConfig', () => {
  let logger: Logger;
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const startServer = (config: Config) => {
    logger = createMockLogger();
    const app = createExpressApp({ logger });
    app.get('/api/config', createGetConfigHandler(config, logger));
    server = app.listen(0);
  };

  it('returns config values', async () => {
    startServer(makeConfig());

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Server not listening');
    const res = await fetch(`http://[::1]:${addr.port}/api/config`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({
      pauseNotificationInitialDelayMinutes: 30,
      pauseNotificationRepeatIntervalMinutes: 15,
    });
  });

  it('returns configured values when non-default', async () => {
    startServer(makeConfig({ PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES: 60, PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES: 10 }));

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Server not listening');
    const res = await fetch(`http://[::1]:${addr.port}/api/config`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({
      pauseNotificationInitialDelayMinutes: 60,
      pauseNotificationRepeatIntervalMinutes: 10,
    });
  });

  it('returns 500 and logs error on unexpected failure', async () => {
    const throwingConfig = new Proxy<Config>(makeConfig(), {
      get(_target, prop) {
        if (prop === 'PAUSE_NOTIFICATION_INITIAL_DELAY_MINUTES' || prop === 'PAUSE_NOTIFICATION_REPEAT_INTERVAL_MINUTES') {
          throw new Error('Unexpected error');
        }
        return Reflect.get(_target, prop);
      },
    });
    startServer(throwingConfig);

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Server not listening');
    const res = await fetch(`http://[::1]:${addr.port}/api/config`);
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get config' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.config', error: expect.any(Error) }, 'Failed to get config');
  });
});
