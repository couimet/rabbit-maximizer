import type { Config } from '../../src/config.js';
import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { createGetConfigHandler } from '../../src/routes/index.js';
import { generateConfigData } from '../helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import type { Server } from 'node:http';

const MS_PER_SECOND = 1000;
const BASE_CONFIG = generateConfigData();
const SCHEDULER_STALE_THRESHOLD_MS = BASE_CONFIG.SCHEDULER_STALE_TICK_MULTIPLIER * BASE_CONFIG.SCHEDULER_TICK_INTERVAL_SEC * MS_PER_SECOND;

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
    const config = generateConfigData();
    startServer(config);

    const res = await fetch(`http://[::1]:${port}/api/config`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({
      pauseNotificationInitialDelaySec: config.PAUSE_NOTIFICATION_INITIAL_DELAY_SEC,
      pauseNotificationRepeatIntervalSec: config.PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC,
      schedulerStaleThresholdMs: SCHEDULER_STALE_THRESHOLD_MS,
    });
  });

  it('returns configured values when non-default', async () => {
    const customInitialDelaySec = 60;
    const customRepeatIntervalSec = 10;
    const config = generateConfigData({
      PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: customInitialDelaySec,
      PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: customRepeatIntervalSec,
    });
    startServer(config);

    const res = await fetch(`http://[::1]:${port}/api/config`);
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({
      pauseNotificationInitialDelaySec: customInitialDelaySec,
      pauseNotificationRepeatIntervalSec: customRepeatIntervalSec,
      schedulerStaleThresholdMs: SCHEDULER_STALE_THRESHOLD_MS,
    });
  });

  it('returns 500 and logs error on unexpected failure', async () => {
    const throwingConfig = new Proxy<Config>(generateConfigData(), {
      get(_target: Config, prop: string | symbol) {
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
