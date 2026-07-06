import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';

const { createMockVite } = await import('./helpers/index.js');

const viteMock = createMockVite();

jest.unstable_mockModule('vite', () => viteMock);

const { createMockEventRepo, createMockLogger, createMockQueueOrderRepo, createMockQueueRepo } = await import('./helpers/index.js');

const { setupExpress } = await import('../src/express.js');
const { fetchResponse } = await import('./helpers/fetchResponse.js');

describe('setupExpress', () => {
  let port: number;
  let stop: () => Promise<void>;

  afterEach(async () => {
    if (stop) await stop();
  });

  const start = (logger = createMockLogger()) => {
    const app = setupExpress({
      config: { SCHEDULER_TICK_INTERVAL_MS: 10000 } as any,
      queueRepo: createMockQueueRepo(),
      queueOrderRepo: createMockQueueOrderRepo(),
      eventRepo: createMockEventRepo(),
      systemStateRepo: { getState: jest.fn<any>(), setState: jest.fn<any>() },
      logger,
      port: 0,
    });
    stop = app.stop;
    port = app.port;
    return app;
  };

  it('responds 200 on all three API endpoints', async () => {
    start();
    const server = { address: () => ({ port, family: 'IPv6' }) } as unknown as Server;

    const [summaryRes, queueRes, eventsRes] = await Promise.all([
      fetchResponse(server, '/api/summary'),
      fetchResponse(server, '/api/queue'),
      fetchResponse(server, '/api/events'),
    ]);

    expect(summaryRes.status).toBe(200);
    expect(queueRes.status).toBe(200);
    expect(eventsRes.status).toBe(200);
  });

  it('registers the next_review_available_at endpoint', async () => {
    start();
    const server = { address: () => ({ port, family: 'IPv6' }) } as unknown as Server;

    const res = await fetchResponse(server, '/api/state/next_review_available_at');
    expect(res.status).toBe(200);
  });

  it('starts in production mode without Vite', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      start();
      const server = { address: () => ({ port, family: 'IPv6' }) } as unknown as Server;
      const res = await fetchResponse(server, '/api/summary');
      expect(res.status).toBe(200);
      expect(viteMock.createServer).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('rejects stop() when server is already closed', async () => {
    start();
    await stop();
    await expect(stop()).rejects.toThrow();
    stop = async () => {}; // Prevent afterEach from re-closing
  });

  it('logs API requests via morgan with http.request context', async () => {
    const logger = createMockLogger();
    start(logger);
    const server = { address: () => ({ port, family: 'IPv6' }) } as unknown as Server;

    await fetchResponse(server, '/api/summary');

    expect(logger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/api\/summary 200 \d+\.\d+ ms$/));
  });
});
