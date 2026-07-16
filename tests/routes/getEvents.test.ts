import { EventEntryMapper } from '../../src/mappers/EventEntryMapper.js';
import { createGetEventsHandler } from '../../src/routes/getEvents.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { apiJson, createMockEventRepo, makeEventEntry, startTestServer } from '../helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getEvents', () => {
  let server: Server;
  let port: number;
  let logger: Logger;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const eventEntryMapper = new EventEntryMapper();

  const startServer = (over = {}) => {
    logger = createMockLogger();
    const result = startTestServer(logger, (app) => {
      app.get('/api/events', createGetEventsHandler(createMockEventRepo(over), eventEntryMapper, logger));
    });
    server = result.server;
    port = result.port;
  };

  it('returns 200 with paginated events', async () => {
    const eventEntries = [makeEventEntry(), makeEventEntry()];
    startServer({ listRecent: jest.fn<any>().mockResolvedValue({ items: eventEntries, total: 2 }) });

    const json = await getJson(port, '/api/events');
    expect(json).toStrictEqual({ data: apiJson(eventEntryMapper.mapToEventEntryResponseList(eventEntries)), total: 2, page: 1, pageSize: 50 });
  });

  it('returns empty data when no events exist', async () => {
    startServer();
    const json = await getJson(port, '/api/events');
    expect(json).toStrictEqual({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it('parses page and pageSize from query string', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });
    await getJson(port, '/api/events?page=2&pageSize=10');
    expect(listRecent).toHaveBeenCalledWith(10, 10);
  });

  it('custom pageSize query param still works', async () => {
    const TS = new Date('2026-06-25T10:00:00.000Z');
    const eventEntries = [makeEventEntry({ id: 3, uuid: 'evt-custom', ts: TS, repo_full_name: 'o/r', pr_number: 99, correlation_id: 'corr-003' })];
    startServer({ listRecent: jest.fn<any>().mockResolvedValue({ items: eventEntries, total: 10 }) });

    const json = await getJson(port, '/api/events?pageSize=5');
    expect(json).toStrictEqual({ data: apiJson(eventEntryMapper.mapToEventEntryResponseList(eventEntries)), total: 10, page: 1, pageSize: 5 });
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    startServer({ listRecent: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(port, '/api/events');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get events' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getEvents', error: repoError }, 'Failed to get events');
  });
});
