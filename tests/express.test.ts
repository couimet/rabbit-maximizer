import { EventCountsMapper } from '../src/mappers/EventCountsMapper.js';
import { EventEntryMapper } from '../src/mappers/EventEntryMapper.js';
import { QueueItemMapper } from '../src/mappers/QueueItemMapper.js';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';

const { createMockVite } = await import('./helpers/index.js');

const viteMock = createMockVite();

jest.unstable_mockModule('vite', () => viteMock);

const { createMockEventRepo, createMockQueueOrderRepo, createMockQueueRepo, createMockSystemStateRepository } = await import('./helpers/index.js');
const { createMockLogger } = await import('@couimet/logger-contract-testing');

const { setupExpress } = await import('../src/express.js');
const { fetchResponse } = await import('./helpers/fetchResponse.js');

describe('setupExpress', () => {
  let port: number;
  let stop: () => Promise<void>;

  afterEach(async () => {
    if (stop) await stop();
  });

  const start = async (logger?: ReturnType<typeof createMockLogger>) => {
    const app = await setupExpress({
      config: { SCHEDULER_TICK_INTERVAL_SEC: 10 } as any,
      eventCountsMapper: new EventCountsMapper(),
      eventEntryMapper: new EventEntryMapper(),
      queueItemMapper: new QueueItemMapper(),
      queueRepo: createMockQueueRepo(),
      queueOrderRepo: createMockQueueOrderRepo(),
      eventRepo: createMockEventRepo(),
      pullRequestRepo: {} as any,
      prisma: {} as any,
      reviewTrigger: { trigger: jest.fn() } as any,
      systemStateRepo: createMockSystemStateRepository(),
      logger: logger ?? createMockLogger(),
      port: 0,
    });
    stop = app.stop;
    port = app.port;
    return app;
  };

  it('responds 200 on all API endpoints', async () => {
    await start();
    const [summaryRes, queueRes, eventsRes, dashboardRes] = await Promise.all([
      fetchResponse(port, '/api/summary'),
      fetchResponse(port, '/api/queue'),
      fetchResponse(port, '/api/events'),
      fetchResponse(port, '/api/dashboard-state'),
    ]);

    expect(summaryRes.status).toBe(200);
    expect(queueRes.status).toBe(200);
    expect(eventsRes.status).toBe(200);
    expect(dashboardRes.status).toBe(200);
  });

  it('starts in production mode without Vite', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await start();
      const res = await fetchResponse(port, '/api/summary');
      expect(res.status).toBe(200);
      expect(viteMock.createServer).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('rejects stop() when server is already closed', async () => {
    await start();
    await stop();
    await expect(stop()).rejects.toThrow();
    stop = async () => {}; // Prevent afterEach from re-closing
  });

  it('logs API requests via morgan with http.request context', async () => {
    const logger = createMockLogger();
    await start(logger);
    await fetchResponse(port, '/api/summary');

    expect(logger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/api\/summary 200 \d+\.\d+ ms$/));
  });

  it('logs and rethrows when the port is already in use', async () => {
    const blocker = express().listen(0);
    const blockedPort = (blocker.address() as { port: number }).port;
    stop = async () => {}; // setupExpress won't return, so afterEach needs a no-op

    const logger = createMockLogger();
    try {
      await expect(
        setupExpress({
          config: { SCHEDULER_TICK_INTERVAL_SEC: 10 } as any,
          eventCountsMapper: new EventCountsMapper(),
          eventEntryMapper: new EventEntryMapper(),
          queueItemMapper: new QueueItemMapper(),
          queueRepo: createMockQueueRepo(),
          queueOrderRepo: createMockQueueOrderRepo(),
          eventRepo: createMockEventRepo(),
          pullRequestRepo: {} as any,
          prisma: {} as any,
          reviewTrigger: { trigger: jest.fn() } as any,
          systemStateRepo: createMockSystemStateRepository(),
          logger,
          port: blockedPort,
        }),
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }

    expect(logger.error).toHaveBeenCalledWith({ fn: 'setupExpress', port: blockedPort, error: expect.any(Object) }, 'Failed to start server.');
  });
});
