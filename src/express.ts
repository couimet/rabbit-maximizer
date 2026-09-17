import type { EventRepository, PullRequestRepository, QueueOrderRepository, QueueRepository, SystemStateRepository } from './db/index.js';
import { createExpressAppWithExecutionContext } from './external-deps/couimet/execution-context-http-express/src/index.js';
import { startServer } from './external-deps/couimet/express-tools/index.js';
import type { EventCountsMapper, EventEntryMapper, QueueItemMapper, ReviewQueueToActivityListItemMapper, TrackedPrMapper } from './mappers/index.js';
import {
  createGetActivityListHandler,
  createGetConfigHandler,
  createGetDashboardStateHandler,
  createGetEventsHandler,
  createGetQueueHandler,
  createGetQueueOrderHandler,
  createGetSummaryHandler,
  createMarkReviewedHandler,
  createMoveQueueOrderHandler,
  createMoveToTopHandler,
  createRetriggerNowHandler,
  createSetPausedHandler,
  trySetupVite,
} from './routes/index.js';
// The `utils` barrel is shared with the dashboard bundle. Re-exporting this
// util from it puts a `node:fs` import in the browser module graph and breaks
// `pnpm dev`, so this one import stays pointed at the source file.
// eslint-disable-next-line barrel-boundary/enforce-barrel-files
import { hasBuiltDashboard } from './utils/hasBuiltDashboard.js';
import type { Config } from './config.js';
import { isProduction } from './domain.js';
import type { ReviewTrigger } from './services.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import type { HelmetOptions } from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard');

// Helmet's default policy sets upgrade-insecure-requests, which rewrites every
// asset URL to HTTPS. The dashboard is reachable on plain HTTP LAN addresses, so
// that one directive breaks every asset load. A null value drops it alone and
// keeps the rest of the default policy.
const HELMET_OPTIONS: HelmetOptions = {
  contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
};

export interface ExpressDeps {
  config: Config;
  /**
   * Dashboard project root, which is also the Vite dev root. The production
   * mount serves the `dist` child of this directory.
   */
  dashboardDir: string;
  eventCountsMapper: EventCountsMapper;
  eventEntryMapper: EventEntryMapper;
  eventRepo: EventRepository;
  prisma: PrismaClient;
  pullRequestRepo: PullRequestRepository;
  activityListMapper: ReviewQueueToActivityListItemMapper;
  queueItemMapper: QueueItemMapper;
  queueOrderRepo: QueueOrderRepository;
  queueRepo: QueueRepository;
  reviewTrigger: ReviewTrigger;
  systemStateRepo: SystemStateRepository;
  trackedPrMapper: TrackedPrMapper;
  logger: Logger;
  port: number;
}

export interface ExpressApp {
  port: number;
  stop(): Promise<void>;
}

export const setupExpress = async (deps: ExpressDeps): Promise<ExpressApp> => {
  const {
    activityListMapper,
    config,
    dashboardDir,
    eventCountsMapper,
    eventEntryMapper,
    eventRepo,
    prisma,
    pullRequestRepo,
    queueItemMapper,
    queueOrderRepo,
    queueRepo,
    reviewTrigger,
    systemStateRepo,
    trackedPrMapper,
    logger,
    port,
  } = deps;
  const production = isProduction();
  const builtDashboardDir = path.join(dashboardDir, 'dist');

  // Without this check the server starts and answers every dashboard request
  // with 404, which looks like a routing bug instead of a missing build.
  if (production && !hasBuiltDashboard(builtDashboardDir)) {
    logger.error({ fn: 'setupExpress', builtDashboardDir }, 'The built dashboard is missing. Run `pnpm build` first.');
    process.exit(1);
  }

  const app = createExpressAppWithExecutionContext({ logger, helmet: production, helmetOptions: HELMET_OPTIONS });

  app.use(express.json());
  app.get('/api/summary', createGetSummaryHandler(queueRepo, eventRepo, queueItemMapper, eventCountsMapper, logger));
  app.get('/api/queue', createGetQueueHandler(queueRepo, queueItemMapper, logger));
  app.get('/api/config', createGetConfigHandler(config, logger));
  app.get(
    '/api/dashboard-state',
    createGetDashboardStateHandler(
      queueOrderRepo,
      queueRepo,
      eventRepo,
      systemStateRepo,
      pullRequestRepo,
      queueItemMapper,
      eventCountsMapper,
      trackedPrMapper,
      logger,
      config,
    ),
  );
  app.get('/api/queue/order', createGetQueueOrderHandler(queueOrderRepo, queueItemMapper, logger));
  app.post('/api/queue/order/move', createMoveQueueOrderHandler(queueOrderRepo, queueItemMapper, logger));
  app.post('/api/queue/order/move-to-top', createMoveToTopHandler(queueOrderRepo, logger));
  app.post('/api/queue/:uuid/retrigger-now', createRetriggerNowHandler(queueOrderRepo, systemStateRepo, reviewTrigger, logger));
  app.post('/api/queue/:uuid/mark-reviewed', createMarkReviewedHandler(queueRepo, prisma, logger));
  app.get('/api/activity-list', createGetActivityListHandler(queueRepo, activityListMapper, logger));
  app.post('/api/pause', createSetPausedHandler(systemStateRepo, logger));
  app.get('/api/events', createGetEventsHandler(eventRepo, eventEntryMapper, logger));

  if (production) {
    app.use(express.static(builtDashboardDir));
  } else {
    trySetupVite(app, logger, port, dashboardDir);
  }

  let server: ReturnType<typeof app.listen>;
  let actualPort: number;

  try {
    const result = await startServer(app, port);
    server = result.server;
    actualPort = result.port;
  } catch (err: unknown) {
    logger.error({ fn: 'setupExpress', port, error: err }, 'Failed to start server.');
    throw err;
  }

  return {
    port: actualPort,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
};
