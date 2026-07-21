import type { Config } from '../../src/config.js';
import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { createGetConfigHandler } from '../../src/routes/getConfig.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

const makeConfig = (overrides?: Partial<Config>): Config => ({
  DATABASE_URL: 'file:./data/rabbit-maximizer.db',
  DETECTION_MODE: 'poll',
  GITHUB_API_TIMEOUT_SEC: 10,
  GITHUB_PAT: 'ghp_fake',
  PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: 1800,
  PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: 900,
  POLL_INTERVAL_SEC: 90,
  PR_SCANNER_INTERVAL_SEC: 300,
  REPO_FILTER: [{ pattern: 'couimet/*', scope: 'user' }],
  REVIEW_LIMIT_BUFFER_SEC: 60,
  REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600,
  SCHEDULER_POST_COOLDOWN_SEC: 3600,
  SCHEDULER_RETRIGGER_SPACING_SEC: 180,
  SCHEDULER_RETRY_BACKOFF_BASE_SEC: 60,
  SCHEDULER_RETRY_BACKOFF_MAX_SEC: 3600,
  SCHEDULER_TICK_INTERVAL_SEC: 10,
  TUNNEL_URL: undefined,
  WEB_PORT: 3000,
  WEBHOOK_SECRET: undefined,
  ...overrides,
});

describe('getConfig', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let server: Server;
  let port: number;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const startServer = (config: Config) => {
    logger = createMockLogger();
    const result = startTestServer(logger, (app) => {
      app.get('/api/config', createGetConfigHandler(config, logger));
    });
    server = result.server;
    port = result.port;
  };

  it('returns config values', async () => {
    const config = makeConfig();
    startServer(config);

    const res = await fetch(`http://[::1]:${port}/api/config`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({
      pauseNotificationInitialDelaySec: config.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC,
      pauseNotificationRepeatIntervalSec: config.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC,
    });
  });

  it('returns configured values when non-default', async () => {
    const customInitialDelaySec = 60;
    const customRepeatIntervalSec = 10;
    const config = makeConfig({
      PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: customInitialDelaySec,
      PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: customRepeatIntervalSec,
    });
    startServer(config);

    const res = await fetch(`http://[::1]:${port}/api/config`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({
      pauseNotificationInitialDelaySec: customInitialDelaySec,
      pauseNotificationRepeatIntervalSec: customRepeatIntervalSec,
    });
  });

  it('returns 500 and logs error on unexpected failure', async () => {
    const throwingConfig = new Proxy<Config>(makeConfig(), {
      get(_target, prop) {
        if (prop === 'PAUSE_NOTIFICATION_INITIAL_DELAY_SEC' || prop === 'PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC') {
          throw new Error('Unexpected error');
        }
        return Reflect.get(_target, prop);
      },
    });
    startServer(throwingConfig);

    const res = await fetch(`http://[::1]:${port}/api/config`);
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get config' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.config', error: expect.any(Error) }, 'Failed to get config');
  });
});
