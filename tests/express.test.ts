import { EventCountsMapper, EventEntryMapper, QueueItemMapper, TrackedPrMapper } from '../src/mappers/index.js';

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { createMockVite } = await import('./helpers/index.js');

const viteMock = createMockVite();

jest.unstable_mockModule('vite', () => viteMock);

const {
  EXPECTED_CSP_WITHOUT_UPGRADE_INSECURE_REQUESTS,
  createMockActivityListMapper,
  createMockEventRepo,
  createMockPullRequestRepo,
  createMockQueueItemEnricher,
  createMockQueueOrderRepo,
  createMockQueueRepo,
  createMockSystemStateRepository,
} = await import('./helpers/index.js');
const { createMockLogger } = await import('@couimet/logger-contract-testing');

const { setupExpress } = await import('../src/express.js');
const { fetchResponse } = await import('./helpers/fetchResponse.js');

const tempDirs: string[] = [];

const createTempDashboardDir = async (built: boolean): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rabbit-maximizer-dashboard-'));
  tempDirs.push(dir);
  if (built) {
    await mkdir(path.join(dir, 'dist'), { recursive: true });
    await writeFile(path.join(dir, 'dist', 'index.html'), '<!doctype html><html lang="en"></html>');
  }
  return dir;
};

describe('setupExpress', () => {
  let port: number;
  let stop: () => Promise<void>;
  let dashboardDir: string;

  beforeAll(async () => {
    dashboardDir = await createTempDashboardDir(true);
  });

  afterAll(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    if (stop) await stop();
  });

  const start = async (servedDir: string, logger: ReturnType<typeof createMockLogger>) => {
    const app = await setupExpress({
      activityListMapper: createMockActivityListMapper(),
      config: { SCHEDULER_TICK_INTERVAL_SEC: 10 } as any,
      dashboardDir: servedDir,
      eventCountsMapper: new EventCountsMapper(),
      eventEntryMapper: new EventEntryMapper(),
      queueItemMapper: new QueueItemMapper(createMockQueueItemEnricher()),
      queueRepo: createMockQueueRepo(),
      queueOrderRepo: createMockQueueOrderRepo(),
      eventRepo: createMockEventRepo(),
      prisma: {} as any,
      reviewTrigger: { trigger: jest.fn() } as any,
      systemStateRepo: createMockSystemStateRepository(),
      pullRequestRepo: createMockPullRequestRepo(),
      trackedPrMapper: new TrackedPrMapper(),
      logger,
      port: 0,
    });
    stop = app.stop;
    port = app.port;
    return app;
  };

  it('responds 200 on all API endpoints', async () => {
    await start(dashboardDir, createMockLogger());
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

  it('starts in production mode without Vite and drops the upgrade-insecure-requests CSP directive', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await start(dashboardDir, createMockLogger());
      const res = await fetchResponse(port, '/api/summary');
      expect(res.status).toBe(200);
      expect(viteMock.createServer).not.toHaveBeenCalled();
      expect(res.headers.get('content-security-policy')).toBe(EXPECTED_CSP_WITHOUT_UPGRADE_INSECURE_REQUESTS);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('logs and exits when the built dashboard is missing', async () => {
    const prev = process.env.NODE_ENV;
    const exit = process.exit;
    process.env.NODE_ENV = 'production';
    process.exit = jest.fn<typeof process.exit>() as any;
    stop = async () => {}; // Keeps afterEach quiet when start() fails before returning

    const logger = createMockLogger();
    const missingDashboardDir = await createTempDashboardDir(false);

    try {
      await start(missingDashboardDir, logger);

      expect(logger.error).toHaveBeenCalledWith(
        { fn: 'setupExpress', builtDashboardDir: path.join(missingDashboardDir, 'dist') },
        'The built dashboard is missing. Run `pnpm build` first.',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      process.env.NODE_ENV = prev;
      process.exit = exit;
    }
  });

  it('rejects stop() when server is already closed', async () => {
    await start(dashboardDir, createMockLogger());
    await stop();
    await expect(stop()).rejects.toThrow();
    stop = async () => {}; // Prevent afterEach from re-closing
  });

  it('logs API requests via morgan with http.request context', async () => {
    const logger = createMockLogger();
    await start(dashboardDir, logger);
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
          activityListMapper: createMockActivityListMapper(),
          config: { SCHEDULER_TICK_INTERVAL_SEC: 10 } as any,
          dashboardDir,
          eventCountsMapper: new EventCountsMapper(),
          eventEntryMapper: new EventEntryMapper(),
          queueItemMapper: new QueueItemMapper(createMockQueueItemEnricher()),
          queueRepo: createMockQueueRepo(),
          queueOrderRepo: createMockQueueOrderRepo(),
          eventRepo: createMockEventRepo(),
          prisma: {} as any,
          reviewTrigger: { trigger: jest.fn() } as any,
          systemStateRepo: createMockSystemStateRepository(),
          pullRequestRepo: createMockPullRequestRepo(),
          trackedPrMapper: new TrackedPrMapper(),
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
