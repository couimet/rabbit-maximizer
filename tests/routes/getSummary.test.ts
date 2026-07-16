import { EventCountsMapper } from '../../src/mappers/EventCountsMapper.js';
import { QueueItemMapper } from '../../src/mappers/QueueItemMapper.js';
import { createGetSummaryHandler } from '../../src/routes/getSummary.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { apiJson, createMockEventRepo, createMockQueueRepo, makeQueueItem, startTestServer } from '../helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

const queueItemMapper = new QueueItemMapper();
const eventCountsMapper = new EventCountsMapper();

describe('getSummary', () => {
  let logger: Logger;
  let server: Server;
  let port: number;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const startServer = (queueRepoOver = {}, eventRepoOver = {}) => {
    const result = startTestServer(logger, (app) => {
      app.get(
        '/api/summary',
        createGetSummaryHandler(createMockQueueRepo(queueRepoOver), createMockEventRepo(eventRepoOver), queueItemMapper, eventCountsMapper, logger),
      );
    });
    server = result.server;
    port = result.port;
  };

  it('returns 200 with event counts and oldest pending', async () => {
    logger = createMockLogger();
    const item = makeQueueItem();
    startServer(
      {
        getOldestPending: jest.fn<any>().mockResolvedValue(item),
      },
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected: 8,
          enqueued: 7,
          retriggered: 3,
          bypassed: 1,
          coderabbit_review_approved: 1,
          coderabbit_review_changes_requested: 1,
          failed: 1,
        }),
      },
    );

    const json = await getJson(port, '/api/summary');
    expect(json).toStrictEqual({
      eventCounts: { detected: 8, enqueued: 7, retriggered: 3, failed: 1 },
      oldestPending: apiJson(queueItemMapper.mapToQueueItemResponse(item)),
    });
  });

  it('returns null oldestPending when queue is empty', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(port, '/api/summary');
    expect(json).toStrictEqual({
      eventCounts: { detected: 0, enqueued: 0, retriggered: 0, failed: 0 },
      oldestPending: null,
    });
  });

  it('returns 500 and logs error on repository failure', async () => {
    const repoError = new Error('DB down');
    logger = createMockLogger();
    startServer({ getOldestPending: jest.fn<any>().mockRejectedValue(repoError) });

    const res = await fetchResponse(port, '/api/summary');
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to get summary' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.getSummary', error: repoError }, 'Failed to get summary');
  });

  it('response omits bypassed, coderabbit_review_approved, and coderabbit_review_changes_requested from eventCounts', async () => {
    logger = createMockLogger();
    startServer(
      {},
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected: 1,
          enqueued: 2,
          retriggered: 3,
          bypassed: 4,
          coderabbit_review_approved: 3,
          coderabbit_review_changes_requested: 2,
          failed: 6,
        }),
      },
    );

    const json = await getJson(port, '/api/summary');
    expect(json).toStrictEqual({
      eventCounts: { detected: 1, enqueued: 2, retriggered: 3, failed: 6 },
      oldestPending: null,
    });
  });

  it('duration param "2d" passes correct since window', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({
      detected: 0,
      enqueued: 0,
      retriggered: 0,
      bypassed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_requested: 0,
      failed: 0,
    });
    startServer({}, { countByType });

    await getJson(port, '/api/summary?duration=2d');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 172_800_000));
  });

  it('invalid duration defaults to "24h"', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({
      detected: 0,
      enqueued: 0,
      retriggered: 0,
      bypassed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_requested: 0,
      failed: 0,
    });
    startServer({}, { countByType });

    await getJson(port, '/api/summary?duration=invalid');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });

  it('rejects prototype keys like "toString" for duration', async () => {
    logger = createMockLogger();
    const fixedNow = 1_756_800_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const countByType = jest.fn<any>().mockResolvedValue({
      detected: 0,
      enqueued: 0,
      retriggered: 0,
      bypassed: 0,
      coderabbit_review_approved: 0,
      coderabbit_review_changes_requested: 0,
      failed: 0,
    });
    startServer({}, { countByType });

    await getJson(port, '/api/summary?duration=toString');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });
});
