import type { Config } from '../../src/config.js';
import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { EventCountsMapper } from '../../src/mappers/index.js';
import { createGetDashboardStateHandler } from '../../src/routes/index.js';
import {
  apiJson,
  createMockEventRepo,
  createMockQueueItemMapper,
  createMockQueueOrderRepo,
  createMockSystemStateRepository,
  fetchResponse,
  generateQueueItemHydrationData,
  getJson,
} from '../helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

const STALE_CONFIG: Config = {
  DATABASE_URL: 'file:./data/test.db',
  DETECTION_MODE: 'poll',
  GITHUB_API_TIMEOUT_SEC: 10,
  GITHUB_PAT: 'test-pat',
  PAUSE_NOTIFICATION_INITIAL_DELAY_SEC: 1800,
  PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC: 900,
  POLL_INTERVAL_SEC: 90,
  PR_SCANNER_INTERVAL_SEC: 300,
  REPO_FILTER: [{ pattern: 'test-owner/*', scope: 'user' }],
  REVIEW_LIMIT_BUFFER_SEC: 60,
  REVIEW_LIMIT_FALLBACK_WAIT_SEC: 3600,
  SCHEDULER_POST_COOLDOWN_SEC: 3600,
  SCHEDULER_RETRIGGER_SPACING_SEC: 180,
  SCHEDULER_RETRY_BACKOFF_BASE_SEC: 60,
  SCHEDULER_RETRY_BACKOFF_MAX_SEC: 3600,
  SCHEDULER_STALE_TICK_MULTIPLIER: 4,
  SCHEDULER_TICK_INTERVAL_SEC: 10,
  WEB_PORT: 3000,
};

