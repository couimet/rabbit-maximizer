import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetEventsHandler } from '../../src/routes/getEvents.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockEventRepo, createMockLogger } from '../helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import type { Server } from 'http';

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
        id: 1,
        uuid: 'evt-abc-123',
        ts: '2026-06-23T14:30:00.000Z',
        type: 'detected',
        repo_full_name: 'c/r',
        pr_number: 42,
        correlation_id: 'corr-001',
        version: '1.0.0',
        payload: {},
      },
    ];
    startServer({ listRecent: jest.fn<any>().mockResolvedValue({ items, total: 1 }) });

    const json = await getJson(server, '/api/events');
    expect(json).toStrictEqual({ data: items, total: 1, page: 1, pageSize: 20 });
  });

  it('returns empty data when no events exist', async () => {
    startServer();
    const json = await getJson(server, '/api/events');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 20 });
  });

  it('parses page and pageSize from query string', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });
    await getJson(server, '/api/events?page=2&pageSize=10');
    expect(listRecent).toHaveBeenCalledWith(10, 10);
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
