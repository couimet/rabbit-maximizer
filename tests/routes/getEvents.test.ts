import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { EventEntryMapper } from '../../src/mappers/index.js';
import { createGetEventsHandler } from '../../src/routes/index.js';
import { apiJson, createMockEventRepo, fetchResponse, generateEventLogEntryHydrationData, getJson } from '../helpers/index.js';

import { getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import type { Server } from 'node:http';

describe('getEvents', () => {
  let server: Server;
  let port: number;
  let logger: ReturnType<typeof createMockLogger>;
  let runId: string;

  beforeEach(() => {
    runId = getUuid();
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const eventEntryMapper = new EventEntryMapper();

  /** @testFixture */
  const startServer = (over = {}) => {
    logger = createMockLogger();
    const result = startTestServer(logger, (app) => {
      app.get('/api/events', createGetEventsHandler(createMockEventRepo(over), eventEntryMapper, logger));
    });
    server = result.server;
    port = result.port;
  };

  it('returns 200 with paginated events', async () => {
    const eventEntries = [generateEventLogEntryHydrationData(), generateEventLogEntryHydrationData()];
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
    expect(listRecent).toHaveBeenCalledWith(10, 10, undefined);
  });

  it('filters by a bare runId query param', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });

    await getJson(port, `/api/events?runId=${runId}`);

    expect(listRecent).toHaveBeenCalledWith(0, 50, runId);
  });

  it('accepts the run= token as it appears in a posted comment footer', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });

    await getJson(port, `/api/events?runId=${encodeURIComponent(`run=${runId}`)}`);

    expect(listRecent).toHaveBeenCalledWith(0, 50, runId);
  });

  it('trims surrounding whitespace from the runId query param', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });

    await getJson(port, `/api/events?runId=${encodeURIComponent(`  ${runId}  `)}`);

    expect(listRecent).toHaveBeenCalledWith(0, 50, runId);
  });

  it('drops a blank runId query param', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });

    await getJson(port, '/api/events?runId=%20');

    expect(listRecent).toHaveBeenCalledWith(0, 50, undefined);
  });

  it('returns 400 when runId is not a UUID', async () => {
    const listRecent = jest.fn<any>().mockResolvedValue({ items: [], total: 0 });
    startServer({ listRecent });

    const res = await fetchResponse(port, '/api/events?runId=not-a-uuid');

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'runId must be a valid UUID v4' });
    expect(listRecent).not.toHaveBeenCalled();
  });

  it('custom pageSize query param still works', async () => {
    const TS = new Date('2026-06-25T10:00:00.000Z');
    const eventEntries = [
      generateEventLogEntryHydrationData({ id: 3, uuid: 'evt-custom', ts: TS, repo_full_name: 'o/r', pr_number: 99, correlation_id: 'corr-003' }),
    ];
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
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.getEvents', error: repoError }, 'Failed to get events');
  });
});
