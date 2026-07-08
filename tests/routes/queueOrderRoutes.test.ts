import type { Config } from '../../src/config.js';
import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetQueueOrderHandler, createMoveQueueOrderHandler, createRetriggerNowHandler } from '../../src/routes/queueOrderRoutes.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockLogger, createMockQueueOrderRepo, createMockSystemStateRepository } from '../helpers/index.js';
import { postJson } from '../helpers/postJson.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

interface QueueItemStub {
  id: number;
  uuid: string;
  repo_full_name: string;
  pr_number: number;
}

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';
const UUID_D = '44444444-4444-4444-4444-444444444444';

const makeItem = (id: number, uuid?: string): QueueItemStub => ({
  id,
  uuid: uuid ?? '00000000-0000-0000-0000-00000000000' + id,
  repo_full_name: 'c/r',
  pr_number: id,
});

describe('queueOrderRoutes', () => {
  let server: Server;
  let logger: Logger;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('GET /api/queue/order', () => {
    const startServer = (over = {}) => {
      logger = createMockLogger();
      const app = createExpressApp({ logger });
      app.get('/api/queue/order', createGetQueueOrderHandler(createMockQueueOrderRepo(over), logger));
      server = app.listen(0);
    };

    it('returns 200 with data array when items exist', async () => {
      const items = [makeItem(1), makeItem(2)];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const json = await getJson(server, '/api/queue/order');
      expect(json).toStrictEqual({ data: items });
    });

    it('returns 200 with empty data when no items', async () => {
      startServer();

      const json = await getJson(server, '/api/queue/order');
      expect(json).toStrictEqual({ data: [] });
    });

    it('returns 500 and logs error on repository failure', async () => {
      const repoError = new Error('DB down');
      startServer({ getEffectiveOrder: jest.fn<any>().mockRejectedValue(repoError) });

      const res = await fetchResponse(server, '/api/queue/order');
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to get queue order' });
      expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.queueOrder.get', error: repoError }, 'Failed to get queue order');
    });
  });

  describe('POST /api/queue/order/move', () => {
    const startServer = (over = {}) => {
      logger = createMockLogger();

      const app = createExpressApp({ logger });
      app.use(express.json());
      app.post('/api/queue/order/move', createMoveQueueOrderHandler(createMockQueueOrderRepo(over), logger));
      server = app.listen(0);
    };

    it('moves single item up and returns updated order', async () => {
      const items = [makeItem(1, UUID_A), makeItem(2, UUID_B), makeItem(3, UUID_C)];
      const moved = [makeItem(2, UUID_B), makeItem(1, UUID_A), makeItem(3, UUID_C)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_B], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('moves single item down and returns updated order', async () => {
      const items = [makeItem(1, UUID_A), makeItem(2, UUID_B), makeItem(3, UUID_C)];
      const moved = [makeItem(1, UUID_A), makeItem(3, UUID_C), makeItem(2, UUID_B)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_B], direction: 'down' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('no-ops when moving item at top up', async () => {
      const items = [makeItem(1, UUID_A), makeItem(2, UUID_B)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(items),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_A], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: items });
    });

    it('no-ops when moving item at bottom down', async () => {
      const items = [makeItem(1, UUID_A), makeItem(2, UUID_B)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(items),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_B], direction: 'down' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: items });
    });

    it('moves non-adjacent items up past their respective neighbors', async () => {
      const items = [makeItem(1, UUID_A), makeItem(2, UUID_B), makeItem(3, UUID_C), makeItem(4, UUID_D)];
      const moved = [makeItem(3, UUID_C), makeItem(1, UUID_A), makeItem(4, UUID_D), makeItem(2, UUID_B)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_C, UUID_D], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('moves adjacent items as a block up', async () => {
      const items = [makeItem(1, UUID_A), makeItem(2, UUID_B), makeItem(3, UUID_C), makeItem(4, UUID_D)];
      const moved = [makeItem(2, UUID_B), makeItem(3, UUID_C), makeItem(1, UUID_A), makeItem(4, UUID_D)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_B, UUID_C], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('returns 400 when direction is invalid', async () => {
      const items = [makeItem(1, UUID_A)];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_A], direction: 'left' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'direction must be "up" or "down"' });
    });

    it('returns 400 when queueItemUuids is empty', async () => {
      startServer();

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [], direction: 'up' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemUuids must be a non-empty array of UUID v4 strings' });
    });

    it('returns 400 when queueItemUuids has non-UUID values', async () => {
      startServer();

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: ['not-a-uuid'], direction: 'up' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemUuids must be a non-empty array of UUID v4 strings' });
    });

    it('returns 400 when request body is missing', async () => {
      startServer();

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/order/move`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 when a queueItemUuid does not exist', async () => {
      const items = [makeItem(1, UUID_A)];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: ['99999999-9999-9999-9999-999999999999'], direction: 'up' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: 'Queue items not found: 99999999-9999-9999-9999-999999999999' });
    });

    it('returns 500 and logs error on repository failure (transaction rolls back)', async () => {
      const items = [makeItem(1, UUID_A)];
      const repoError = new Error('DB down');
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockRejectedValue(repoError),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemUuids: [UUID_A], direction: 'up' });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to move queue items' });
      expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.queueOrder.move', error: repoError }, 'Failed to move queue items');
    });
  });

  describe('POST /api/queue/:uuid/retrigger-now', () => {
    const startServer = (over = {}, systemStateRepoOver = {}) => {
      logger = createMockLogger();
      const app = createExpressApp({ logger });
      app.post(
        '/api/queue/:uuid/retrigger-now',
        createRetriggerNowHandler(
          createMockQueueOrderRepo(over),
          createMockSystemStateRepository(systemStateRepoOver as any),
          { SCHEDULER_TICK_INTERVAL_MS: 10000 } as Config,
          logger,
        ),
      );
      server = app.listen(0);
    };

    it('returns 409 when scheduler is paused', async () => {
      startServer({}, { isSchedulerPaused: jest.fn<any>().mockResolvedValue(true) });

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/${UUID_A}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: 'Maximizer is paused; resume it before retriggering' });
    });

    it('proceeds normally when schedulerStatus is running', async () => {
      const moveToTop = jest.fn<any>().mockResolvedValue({ ...makeItem(1, UUID_A), status: 'pending' });
      startServer(
        {
          getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...makeItem(1, UUID_A), status: 'pending' }]),
          moveToTop,
        },
        { isSchedulerPaused: jest.fn<any>().mockResolvedValue(false) },
      );

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/${UUID_A}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ ok: true, schedulerTickIntervalSec: 10 });
      expect(moveToTop).toHaveBeenCalledWith(UUID_A, 'dashboard_retrigger_now');
    });

    it('returns 200 with { ok: true, schedulerTickIntervalSec: 10 }', async () => {
      const moveToTop = jest.fn<any>().mockResolvedValue({ ...makeItem(1, UUID_A), status: 'pending' });
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...makeItem(1, UUID_A), status: 'pending' }]),
        moveToTop,
      });

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/${UUID_A}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ ok: true, schedulerTickIntervalSec: 10 });
      expect(moveToTop).toHaveBeenCalledWith(UUID_A, 'dashboard_retrigger_now');
    });

    it('returns 400 for non-UUID id', async () => {
      startServer();

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/not-a-uuid/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'uuid must be a valid UUID v4' });
    });

    it('returns 404 when item not found', async () => {
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue([makeItem(1, UUID_A), makeItem(2, UUID_B)]),
      });

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/99999999-9999-9999-9999-999999999999/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: 'Queue item not found: 99999999-9999-9999-9999-999999999999' });
    });

    it('returns 409 when item is not pending', async () => {
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue([{ ...makeItem(1, UUID_A), status: 'completed' }]),
      });

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/${UUID_A}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(await res.json()).toStrictEqual({ error: `Queue item is not pending: ${UUID_A}` });
    });

    it('returns 500 on repository error', async () => {
      const repoError = new Error('DB down');
      startServer({
        getEffectiveOrder: jest.fn<any>().mockRejectedValue(repoError),
      });

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/${UUID_A}/retrigger-now`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to retrigger now' });
      expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.queueOrder.retriggerNow', error: repoError }, 'Failed to retrigger now');
    });
  });
});
