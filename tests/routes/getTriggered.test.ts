import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { createGetTriggeredHandler } from '../../src/routes/index.js';
import { apiJson, createMockQueueItemMapper, createMockQueueRepo, fetchResponse, generateQueueItemHydrationData, getJson } from '../helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getTriggered', () => {
  let server: Server;
  let port: number;
  let logger: ReturnType<typeof createMockLogger>;
  let since: string;
  let queueItemMapper: ReturnType<typeof createMockQueueItemMapper>;

  beforeEach(() => {
    since = getUniqueDate().toISOString();
    queueItemMapper = createMockQueueItemMapper();
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const result = startTestServer(logger, (app) => {
      app.get('/api/queue/triggered', createGetTriggeredHandler(createMockQueueRepo(over), queueItemMapper, logger));
    });
    server = result.server;
    port = result.port;
  };

  it('returns 200 with paginated triggered items', async () => {
    const queueItems = [generateQueueItemHydrationData(), generateQueueItemHydrationData()];
    startServer({ getTriggered: jest.fn<any>().mockResolvedValue({ items: queueItems, total: 2 }) });

    const json = await getJson(port, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(json).toStrictEqual(apiJson({ data: await queueItemMapper.mapToQueueItemResponseList(queueItems), total: 2, page: 1, pageSize: 50 }));
  });

  it('returns empty data when no items exist', async () => {
    startServer();
    const json = await getJson(port, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it('returns 400 when since is missing', async () => {
    startServer();
    const res = await fetchResponse(port, '/api/queue/triggered');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('returns 400 when since is empty', async () => {
    startServer();
    const res = await fetchResponse(port, '/api/queue/triggered?since=');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('returns 400 when since is not a valid date', async () => {
    startServer();
    const res = await fetchResponse(port, '/api/queue/triggered?since=not-a-date');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('passes include_reviewed=true to the repository', async () => {
    const getTriggered = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getTriggered });
    await getJson(port, `/api/queue/triggered?since=${encodeURIComponent(since)}&include_reviewed=true`);
    expect(getTriggered).toHaveBeenCalledWith(expect.any(Date), 0, 50, true);
  });

  it('defaults include_reviewed to false', async () => {
    const getTriggered = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getTriggered });
    await getJson(port, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(getTriggered).toHaveBeenCalledWith(expect.any(Date), 0, 50, false);
  });

  it('clamps pageSize to MAX_PAGE_SIZE when exceeding limit', async () => {
    startServer();
    const json = await getJson(port, `/api/queue/triggered?since=${encodeURIComponent(since)}&pageSize=200`);
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 100 });
  });

  it('parses page and pageSize from query string', async () => {
    const getTriggered = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getTriggered });
    await getJson(port, `/api/queue/triggered?since=${encodeURIComponent(since)}&page=3&pageSize=10`);
    expect(getTriggered).toHaveBeenCalledWith(expect.any(Date), 20, 10, false);
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ getTriggered: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(port, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get triggered items' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.getTriggered', error: repoError }, 'Failed to get triggered items');
  });
});