describe('getDashboardState', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let server: Server;
  let port: number;
  let queueItemMapper: ReturnType<typeof createMockQueueItemMapper>;
  let eventCountsMapper: EventCountsMapper;

  beforeEach(() => {
    queueItemMapper = createMockQueueItemMapper();
    eventCountsMapper = new EventCountsMapper();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const startServer = (
    queueOrderRepoOver: Record<string, unknown> = {},
    eventRepoOver: Record<string, unknown> = {},
    systemStateRepoOver: Record<string, unknown> = {},
    config: Config = STALE_CONFIG,
  ) => {
    const mergedSystemState = {
      getLastSchedulerTickAt: jest.fn<any>().mockResolvedValue(new Date()),
      ...systemStateRepoOver,
    };
    const result = startTestServer(logger, (app) => {
      app.get(
        '/api/dashboard-state',
        createGetDashboardStateHandler(
          createMockQueueOrderRepo(queueOrderRepoOver as any),
          createMockEventRepo(eventRepoOver as any),
          createMockSystemStateRepository(mergedSystemState as any),
          queueItemMapper,
          eventCountsMapper,
          logger,
          config,
        ),
      );
    });
    server = result.server;
    port = result.port;
  };

  it('returns null for nextReviewAvailableAt regardless of pending items', async () => {
    logger = createMockLogger();
    const items = [generateQueueItemHydrationData({ id: 1 }), generateQueueItemHydrationData({ id: 2 }), generateQueueItemHydrationData({ id: 3 })];
    startServer(
      { getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) },
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected: 5,
          enqueued: 3,
          retriggered: 2,
          failed: 1,
          bypassed: 0,
          coderabbit_review_approved: 0,
          coderabbit_review_changes_suggested: 0,
        }),
      },
    );

    const json = await getJson(port, '/api/dashboard-state');
    expect(typeof (json as Record<string, unknown>).lastSchedulerTickAt).toBe('string');
    expect((json as Record<string, unknown>).schedulerStale).toBe(false);
    const { lastSchedulerTickAt: _lastSchedulerTickAt, schedulerStale: _schedulerStale, ...restJson } = json as Record<string, unknown> & typeof json;
    expect(restJson).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: apiJson(await queueItemMapper.mapToQueueItemResponseList(items)),
      eventCounts: { detected: 5, enqueued: 3, retriggered: 2, failed: 1 },
      paused: false,
    });
  });

  it('returns null for nextReviewAvailableAt when there are no pending items', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(port, '/api/dashboard-state');
    expect(typeof (json as Record<string, unknown>).lastSchedulerTickAt).toBe('string');
    expect((json as Record<string, unknown>).schedulerStale).toBe(false);
    const { lastSchedulerTickAt: _lastSchedulerTickAt, schedulerStale: _schedulerStale, ...restJson } = json as Record<string, unknown> & typeof json;
    expect(restJson).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: false,
    });
  });

  it('returns pendingItems as the array from getEffectiveOrder', async () => {
    logger = createMockLogger();
    const items = [generateQueueItemHydrationData({ id: 1 }), generateQueueItemHydrationData({ id: 2, repo_full_name: 'a/b', pr_number: 99 })];
    startServer(
      { getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) },
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected: 0,
          enqueued: 0,
          retriggered: 0,
          bypassed: 0,
          coderabbit_review_approved: 0,
          coderabbit_review_changes_suggested: 0,
          failed: 0,
        }),
      },
    );

    const json = await getJson(port, '/api/dashboard-state');
    expect(typeof (json as Record<string, unknown>).lastSchedulerTickAt).toBe('string');
    expect((json as Record<string, unknown>).schedulerStale).toBe(false);
    const { lastSchedulerTickAt: _lastSchedulerTickAt, schedulerStale: _schedulerStale, ...restJson } = json as Record<string, unknown> & typeof json;
    expect(restJson).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: apiJson(await queueItemMapper.mapToQueueItemResponseList(items)),
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: false,
    });
  });

  it('eventCounts excludes bypassed, coderabbit_review_approved, and coderabbit_review_changes_suggested', async () => {
    logger = createMockLogger();
    startServer(
      {},
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected: 1,
          enqueued: 2,
          retriggered: 3,
          bypassed: 4,
          coderabbit_review_approved: 3,
          coderabbit_review_changes_suggested: 2,
          failed: 6,
        }),
      },
    );

    const json = await getJson(port, '/api/dashboard-state');
    expect(typeof (json as Record<string, unknown>).lastSchedulerTickAt).toBe('string');
    expect((json as Record<string, unknown>).schedulerStale).toBe(false);
    const { lastSchedulerTickAt: _lastSchedulerTickAt, schedulerStale: _schedulerStale, ...restJson } = json as Record<string, unknown> & typeof json;
    expect(restJson).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: { detected: 1, enqueued: 2, retriggered: 3, failed: 6 },
      paused: false,
    });
  });

  it('duration param 2d passes correct since window', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({
      detected: 0,
      enqueued: 0,
      retriggered: 0,
      bypassed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_suggested: 0,
      failed: 0,
    });
    startServer({}, { countByType });

    await getJson(port, '/api/dashboard-state?duration=2d');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 172_800_000));
  });

  it('duration defaults to 24h for invalid duration values', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({
      detected: 0,
      enqueued: 0,
      retriggered: 0,
      bypassed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_suggested: 0,
      failed: 0,
    });
    startServer({}, { countByType });

    await getJson(port, '/api/dashboard-state?duration=invalid');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });

  it('returns paused true when schedulerStatus is paused', async () => {
    logger = createMockLogger();
    startServer({}, {}, { isSchedulerPaused: jest.fn<any>().mockResolvedValue(true) });

    const json = await getJson(port, '/api/dashboard-state');
    expect(typeof (json as Record<string, unknown>).lastSchedulerTickAt).toBe('string');
    expect((json as Record<string, unknown>).schedulerStale).toBe(false);
    const { lastSchedulerTickAt: _lastSchedulerTickAt, schedulerStale: _schedulerStale, ...restJson } = json as Record<string, unknown> & typeof json;
    expect(restJson).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: true,
    });
  });

  it('sets schedulerStale: true when lastSchedulerTickAt has never been written', async () => {
    logger = createMockLogger();
    startServer({}, {}, { getLastSchedulerTickAt: jest.fn<any>().mockResolvedValue(undefined) });

    const json = await getJson(port, '/api/dashboard-state');
    const data = json as Record<string, unknown>;
    expect(data.lastSchedulerTickAt).toBeNull();
    expect(data.schedulerStale).toBe(true);
    expect(data.paused).toBe(false);
  });

  it('sets schedulerStale: true when last tick exceeds threshold', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    const staleTick = new Date(fixedNow - 41_000);
    startServer({}, {}, { getLastSchedulerTickAt: jest.fn<any>().mockResolvedValue(staleTick) });

    const json = await getJson(port, '/api/dashboard-state');
    const data2 = json as Record<string, unknown>;
    expect(typeof data2.lastSchedulerTickAt).toBe('string');
    expect(data2.schedulerStale).toBe(true);
  });

  it('sets schedulerStale: false when last tick is within threshold', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    const recentTick = new Date(fixedNow - 30_000);
    startServer({}, {}, { getLastSchedulerTickAt: jest.fn<any>().mockResolvedValue(recentTick) });

    const json = await getJson(port, '/api/dashboard-state');
    const data3 = json as Record<string, unknown>;
    expect(typeof data3.lastSchedulerTickAt).toBe('string');
    expect(data3.schedulerStale).toBe(false);
  });

  it('returns 500 and logs error on getEffectiveOrder failure', async () => {
    const repoError = new Error('DB down');
    logger = createMockLogger();
    startServer({ getEffectiveOrder: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(port, '/api/dashboard-state');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get dashboard state' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.dashboardState', error: repoError }, 'Failed to get dashboard state');
  });

  it('returns 500 and logs error on countByType failure', async () => {
    const eventError = new Error('DB down');
    logger = createMockLogger();
    startServer(
      { getEffectiveOrder: jest.fn<any>().mockResolvedValue([generateQueueItemHydrationData()]) },
      { countByType: jest.fn<any>().mockRejectedValue(eventError) },
    );

    const res = await fetchResponse(port, '/api/dashboard-state');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get dashboard state' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.dashboardState', error: eventError }, 'Failed to get dashboard state');
  });
});
