import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetTriggeredHandler } from '../../src/routes/getTriggered.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockLogger, createMockQueueRepo } from '../helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getTriggered', () => {
  let server: Server;
  let logger: Logger;
  let since: string;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    since = getUniqueDate().toISOString();
  });

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const app = createExpressApp({ logger });
    app.get('/api/queue/triggered', createGetTriggeredHandler(createMockQueueRepo(over), logger));
    server = app.listen(0);
  };

  it('returns 200 with paginated triggered items', async () => {
    const items = [{ id: 1, repo_full_name: 'c/r', pr_number: 42 }];
    startServer({ getTriggered: jest.fn<any>().mockResolvedValue({ items, total: 1 }) });

    const json = await getJson(server, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(json).toStrictEqual({ data: items, total: 1, page: 1, pageSize: 50 });
  });

  it('returns empty data when no items exist', async () => {
    startServer();
    const json = await getJson(server, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it('returns 400 when since is missing', async () => {
    startServer();
    const res = await fetchResponse(server, '/api/queue/triggered');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('returns 400 when since is empty', async () => {
    startServer();
    const res = await fetchResponse(server, '/api/queue/triggered?since=');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('returns 400 when since is not a valid date', async () => {
    startServer();
    const res = await fetchResponse(server, '/api/queue/triggered?since=not-a-date');
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'since must be a valid ISO 8601 datetime' });
  });

  it('passes include_completed=true to the repository', async () => {
    const getTriggered = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getTriggered });
    await getJson(server, `/api/queue/triggered?since=${encodeURIComponent(since)}&include_completed=true`);
    expect(getTriggered).toHaveBeenCalledWith(expect.any(Date), 0, 50, true);
  });

  it('defaults include_completed to false', async () => {
    const getTriggered = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getTriggered });
    await getJson(server, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(getTriggered).toHaveBeenCalledWith(expect.any(Date), 0, 50, false);
  });

  it('clamps pageSize to MAX_PAGE_SIZE when exceeding limit', async () => {
    startServer();
    const json = await getJson(server, `/api/queue/triggered?since=${encodeURIComponent(since)}&pageSize=200`);
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 100 });
  });

  it('parses page and pageSize from query string', async () => {
    const getTriggered = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ getTriggered });
    await getJson(server, `/api/queue/triggered?since=${encodeURIComponent(since)}&page=3&pageSize=10`);
    expect(getTriggered).toHaveBeenCalledWith(expect.any(Date), 20, 10, false);
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ getTriggered: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(server, `/api/queue/triggered?since=${encodeURIComponent(since)}`);
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get triggered items' });
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.getTriggered', error: repoError }, 'Failed to get triggered items');
  });
});
