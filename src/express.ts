import type { EventRepository } from './db/eventRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { createExpressApp } from './external-deps/couimet/express-tools/createExpressApp.js';
import { createGetSummaryHandler, createGetQueueHandler, createGetEventsHandler } from './routes/index.js';
import { trySetupVite } from './routes/setupVite.js';

import type { Logger } from '@couimet/logger-contract';
import express from 'express';
import type { Request, Response } from 'express';
import type { Server } from 'http';

export interface ExpressDeps {
  eventRepo: EventRepository;
  queueRepo: QueueRepository;
  logger: Logger;
  port: number;
}

export interface ExpressApp {
  port: number;
  stop(): Promise<void>;
}

export const setupExpress = (deps: ExpressDeps): ExpressApp => {
  const { queueRepo, eventRepo, logger, port } = deps;
  const app = createExpressApp({ logger });

  app.get('/api/summary', createGetSummaryHandler(queueRepo, eventRepo, logger));
  app.get('/api/queue', createGetQueueHandler(queueRepo, logger));
  app.get('/api/events', createGetEventsHandler(eventRepo, logger));

  app.get('/icon.png', (_req: Request, res: Response) => res.sendFile('assets/icon.png', { root: '.' }));
  app.get('/icon_256.png', (_req: Request, res: Response) => res.sendFile('assets/icon_256.png', { root: '.' }));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dashboard/dist'));
  } else {
    trySetupVite(app, logger, port);
  }

  const server = app.listen(port);
  const actualPort = (server.address() as { port: number }).port;

  return {
    port: actualPort,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
};
