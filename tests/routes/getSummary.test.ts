import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetSummaryHandler } from '../../src/routes/getSummary.js';
import { createMockEventRepo, createMockLogger, createMockQueueRepo } from '../helpers/index.js';
import { fetchResponse, getJson } from '../helpers/testHttpClient.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';

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
        getCountsByStatus: jest.fn<any>().mockResolvedValue({ pending: 5, posted: 3, completed: 10, failed: 2 }),
        getPendingQueue: jest.fn<any>().mockResolvedValue([{ id: 1, repo_full_name: 'c/r', pr_number: 42, scheduled_for: '2026-01-01T00:00:00.000Z' }]),
      },
      {
        countByType: jest.fn<any>().mockResolvedValue({ detected: 8, enqueued: 7, posted: 3, rejected: 1, completed: 2, failed: 1 }),
      },
    );

    const json = await getJson(server, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { pending: 5, posted: 3, completed: 10, failed: 2 },
      eventCounts24h: { detected: 8, enqueued: 7, posted: 3, rejected: 1, completed: 2, failed: 1 },
      oldestPending: { id: 1, repo_full_name: 'c/r', pr_number: 42, scheduled_for: '2026-01-01T00:00:00.000Z' },
    });
  });

  it('returns null oldestPending when queue is empty', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(server, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { pending: 0, posted: 0, completed: 0, failed: 0 },
      eventCounts24h: { detected: 0, enqueued: 0, posted: 0, rejected: 0, completed: 0, failed: 0 },
      oldestPending: null,
    });
  });

  it('returns 500 and logs error on repository failure', async () => {
    logger = createMockLogger();
    startServer({ getCountsByStatus: jest.fn<any>().mockRejectedValue(new Error('DB down')) });

    const res = await fetchResponse(server, '/api/summary');
    expect(res.status).toBe(500);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get summary' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getSummary', error: expect.any(Error) }, 'Failed to get summary');
  });
});
