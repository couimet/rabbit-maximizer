import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetEventsHandler } from '../../src/routes/getEvents.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockEventRepo } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getEvents', () => {
  let server: Server;
  let logger: Logger;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const app = createExpressApp({ logger });
    app.get('/api/events', createGetEventsHandler(createMockEventRepo(over), logger));
    server = app.listen(0);
  };

  it('returns 200 with paginated events', async () => {
    const items = [
      {
        id: getUniqueInt(),
        uuid: getUuid(),
        ts: getUniqueDate().toISOString(),
        type: 'detected',
        repo_full_name: getUniqueGitHubRepoRef().fullName,
        pr_number: getUniqueInt(),
        correlation_id: getUuid(),
        version: '1.0.0',
        payload: {},
      },
    ];
    startServer({ listRecent: jest.fn<any>().mockResolvedValue({ items, total: 1 }) });

    const json = await getJson(server, '/api/events');
    expect(json).toStrictEqual({ data: items, total: 1, page: 1, pageSize: 50 });
  });

  it('returns empty data when no events exist', async () => {
    startServer();
    const json = await getJson(server, '/api/events');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it('parses page and pageSize from query string', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });
    await getJson(server, '/api/events?page=2&pageSize=10');
    expect(listRecent).toHaveBeenCalledWith(10, 10);
  });

  it('custom pageSize query param still works', async () => {
    const items = [
      {
        id: 3,
        uuid: 'evt-custom',
        ts: '2026-06-25T10:00:00.000Z',
        type: 'detected',
        repo_full_name: 'o/r',
        pr_number: 99,
        correlation_id: 'corr-003',
        version: '1.0.0',
        payload: {},
      },
    ];
    startServer({ listRecent: jest.fn<any>().mockResolvedValue({ items, total: 10 }) });

    const json = await getJson(server, '/api/events?pageSize=5');
    expect(json).toStrictEqual({ data: items, total: 10, page: 1, pageSize: 5 });
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ listRecent: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(server, '/api/events');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get events' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getEvents', error: repoError }, 'Failed to get events');
  });
});
