import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { createGetQueueHandler } from '../../src/routes/index.js';
import { apiJson, createMockQueueItemMapper, createMockQueueRepo, fetchResponse, generateQueueItemHydrationData, getJson } from '../helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getQueue', () => {
  let server: Server;
  let port: number;
  let logger: ReturnType<typeof createMockLogger>;
  let queueItemMapper: ReturnType<typeof createMockQueueItemMapper>;

  beforeEach(() => {
    queueItemMapper = createMockQueueItemMapper();
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const result = startTestServer(logger, (app) => {
      app.get('/api/queue', createGetQueueHandler(createMockQueueRepo(over), queueItemMapper, logger));
    });
    server = result.server;
    port = result.port;
  };

  it('returns 200 with paginated queue items', async () => {
    const queueItems = [generateQueueItemHydrationData(), generateQueueItemHydrationData()];
    startServer({ getAll: jest.fn<any>().mockResolvedValue({ items: queueItems, total: 2 }) });

    const json = await getJson(port, '/api/queue');
    expect(json).toStrictEqual(apiJson({ data: await queueItemMapper.mapToQueueItemResponseList(queueItems), total: 2, page: 1, pageSize: 20 }));
  });

  it('returns empty data when no items exist', async () => {
    startServer();
    const json = await getJson(port, '/api/queue');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 20 });
  });

  it('clamps pageSize to MAX_PAGE_SIZE when exceeding limit', async () => {
    startServer();
    const json = await getJson(port, '/api/queue?pageSize=200');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 100 });
  });

  it('parses page and pageSize from query string', async () => {
    const getAll = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getAll });
    await getJson(port, '/api/queue?page=3&pageSize=5');
    expect(getAll).toHaveBeenCalledWith(10, 5);
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ getAll: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(port, '/api/queue');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get queue' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.getQueue', error: repoError }, 'Failed to get queue');
  });
});
