import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetQueueHandler } from '../../src/routes/getQueue.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockLogger, createMockQueueRepo, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getQueue', () => {
  let server: Server;
  let logger: Logger;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const app = createExpressApp({ logger });
    app.get('/api/queue', createGetQueueHandler(createMockQueueRepo(over), logger));
    server = app.listen(0);
  };

  it('returns 200 with paginated queue items', async () => {
    const items = [{ id: getUniqueInt(), repo_full_name: makeUniqueRepoName().fullName, pr_number: getUniqueInt() }];
    startServer({ getAll: jest.fn<any>().mockResolvedValue({ items, total: 1 }) });

    const json = await getJson(server, '/api/queue');
    expect(json).toStrictEqual({ data: items, total: 1, page: 1, pageSize: 20 });
  });

  it('returns empty data when no items exist', async () => {
    startServer();
    const json = await getJson(server, '/api/queue');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 20 });
  });

  it('clamps pageSize to MAX_PAGE_SIZE when exceeding limit', async () => {
    startServer();
    const json = await getJson(server, '/api/queue?pageSize=200');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 100 });
  });

  it('parses page and pageSize from query string', async () => {
    const getAll = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getAll });
    await getJson(server, '/api/queue?page=3&pageSize=5');
    expect(getAll).toHaveBeenCalledWith(10, 5);
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ getAll: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(server, '/api/queue');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get queue' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getQueue', error: repoError }, 'Failed to get queue');
  });
});
