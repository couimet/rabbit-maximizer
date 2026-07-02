import type { EventRepository } from './db/eventRepository.js';
import type { QueueOrderRepository } from './db/queueOrderRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import { RabbitMaximizerErrorCodes } from './errors/RabbitMaximizerErrorCodes.js';
import { createExpressApp } from './external-deps/couimet/express-tools/createExpressApp.js';
import {
  createGetEventsHandler,
  createGetQueueHandler,
  createGetQueueOrderHandler,
  createGetSummaryHandler,
  createMoveQueueOrderHandler,
} from './routes/index.js';
import { trySetupVite } from './routes/setupVite.js';
import { isProduction } from './isProduction.js';

import type { Logger } from '@couimet/logger-contract';
import type { Request, Response } from 'express';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DASHBOARD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dashboard');

export interface ExpressDeps {
  eventRepo: EventRepository;
  queueOrderRepo: QueueOrderRepository;
  queueRepo: QueueRepository;
  logger: Logger;
  port: number;
}

export interface ExpressApp {
  port: number;
  stop(): Promise<void>;
}

export const setupExpress = (deps: ExpressDeps): ExpressApp => {
  const { queueRepo, queueOrderRepo, eventRepo, logger, port } = deps;
  const production = isProduction();
  const app = createExpressApp({ logger, helmet: production });

  app.use(express.json());
  app.get('/api/summary', createGetSummaryHandler(queueRepo, eventRepo, logger));
  app.get('/api/queue', createGetQueueHandler(queueRepo, logger));
  app.get('/api/queue/order', createGetQueueOrderHandler(queueOrderRepo, logger));
  app.post('/api/queue/order/move', createMoveQueueOrderHandler(queueOrderRepo, logger));
  app.get('/api/events', createGetEventsHandler(eventRepo, logger));

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
