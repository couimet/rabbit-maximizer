import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetSummaryHandler } from '../../src/routes/getSummary.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockEventRepo, createMockLogger, createMockQueueRepo } from '../helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getSummary', () => {
  let logger: Logger;
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const startServer = (queueRepoOver = {}, eventRepoOver = {}) => {
    const app = createExpressApp({ logger });
    app.get('/api/summary', createGetSummaryHandler(createMockQueueRepo(queueRepoOver), createMockEventRepo(eventRepoOver), logger));
    server = app.listen(0);
  };

  it('returns 200 with queue counts, event counts, and oldest pending', async () => {
    logger = createMockLogger();
    startServer(
      {
        getCountsByStatus: jest.fn<any>().mockResolvedValue({ pending: 5, retriggered: 3, completed: 10, failed: 2 }),
        getOldestPending: jest.fn<any>().mockResolvedValue({ id: 1, repo_full_name: 'c/r', pr_number: 42, not_before: '2026-01-01T00:00:00.000Z' }),
      },
      {
        countByType: jest.fn<any>().mockResolvedValue({ detected: 8, enqueued: 7, retriggered: 3, bypassed: 1, completed: 2, failed: 1 }),
      },
    );

    const json = await getJson(server, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { pending: 5, retriggered: 3, failed: 2 },
      eventCounts: { detected: 8, enqueued: 7, retriggered: 3, failed: 1 },
      oldestPending: { id: 1, repo_full_name: 'c/r', pr_number: 42, not_before: '2026-01-01T00:00:00.000Z' },
    });
  });

  it('returns null oldestPending when queue is empty', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(server, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { pending: 0, retriggered: 0, failed: 0 },
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      oldestPending: null,
    });
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    logger = createMockLogger();
    startServer({ getCountsByStatus: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(server, '/api/summary');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get summary' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getSummary', error: repoError }, 'Failed to get summary');
  });

  it('response omits "completed" from queueCounts', async () => {
    logger = createMockLogger();
    startServer({
      getCountsByStatus: jest.fn<any>().mockResolvedValue({ pending: 5, retriggered: 3, completed: 10, failed: 2 }),
    });

    const json = await getJson(server, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { pending: 5, retriggered: 3, failed: 2 },
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      oldestPending: null,
    });
  });

  it('response omits "bypassed" and "completed" from eventCounts', async () => {
    logger = createMockLogger();
    startServer(
      {},
      {
        countByType: jest.fn<any>().mockResolvedValue({ detected: 1, enqueued: 2, retriggered: 3, bypassed: 4, completed: 5, failed: 6 }),
      },
    );

    const json = await getJson(server, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { pending: 0, retriggered: 0, failed: 0 },
      eventCounts: { detected: 1, enqueued: 2, retriggered: 3, failed: 6 },
      oldestPending: null,
    });
  });

  it('duration param "2d" passes correct since window', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 });
    startServer({}, { countByType });

    await getJson(server, '/api/summary?duration=2d');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 172_800_000));
  });

  it('invalid duration defaults to "24h"', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 });
    startServer({}, { countByType });

    await getJson(server, '/api/summary?duration=invalid');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });

  it('rejects prototype keys like "toString" for duration', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({ detected: 0, enqueued: 0, retriggered: 0, bypassed: 0, completed: 0, failed: 0 });
    startServer({}, { countByType });

    await getJson(server, '/api/summary?duration=toString');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });
});
