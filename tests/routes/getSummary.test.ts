import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { EventCountsMapper } from '../../src/mappers/index.js';
import { createGetSummaryHandler } from '../../src/routes/index.js';
import {
  apiJson,
  createMockEventRepo,
  createMockQueueItemMapper,
  createMockQueueRepo,
  fetchResponse,
  generateEnrichedQueueItemData,
  getJson,
} from '../helpers/index.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('getSummary', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let server: Server;
  let port: number;
  let queueItemMapper: ReturnType<typeof createMockQueueItemMapper>;
  let eventCountsMapper: EventCountsMapper;

  beforeEach(() => {
    queueItemMapper = createMockQueueItemMapper();
    eventCountsMapper = new EventCountsMapper();
  });

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
    const item = generateEnrichedQueueItemData();
    const detected = getUniqueInt();
    const enqueued = getUniqueInt();
    const retriggered = getUniqueInt();
    const failed = getUniqueInt();
    startServer(
      {
        getOldestPending: jest.fn<any>().mockResolvedValue(item),
      },
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected,
          enqueued,
          retriggered,
          bypassed: getUniqueInt(),
          coderabbit_review_approved: getUniqueInt(),
          coderabbit_review_changes_suggested: getUniqueInt(),
          failed,
        }),
      },
    );

    const json = await getJson(port, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { coderabbit_skipped: 0, pending: 0, retriggered: 0, reviewed: 0, failed: 0 },
      eventCounts: { detected, enqueued, retriggered, failed },
      oldestPending: apiJson(queueItemMapper.mapToQueueItemResponse(item)),
    });
  });

  it('returns null oldestPending when queue is empty', async () => {
    logger = createMockLogger();
    startServer();

    const json = await getJson(port, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { coderabbit_skipped: 0, pending: 0, retriggered: 0, reviewed: 0, failed: 0 },
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
    expect(logger.error).toHaveBeenCalledWith({ fn: 'api.getSummary', error: repoError }, 'Failed to get summary');
  });

  it('response omits bypassed, coderabbit_review_approved, and coderabbit_review_changes_suggested from eventCounts', async () => {
    logger = createMockLogger();
    const detected = getUniqueInt();
    const enqueued = getUniqueInt();
    const retriggered = getUniqueInt();
    const failed = getUniqueInt();
    startServer(
      {},
      {
        countByType: jest.fn<any>().mockResolvedValue({
          detected,
          enqueued,
          retriggered,
          bypassed: getUniqueInt(),
          coderabbit_review_approved: getUniqueInt(),
          coderabbit_review_changes_suggested: getUniqueInt(),
          failed,
        }),
      },
    );

    const json = await getJson(port, '/api/summary');
    expect(json).toStrictEqual({
      queueCounts: { coderabbit_skipped: 0, pending: 0, retriggered: 0, reviewed: 0, failed: 0 },
      eventCounts: { detected, enqueued, retriggered, failed },
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
      coderabbit_review_changes_suggested: 0,
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
      coderabbit_review_changes_suggested: 0,
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
      coderabbit_review_changes_suggested: 0,
      failed: 0,
    });
    startServer({}, { countByType });

    await getJson(port, '/api/summary?duration=toString');

    expect(countByType).toHaveBeenCalledWith(new Date(fixedNow - 86_400_000));
  });
});
