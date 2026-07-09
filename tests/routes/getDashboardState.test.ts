import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetDashboardStateHandler } from '../../src/routes/getDashboardState.js';
import { QueueStatus } from '../../src/types/index.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockEventRepo, createMockQueueOrderRepo, createMockSystemStateRepository, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getDashboardState', () => {
  let logger: Logger;
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const makeQueueItem = (overrides: Record<string, unknown> = {}) => ({
    id: getUniqueInt(),
    uuid: getUniqueString({ prefix: 'uuid-' }),
    repo_full_name: makeUniqueRepoName().fullName,
    pr_number: getUniqueInt(),
    status: QueueStatus.pending,
    not_before: getUniqueDate(),
    attempts: 0,
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
    ...overrides,
  });

  const toJson = (item: Record<string, unknown>): Record<string, unknown> => ({
    ...item,
    not_before: (item.not_before as Date).toISOString(),
    created_at: (item.created_at as Date).toISOString(),
    updated_at: (item.updated_at as Date).toISOString(),
  });

  const startServer = (
    queueOrderRepoOver: Record<string, unknown> = {},
    eventRepoOver: Record<string, unknown> = {},
    systemStateRepoOver: Record<string, unknown> = {},
  ) => {
    const app = createExpressApp({ logger });
    app.get(
      '/api/dashboard-state',
      createGetDashboardStateHandler(
        createMockQueueOrderRepo(queueOrderRepoOver as any),
        createMockEventRepo(eventRepoOver as any),
        createMockSystemStateRepository(systemStateRepoOver as any),
        logger,
      ),
    );
    server = app.listen(0);
  };

  it('returns nextReviewAvailableAt from oldest pending item future not_before', async () => {
    logger = createMockLogger();
    const futureDate1 = new Date(Date.now() + 900_000);
    const pastDate = new Date(Date.now() - 3_600_000);
    const futureDate2 = new Date(Date.now() + 3_600_000);
    const items = [
      makeQueueItem({ id: 1, not_before: futureDate2 }),
      makeQueueItem({ id: 2, not_before: pastDate }),
      makeQueueItem({ id: 3, not_before: futureDate1 }),
    ];
    startServer(
      { getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) },
      { countByType: jest.fn<any>().mockResolvedValue({ detected: 5, enqueued: 3, retriggered: 2, failed: 1, bypassed: 0, completed: 0 }) },
    );

    const json = await getJson(server, '/api/dashboard-state');
    expect(json).toStrictEqual({
      nextReviewAvailableAt: futureDate1.toISOString(),
      pendingItems: items.map(toJson),
      eventCounts: { detected: 5, enqueued: 3, retriggered: 2, failed: 1 },
      paused: false,
    });
  });

  it('returns null for nextReviewAvailableAt when all pending not_before values are in the past', async () => {
    logger = createMockLogger();
    const pastDate1 = new Date(Date.now() - 3_600_000);
    const pastDate2 = new Date(Date.now() - 1_800_000);
    const items = [makeQueueItem({ id: 1, not_before: pastDate1 }), makeQueueItem({ id: 2, not_before: pastDate2 })];
    startServer(
      { getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) },
      { countByType: jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 }) },
    );

    const json = await getJson(server, '/api/dashboard-state');
    expect(json).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: items.map(toJson),
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: false,
    });
  });

  it('returns null for nextReviewAvailableAt when there are no pending items', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(server, '/api/dashboard-state');
    expect(json).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: false,
    });
  });

  it('returns pendingItems as the array from getEffectiveOrder', async () => {
    logger = createMockLogger();
    const items = [makeQueueItem({ id: 1, not_before: new Date(0) }), makeQueueItem({ id: 2, repo_full_name: 'a/b', pr_number: 99, not_before: new Date(0) })];
    startServer(
      { getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) },
      { countByType: jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 }) },
    );

    const json = await getJson(server, '/api/dashboard-state');
    expect(json).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: items.map(toJson),
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: false,
    });
  });

  it('eventCounts excludes bypassed and completed', async () => {
    logger = createMockLogger();
    startServer({}, { countByType: jest.fn<any>().mockResolvedValue({ detected: 1, enqueued: 2, retriggered: 3, bypassed: 4, completed: 5, failed: 6 }) });

    const json = await getJson(server, '/api/dashboard-state');
    expect(json).toStrictEqual({
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

    const countByType = jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 });
    startServer({}, { countByType });

    await getJson(server, '/api/dashboard-state?duration=2d');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 172_800_000));
  });

  it('duration defaults to 24h for invalid duration values', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 });
    startServer({}, { countByType });

    await getJson(server, '/api/dashboard-state?duration=invalid');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });

  it('returns paused true when schedulerStatus is paused', async () => {
    logger = createMockLogger();
    startServer({}, {}, { isSchedulerPaused: jest.fn<any>().mockResolvedValue(true) });

    const json = await getJson(server, '/api/dashboard-state');
    expect(json).toStrictEqual({
      nextReviewAvailableAt: null,
      pendingItems: [],
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      paused: true,
    });
  });

  it('returns 500 and logs error on getEffectiveOrder failure', async () => {
    const repoError = new Error('DB down');
    logger = createMockLogger();
    startServer({ getEffectiveOrder: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(server, '/api/dashboard-state');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get dashboard state' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.dashboardState', error: repoError }, 'Failed to get dashboard state');
  });

  it('returns 500 and logs error on countByType failure', async () => {
    const eventError = new Error('DB down');
    logger = createMockLogger();
    startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue([makeQueueItem()]) }, { countByType: jest.fn<any>().mockRejectedValue(eventError) });

    const res = await fetchResponse(server, '/api/dashboard-state');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get dashboard state' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.dashboardState', error: eventError }, 'Failed to get dashboard state');
  });
});
