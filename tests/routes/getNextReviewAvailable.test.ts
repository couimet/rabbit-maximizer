import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetNextReviewAvailableHandler } from '../../src/routes/getNextReviewAvailable.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockLogger } from '../helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getNextReviewAvailable', () => {
  let logger: Logger;
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const createMockSystemStateRepo = (overrides: Record<string, unknown> = {}) => ({
    getState: jest.fn<any>(),
    setState: jest.fn<any>(),
    ...overrides,
  });

  const createMockQueueRepo = (overrides: Record<string, unknown> = {}) => ({
    getOldestPending: jest.fn<any>().mockResolvedValue(null),
    ...overrides,
  });

  const startServer = (systemStateRepoOver: Record<string, unknown> = {}, queueRepoOver: Record<string, unknown> = {}) => {
    const app = createExpressApp({ logger });
    app.get(
      '/api/state/next_review_available_at',
      createGetNextReviewAvailableHandler(createMockSystemStateRepo(systemStateRepoOver) as any, createMockQueueRepo(queueRepoOver) as any, logger),
    );
    server = app.listen(0);
  };

  it('returns timestamp when value is in the future', async () => {
    logger = createMockLogger();
    const futureDate = new Date(Date.now() + 3600_000);
    startServer({
      getState: jest.fn<any>().mockResolvedValue(futureDate),
    });

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: futureDate.toISOString() });
  });

  it('returns null when value is in the past', async () => {
    logger = createMockLogger();
    const pastDate = new Date(Date.now() - 3600_000);
    startServer({
      getState: jest.fn<any>().mockResolvedValue(pastDate),
    });

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: null });
  });

  it('returns null when key is unset', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: null });
  });

  it('falls back to oldest pending queue item when state is stale', async () => {
    logger = createMockLogger();
    const pastDate = new Date(Date.now() - 3600_000);
    const futureNotBefore = new Date(Date.now() + 900_000);
    startServer(
      { getState: jest.fn<any>().mockResolvedValue(pastDate) },
      { getOldestPending: jest.fn<any>().mockResolvedValue({ not_before: futureNotBefore }) },
    );

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: futureNotBefore.toISOString() });
  });

  it('falls back to oldest pending queue item when state is unset', async () => {
    logger = createMockLogger();
    const futureNotBefore = new Date(Date.now() + 900_000);
    startServer({}, { getOldestPending: jest.fn<any>().mockResolvedValue({ not_before: futureNotBefore }) });

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: futureNotBefore.toISOString() });
  });

  it('returns null when state is stale and pending item not_before is also in the past', async () => {
    logger = createMockLogger();
    const pastDate = new Date(Date.now() - 3600_000);
    const pastNotBefore = new Date(Date.now() - 900_000);
    startServer(
      { getState: jest.fn<any>().mockResolvedValue(pastDate) },
      { getOldestPending: jest.fn<any>().mockResolvedValue({ not_before: pastNotBefore }) },
    );

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: null });
  });

  it('returns null when state is stale and there are no pending items', async () => {
    logger = createMockLogger();
    const pastDate = new Date(Date.now() - 3600_000);
    startServer({ getState: jest.fn<any>().mockResolvedValue(pastDate) }, { getOldestPending: jest.fn<any>().mockResolvedValue(null) });

    const json = await getJson(server, '/api/state/next_review_available_at');
    expect(json).toStrictEqual({ next_review_available_at: null });
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    logger = createMockLogger();
    startServer({
      getState: jest.fn<any>().mockRejectedValue(repoError),
    });

    const res = await fetchResponse(server, '/api/state/next_review_available_at');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get next review available time' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith(
      { fn: 'api.getNextReviewAvailable', error: repoError },
      'Failed to get next review available time',
    );
  });
});
