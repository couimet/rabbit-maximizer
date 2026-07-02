import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createGetQueueOrderHandler, createMoveQueueOrderHandler } from '../../src/routes/queueOrderRoutes.js';
import { fetchResponse } from '../helpers/fetchResponse.js';
import { getJson } from '../helpers/getJson.js';
import { createMockLogger, createMockQueueOrderRepo } from '../helpers/index.js';
import { postJson } from '../helpers/postJson.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

interface QueueItemStub {
  id: number;
  repo_full_name: string;
  pr_number: number;
}

const makeItem = (id: number): QueueItemStub => ({ id, repo_full_name: 'c/r', pr_number: id });

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
      const items = [makeItem(1), makeItem(2), makeItem(3)];
      const moved = [makeItem(2), makeItem(1), makeItem(3)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [2], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('moves single item down and returns updated order', async () => {
      const items = [makeItem(1), makeItem(2), makeItem(3)];
      const moved = [makeItem(1), makeItem(3), makeItem(2)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [2], direction: 'down' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('no-ops when moving item at top up', async () => {
      const items = [makeItem(1), makeItem(2)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(items),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [1], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: items });
    });

    it('no-ops when moving item at bottom down', async () => {
      const items = [makeItem(1), makeItem(2)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(items),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [2], direction: 'down' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: items });
    });

    it('moves non-adjacent items up past their respective neighbors', async () => {
      const items = [makeItem(1), makeItem(2), makeItem(3), makeItem(4)];
      const moved = [makeItem(3), makeItem(1), makeItem(4), makeItem(2)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [3, 4], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('moves adjacent items as a block up', async () => {
      const items = [makeItem(1), makeItem(2), makeItem(3), makeItem(4)];
      const moved = [makeItem(2), makeItem(3), makeItem(1), makeItem(4)];
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockResolvedValue(moved),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [2, 3], direction: 'up' });
      expect(res.status).toBe(StatusCodes.OK);
      expect(await res.json()).toStrictEqual({ data: moved });
    });

    it('returns 400 when direction is invalid', async () => {
      const items = [makeItem(1)];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [1], direction: 'left' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'direction must be "up" or "down"' });
    });

    it('returns 400 when queueItemIds is empty', async () => {
      startServer();

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [], direction: 'up' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemIds must be a non-empty array of positive integers' });
    });

    it('returns 400 when queueItemIds has non-integer values', async () => {
      startServer();

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [1.5], direction: 'up' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toStrictEqual({ error: 'queueItemIds must be a non-empty array of positive integers' });
    });

    it('returns 400 when request body is missing', async () => {
      startServer();

      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Server not listening');
      const res = await fetch(`http://[::1]:${addr.port}/api/queue/order/move`, { method: 'POST' });
      expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('returns 404 when a queueItemId does not exist', async () => {
      const items = [makeItem(1)];
      startServer({ getEffectiveOrder: jest.fn<any>().mockResolvedValue(items) });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [999], direction: 'up' });
      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(await res.json()).toStrictEqual({ error: 'Queue items not found: 999' });
    });

    it('returns 500 and logs error on repository failure (transaction rolls back)', async () => {
      const items = [makeItem(1)];
      const repoError = new Error('DB down');
      startServer({
        getEffectiveOrder: jest.fn<any>().mockResolvedValue(items),
        moveItems: jest.fn<any>().mockRejectedValue(repoError),
      });

      const res = await postJson(server, '/api/queue/order/move', { queueItemIds: [1], direction: 'up' });
      expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(await res.json()).toStrictEqual({ error: 'Failed to move queue items' });
      expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.queueOrder.move', error: repoError }, 'Failed to move queue items');
    });
  });
});
