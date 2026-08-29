import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { createGetActivityListHandler } from '../../src/routes/index.js';
import { apiJson, createMockActivityListMapper, createMockQueueRepo, fetchResponse, generateQueueItemHydrationData, getJson } from '../helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import type { Server } from 'node:http';

describe('getActivityList', () => {
  let server: Server;
  let port: number;
  let logger: ReturnType<typeof createMockLogger>;
  let since: string;

  beforeEach(() => {
    since = getUniqueDate().toISOString();
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** @testFixture */
  const startServer = (over = {}, mapperOverrides = {}) => {
    logger = createMockLogger();
    const mapper = createMockActivityListMapper({ mapToList: jest.fn<any>().mockImplementation((items: any) => Promise.resolve(items)), ...mapperOverrides });
    const result = startTestServer(logger, (app) => {
      app.get('/api/activity-list', createGetActivityListHandler(createMockQueueRepo(over), mapper, logger));
    });
    server = result.server;
    port = result.port;
  };

  it('returns 200 with paginated activity list items', async () => {
    const queueItems = [generateQueueItemHydrationData(), generateQueueItemHydrationData()];
    startServer({ getActivityList: jest.fn<any>().mockResolvedValue({ items: queueItems, total: 2 }) });

    const json = await getJson(port, `/api/activity-list?since=${encodeURIComponent(since)}`);
    expect(json).toStrictEqual(apiJson({ data: queueItems, total: 2, page: 1, pageSize: 50 }));
  });

  it('returns empty data when no items exist', async () => {
    startServer();
    const json = await getJson(port, `/api/activity-list?since=${encodeURIComponent(since)}`);
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it('returns 400 when since is missing', async () => {
    startServer();
    const res = await fetchResponse(port, '/api/activity-list');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('returns 400 when since is empty', async () => {
    startServer();
    const res = await fetchResponse(port, '/api/activity-list?since=');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('returns 400 when since is not a valid date', async () => {
    startServer();
    const res = await fetchResponse(port, '/api/activity-list?since=not-a-date');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('clamps pageSize to MAX_PAGE_SIZE when exceeding limit', async () => {
    startServer();
    const json = await getJson(port, `/api/activity-list?since=${encodeURIComponent(since)}&pageSize=200`);
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 100 });
  });

  it('parses page and pageSize from query string', async () => {
    const getActivityList = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getActivityList });
    await getJson(port, `/api/activity-list?since=${encodeURIComponent(since)}&page=3&pageSize=10`);
    expect(getActivityList).toHaveBeenCalledWith(new Date(since), 20, 10);
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ getActivityList: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(port, `/api/activity-list?since=${encodeURIComponent(since)}`);
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get activity list' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.getActivityList', error: repoError }, 'Failed to get activity list');
  });
});
