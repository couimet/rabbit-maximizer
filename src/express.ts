import type { EventRepository, PullRequestRepository, QueueOrderRepository, QueueRepository, SystemStateRepository } from './db/index.js';
import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from './errors/index.js';
import { createExpressApp } from './external-deps/couimet/express-tools/index.js';
import type { EventCountsMapper, EventEntryMapper, QueueItemMapper } from './mappers/index.js';
import {
  createGetConfigHandler,
  createGetDashboardStateHandler,
  createGetEventsHandler,
  createGetQueueHandler,
  createGetQueueOrderHandler,
  createGetSummaryHandler,
  createGetTriggeredHandler,
  createMarkReviewedHandler,
  createMoveQueueOrderHandler,
  createMoveToTopHandler,
  createRetriggerNowHandler,
  createSetPausedHandler,
  trySetupVite,
} from './routes/index.js';
import type { Config } from './config.js';
import { isProduction } from './domain.js';
import type { ReviewTrigger } from './services.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard');

export interface ExpressDeps {
  config: Config;
  eventCountsMapper: EventCountsMapper;
  eventEntryMapper: EventEntryMapper;
  eventRepo: EventRepository;
  pullRequestRepo: PullRequestRepository;
  prisma: PrismaClient;
  queueItemMapper: QueueItemMapper;
  queueOrderRepo: QueueOrderRepository;
  queueRepo: QueueRepository;
  reviewTrigger: ReviewTrigger;
  systemStateRepo: SystemStateRepository;
  logger: Logger;
  port: number;
}

export interface ExpressApp {
  port: number;
  stop(): Promise<void>;
}

export const setupExpress = (deps: ExpressDeps): ExpressApp => {
  const {
    config,
    eventCountsMapper,
    eventEntryMapper,
    eventRepo,
    pullRequestRepo,
    prisma,
    queueItemMapper,
    queueOrderRepo,
    queueRepo,
    reviewTrigger,
    systemStateRepo,
    logger,
    port,
  } = deps;
  const production = isProduction();
  const app = createExpressApp({ logger, helmet: production });

  app.use(express.json());
  app.get('/api/summary', createGetSummaryHandler(queueRepo, eventRepo, queueItemMapper, eventCountsMapper, logger));
  app.get('/api/queue', createGetQueueHandler(queueRepo, queueItemMapper, logger));
  app.get('/api/config', createGetConfigHandler(config, logger));
  app.get('/api/dashboard-state', createGetDashboardStateHandler(queueOrderRepo, eventRepo, systemStateRepo, queueItemMapper, eventCountsMapper, logger));
  app.get('/api/queue/order', createGetQueueOrderHandler(queueOrderRepo, queueItemMapper, logger));
  app.post('/api/queue/order/move', createMoveQueueOrderHandler(queueOrderRepo, queueItemMapper, logger));
  app.post('/api/queue/order/move-to-top', createMoveToTopHandler(queueOrderRepo, logger));
  app.post('/api/queue/:uuid/retrigger-now', createRetriggerNowHandler(queueOrderRepo, systemStateRepo, reviewTrigger, logger));
  app.post('/api/queue/:uuid/mark-reviewed', createMarkReviewedHandler(queueRepo, pullRequestRepo, prisma, logger));
  app.get('/api/queue/triggered', createGetTriggeredHandler(queueRepo, queueItemMapper, logger));
  app.post('/api/pause', createSetPausedHandler(systemStateRepo, logger));
  app.get('/api/events', createGetEventsHandler(eventRepo, eventEntryMapper, logger));

  app.get('/icon.png', (_req: Request, res: Response) => res.sendFile('assets/icon.png', { root: '.' }));
  app.get('/icon_256.png', (_req: Request, res: Response) => res.sendFile('assets/icon_256.png', { root: '.' }));

  if (production) {
    app.use(express.static(path.join(DASHBOARD_DIR, 'dist')));
  } else {
    trySetupVite(app, logger, port, DASHBOARD_DIR);
  }

  const server = app.listen(port);
  const address = server.address();
  /* c8 ignore start — defensive: numeric ports always return an address object */
  if (!address || typeof address === 'string') {
    throw new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.SERVER_ADDRESS_NOT_AVAILABLE,
      functionName: 'setupExpress',
      message: 'Server did not bind to a TCP port',
      details: { port },
    });
  }
  /* c8 ignore stop */
  const actualPort = address.port;

  return {
    port: actualPort,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
};
