import { createGetEventsHandler } from '../../src/routes/getEvents.js';
import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createMockEventRepo, createMockLogger } from '../helpers/index.js';
import { fetchResponse, getJson } from '../helpers/testHttpClient.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';

describe('getEvents', () => {
  let server: Server;
  let logger: Logger;

  afterEach(() => {
    server?.close();
  });

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const app = createExpressApp({ logger });
    app.get('/api/events', createGetEventsHandler(createMockEventRepo(over), logger));
    server = app.listen(0);
  };

  it('returns 200 with paginated events', async () => {
    const items = [{ id: 1, type: 'detected', repo_full_name: 'c/r', pr_number: 42 }];
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
    startServer({ listRecent: jest.fn<any>().mockRejectedValue(new Error('DB down')) });

    const res = await fetchResponse(server, '/api/events');
    expect(res.status).toBe(500);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get events' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getEvents', error: expect.any(Error) }, 'Failed to get events');
  });
});
