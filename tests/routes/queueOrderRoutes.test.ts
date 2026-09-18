import { RabbitResult } from '../../src/domain.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../../src/errors/index.js';
import { startTestServer } from '../../src/external-deps/couimet/express-tools-testing/startTestServer.js';
import { PrismaRecordNotFoundError } from '../../src/external-deps/couimet/prisma-repo/PrismaRecordNotFoundError.js';
import {
  createGetQueueOrderHandler,
  createMarkReviewedHandler,
  createMoveQueueOrderHandler,
  createMoveToTopHandler,
  createRetriggerNowHandler,
} from '../../src/routes/index.js';
import {
  apiJson,
  createMockQueueItemMapper,
  createMockQueueOrderRepo,
  createMockQueueRepo,
  createMockSystemStateRepository,
  fetchResponse,
  generateQueueItemHydrationData,
  getJson,
  postJson,
} from '../helpers/index.js';

import { getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import { StatusCodes } from 'http-status-codes';
import type { Server } from 'node:http';

describe('queueOrderRoutes', () => {
  let server: Server;
  let logger: ReturnType<typeof createMockLogger>;
  let port: number;
  let queueItemMapper: ReturnType<typeof createMockQueueItemMapper>;
  let uuidA: string;
  let uuidB: string;
  let uuidC: string;
  let uuidD: string;

  beforeEach(() => {
    logger = createMockLogger();
    queueItemMapper = createMockQueueItemMapper();
    uuidA = getUuid();
    uuidB = getUuid();
    uuidC = getUuid();
    uuidD = getUuid();
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/queue/order', () => {
    /** @testFixture */
    const startServer = (over = {}) => {
      const result = startTestServer(logger, (app) => {
        app.get('/api/queue/order', createGetQueueOrderHandler(createMockQueueOrderRepo(over), queueItemMapper, logger));
      });
      server = result.server;
      port = result.port;
    };

    it('returns 200 with data array when items exist', async () => {
      const items = [generateQueueItemHydrationData(), generateQueueItemHydrationData()];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const json = await getJson(port, '/api/queue/order');
      expect(json).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(items)) });
    });

    it('returns 200 with empty data when no items', async () => {
      startServer();

      const json = await getJson(port, '/api/queue/order');
      expect(json).toStrictEqual({ data: [] });
    });

    it('returns 500 and logs error on repository failure', async () => {
      const repoError = new Error('DB down');
      startServer({ getEffectiveOrder: jest.fn<any>().mockRejectedValue(repoError) });

      const res = await fetchResponse(port, '/api/queue/order');
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to get queue order' });
      expect(logger.error).toHaveBeenCalledWith({ fn: 'api.queueOrder.get', error: repoError }, 'Failed to get queue order');
    });
  });

  describe('POST /api/queue/order/move', () => {
    /** @testFixture */
    const startServer = (over = {}) => {
      const result = startTestServer(logger, (app) => {
        app.use(express.json());
        app.post('/api/queue/order/move', createMoveQueueOrderHandler(createMockQueueOrderRepo(over), queueItemMapper, logger));
      });
      server = result.server;
      port = result.port;
    };

    it('moves single item up and returns updated order', async () => {
      const items = [
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidB }),
        generateQueueItemHydrationData({ uuid: uuidC }),
      ];
      const moved = [
        generateQueueItemHydrationData({ uuid: uuidB }),
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidC }),
      ];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidB], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(moved)) });
    });

    it('moves single item down and returns updated order', async () => {
      const items = [
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidB }),
        generateQueueItemHydrationData({ uuid: uuidC }),
      ];
      const moved = [
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidC }),
        generateQueueItemHydrationData({ uuid: uuidB }),
      ];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidB], direction: 'down' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(moved)) });
    });

    it('no-ops when moving item at top up', async () => {
      const items = [generateQueueItemHydrationData({ uuid: uuidA }), generateQueueItemHydrationData({ uuid: uuidB })];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(items),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidA], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(items)) });
    });

    it('no-ops when moving item at bottom down', async () => {
      const items = [generateQueueItemHydrationData({ uuid: uuidA }), generateQueueItemHydrationData({ uuid: uuidB })];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(items),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidB], direction: 'down' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(items)) });
    });

    it('moves non-adjacent items up past their respective neighbors', async () => {
      const items = [
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidB }),
        generateQueueItemHydrationData({ uuid: uuidC }),
        generateQueueItemHydrationData({ uuid: uuidD }),
      ];
      const moved = [
        generateQueueItemHydrationData({ uuid: uuidC }),
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidD }),
        generateQueueItemHydrationData({ uuid: uuidB }),
      ];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidC, uuidD], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(moved)) });
    });

    it('moves adjacent items as a block up', async () => {
      const items = [
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidB }),
        generateQueueItemHydrationData({ uuid: uuidC }),
        generateQueueItemHydrationData({ uuid: uuidD }),
      ];
      const moved = [
        generateQueueItemHydrationData({ uuid: uuidB }),
        generateQueueItemHydrationData({ uuid: uuidC }),
        generateQueueItemHydrationData({ uuid: uuidA }),
        generateQueueItemHydrationData({ uuid: uuidD }),
      ];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidB, uuidC], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: apiJson(await queueItemMapper.mapToQueueItemResponseList(moved)) });
    });

    it('returns 400 when direction is invalid', async () => {
      const items = [generateQueueItemHydrationData({ uuid: uuidA })];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidA], direction: 'left' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'direction must be "up" or "down"' });
    });

    it('returns 400 when queueItemUuids is empty', async () => {
      startServer();

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [], direction: 'up' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemUuids must be a non-empty array of UUID v4 strings' });
    });

    it('returns 400 when queueItemUuids has non-UUID values', async () => {
      startServer();

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: ['not-a-uuid'], direction: 'up' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemUuids must be a non-empty array of UUID v4 strings' });
    });

    it('returns 400 when request body is missing', async () => {
      startServer();

      const res = await fetch(`http://[::1]:${port}/api/queue/order/move`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 when a queueItemUuid does not exist', async () => {
      const items = [generateQueueItemHydrationData({ uuid: uuidA })];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: ['99999999-9999-9999-9999-999999999999'], direction: 'up' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: 'Queue items not found: 99999999-9999-9999-9999-999999999999' });
    });

    it('returns 500 and logs error on repository failure (transaction rolls back)', async () => {
      const items = [generateQueueItemHydrationData({ uuid: uuidA })];
      const repoError = new Error('DB down');
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockRejectedValue(repoError),
      });

      const res = await postJson(port, '/api/queue/order/move', { queueItemUuids: [uuidA], direction: 'up' });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to move queue items' });
      expect(logger.error).toHaveBeenCalledWith({ fn: 'api.queueOrder.move', error: repoError }, 'Failed to move queue items');
    });
  });

  describe('POST /api/queue/:uuid/retrigger-now', () => {
    const TRIGGER_OK = RabbitResult.ok({ retriggeredCommentUrl: 'https://gh/c/retriggered' });

    /** @testFixture */
    const startServer = (over = {}, systemStateRepoOver = {}, triggerResult = TRIGGER_OK) => {
      const mockReviewTrigger = { trigger: jest.fn<any>().mockResolvedValue(triggerResult) };
      const result = startTestServer(logger, (app) => {
        app.post(
          '/api/queue/:uuid/retrigger-now',
          createRetriggerNowHandler(
            createMockQueueOrderRepo(over),
            createMockSystemStateRepository(systemStateRepoOver as any),
            mockReviewTrigger as any,
            logger,
          ),
        );
      });
      server = result.server;
      port = result.port;
      return { mockReviewTrigger };
    };

    it('returns 409 when scheduler is paused', async () => {
      startServer({}, { isSchedulerPaused: jest.fn<any>().mockResolvedValue(true) });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: 'Maximizer is paused; resume it before retriggering' });
      expect(logger.info).toHaveBeenCalledWith({ fn: 'api.queueOrder.retriggerNow', uuid: uuidA }, 'Retrigger blocked: scheduler is paused');
    });

    it('allows retrigger when paused if overridePause=true is passed', async () => {
      startServer(
        { getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...generateQueueItemHydrationData({ uuid: uuidA }), status: 'pending' }]) },
        { isSchedulerPaused: jest.fn<any>().mockResolvedValue(true) },
      );

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now?overridePause=true`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.NO_CONTENT);
      expect(logger.info).toHaveBeenCalledWith(
        { fn: 'api.queueOrder.retriggerNow', uuid: uuidA },
        'Retriggering while scheduler is paused (overridePause=true)',
      );
    });

    it('proceeds normally when schedulerStatus is running', async () => {
      startServer(
        { getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...generateQueueItemHydrationData({ uuid: uuidA }), status: 'pending' }]) },
        { isSchedulerPaused: jest.fn<any>().mockResolvedValue(false) },
      );

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.NO_CONTENT);
    });

    it('returns 204', async () => {
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...generateQueueItemHydrationData({ uuid: uuidA }), status: 'pending' }]) });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.NO_CONTENT);
    });

    it('returns 409 when ReviewTrigger rejects with stale comment', async () => {
      const triggerErr = RabbitResult.err(
        new RabbitMaximizerError({
          code: RabbitMaximizerErrorCodes.RETRIGGER_STALE_COMMENT_SKIP,
          message: 'Source comment is gone with no replacement',
          functionName: 'ReviewTrigger.trigger',
        }),
      );
      startServer(
        { getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...generateQueueItemHydrationData({ uuid: uuidA }), status: 'pending' }]) },
        {},
        triggerErr,
      );

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: 'Failed to retrigger now' });
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'api.queueOrder.retriggerNow', uuid: uuidA, error: triggerErr.error }, 'Failed to retrigger now');
    });

    it('returns 400 for non-UUID id', async () => {
      startServer();

      const res = await fetch(`http://[::1]:${port}/api/queue/not-a-uuid/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'uuid must be a valid UUID v4' });
    });

    it('returns 404 when item not found', async () => {
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue([generateQueueItemHydrationData({ uuid: uuidA }), generateQueueItemHydrationData({ uuid: uuidB })]),
      });

      const res = await fetch(`http://[::1]:${port}/api/queue/99999999-9999-9999-9999-999999999999/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: 'Queue item not found' });
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'api.queueOrder.retriggerNow', uuid: '99999999-9999-9999-9999-999999999999' }, 'Queue item not found');
    });

    it('returns 409 when item is already resolved', async () => {
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...generateQueueItemHydrationData({ uuid: uuidA }), status: 'resolved' }]),
      });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: 'Queue item is already resolved' });
      expect(logger.warn).toHaveBeenCalledWith({ fn: 'api.queueOrder.retriggerNow', uuid: uuidA, status: 'resolved' }, 'Queue item is already resolved');
    });

    it('returns 409 when item is in retrigger cooldown', async () => {
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...generateQueueItemHydrationData({ uuid: uuidA }), status: 'retriggered' }]),
      });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: 'Queue item is in retrigger cooldown' });
      expect(logger.warn).toHaveBeenCalledWith(
        { fn: 'api.queueOrder.retriggerNow', uuid: uuidA, status: 'retriggered' },
        'Queue item is in retrigger cooldown',
      );
    });

    it('returns 500 on repository error', async () => {
      const repoError = new Error('DB down');
      startServer({
        getEffectiveOrder: jest.fn<any>().mockRejectedValue(repoError),
      });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to retrigger now' });
      expect(logger.error).toHaveBeenCalledWith({ fn: 'api.queueOrder.retriggerNow', error: repoError }, 'Failed to retrigger now');
    });
  });

  describe('POST /api/queue/order/move-to-top', () => {
    /** @testFixture */
    const startServer = (over = {}) => {
      const result = startTestServer(logger, (app) => {
        app.use(express.json());
        app.post('/api/queue/order/move-to-top', createMoveToTopHandler(createMockQueueOrderRepo(over), logger));
      });
      server = result.server;
      port = result.port;
    };

    it('moves item to top and returns 204', async () => {
      startServer({
        moveToTop: jest.fn<any>().mockResolvedValue({}),
      });

      const res = await postJson(port, '/api/queue/order/move-to-top', { queueItemUuid: uuidC });
      expect(res.status).toBe(StatusCodes.NO_CONTENT);
      expect(await res.text()).toBe('');
    });

    it('returns 204 when moving item already at top', async () => {
      startServer({
        moveToTop: jest.fn<any>().mockResolvedValue({}),
      });

      const res = await postJson(port, '/api/queue/order/move-to-top', { queueItemUuid: uuidA });
      expect(res.status).toBe(StatusCodes.NO_CONTENT);
      expect(await res.text()).toBe('');
    });

    it('returns 400 when queueItemUuid is not a valid UUID', async () => {
      startServer();

      const res = await postJson(port, '/api/queue/order/move-to-top', { queueItemUuid: 'not-a-uuid' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemUuid must be a valid UUID v4' });
    });

    it('returns 400 when request body is missing', async () => {
      startServer();

      const res = await fetch(`http://[::1]:${port}/api/queue/order/move-to-top`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 when queueItemUuid does not exist', async () => {
      const notFoundError = new PrismaRecordNotFoundError({
        tableName: 'reviewQueue',
        functionName: 'QueueOrderRepositoryImpl.moveToTop',
      });
      startServer({ moveToTop: jest.fn<any>().mockRejectedValue(notFoundError) });

      const res = await postJson(port, '/api/queue/order/move-to-top', { queueItemUuid: '99999999-9999-9999-9999-999999999999' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: "Record not found in table 'reviewQueue'" });
    });

    it('returns 409 when item is already resolved', async () => {
      const notPendingError = new RabbitMaximizerError({
        code: RabbitMaximizerErrorCodes.QUEUE_ITEM_NOT_PENDING,
        message: `Queue item ${uuidA} is already resolved`,
        functionName: 'QueueOrderRepositoryImpl.moveToTop',
      });
      startServer({ moveToTop: jest.fn<any>().mockRejectedValue(notPendingError) });

      const res = await postJson(port, '/api/queue/order/move-to-top', { queueItemUuid: uuidA });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: `Queue item ${uuidA} is already resolved` });
    });

    it('returns 500 and logs error on unexpected failure', async () => {
      const repoError = new Error('DB down');
      startServer({ moveToTop: jest.fn<any>().mockRejectedValue(repoError) });

      const res = await postJson(port, '/api/queue/order/move-to-top', { queueItemUuid: uuidA });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to move item to top' });
      expect(logger.error).toHaveBeenCalledWith({ fn: 'api.queueOrder.moveToTop', error: repoError }, 'Failed to move item to top');
    });
  });

  describe('POST /api/queue/:uuid/mark-reviewed', () => {
    /** @testFixture */
    const startServer = (over = {}, txOverride?: { $transaction: jest.Mock<any>; sentinelTx: object }) => {
      const txClient = txOverride?.sentinelTx ?? {};
      const prisma = txOverride ?? { $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(txClient)), sentinelTx: txClient };
      const result = startTestServer(logger, (app) => {
        app.post('/api/queue/:uuid/mark-reviewed', createMarkReviewedHandler(createMockQueueRepo(over), prisma as any, logger));
      });
      server = result.server;
      port = result.port;
    };

    it('returns 200 with { ok: true }', async () => {
      const sentinelTx = { __sentinel: true };
      const item = generateQueueItemHydrationData({ uuid: uuidA });
      const markResolvedByUuid = jest.fn<any>().mockResolvedValue(item);
      const $transaction = jest.fn<any>().mockImplementation((fn: any) => fn(sentinelTx));
      startServer({ markResolvedByUuid }, { $transaction, sentinelTx });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/mark-reviewed`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ ok: true });
      expect($transaction).toHaveBeenCalled();
      expect(markResolvedByUuid).toHaveBeenCalledWith(uuidA, 'manual_review', sentinelTx);
    });

    it('returns 400 for non-UUID id', async () => {
      startServer();

      const res = await fetch(`http://[::1]:${port}/api/queue/not-a-uuid/mark-reviewed`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'uuid must be a valid UUID v4' });
    });

    it('returns 404 when item not found', async () => {
      startServer({ markResolvedByUuid: jest.fn<any>().mockResolvedValue(undefined) });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/mark-reviewed`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: `Queue item not found: ${uuidA}` });
    });

    it('returns 500 on repository error', async () => {
      const repoError = new Error('DB down');
      startServer({ markResolvedByUuid: jest.fn<any>().mockRejectedValue(repoError) });

      const res = await fetch(`http://[::1]:${port}/api/queue/${uuidA}/mark-reviewed`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to mark item reviewed' });
      expect(logger.error).toHaveBeenCalledWith({ fn: 'api.queueOrder.markResolved', error: repoError }, 'Failed to mark item resolved');
    });
  });
});
