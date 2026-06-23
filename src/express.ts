import type { EventRepository } from './db/eventRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import { createExpressApp } from './external-deps/couimet/express-tools/createExpressApp.js';

import type { Logger } from '@couimet/logger-contract';
import express from 'express';
import type { Request, Response } from 'express';
import type { Server } from 'http';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MILLISECONDS_IN_24_HOURS = 86_400_000;

export interface ExpressDeps {
  eventRepo: EventRepository;
  queueRepo: QueueRepository;
  logger: Logger;
  port: number;
}

export interface ExpressApp {
  stop(): Promise<void>;
}

export const setupExpress = (deps: ExpressDeps): ExpressApp => {
  const { queueRepo, eventRepo, logger, port } = deps;
  const app = createExpressApp({ logger });

  app.get('/api/summary', async (_req: Request, res: Response) => {
    try {
      const [queueCounts, eventCounts24h, pending] = await Promise.all([
        queueRepo.getCountsByStatus(),
        eventRepo.countByType(new Date(Date.now() - MILLISECONDS_IN_24_HOURS)),
        queueRepo.getPendingQueue(),
      ]);

      res.json({ queueCounts, eventCounts24h, oldestPending: pending.length > 0 ? pending[0] : null });
    } catch (error) {
      logger.error({ fn: 'api.getSummary', error }, 'Failed to get summary');
      res.status(500).json({ error: 'Failed to get summary' });
    }
  });

  app.get('/api/queue', async (req: Request, res: Response) => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.pageSize)) || DEFAULT_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await queueRepo.getAll(skip, pageSize);

      res.json({ data: items, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getQueue', error }, 'Failed to get queue');
      res.status(500).json({ error: 'Failed to get queue' });
    }
  });

  app.get('/api/events', async (req: Request, res: Response) => {
    try {
      const page = Math.max(DEFAULT_PAGE, parseInt(String(req.query.page)) || DEFAULT_PAGE);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.pageSize)) || DEFAULT_PAGE_SIZE));
      const skip = (page - 1) * pageSize;

      const { items, total } = await eventRepo.listRecent(skip, pageSize);

      res.json({ data: items, total, page, pageSize });
    } catch (error) {
      logger.error({ fn: 'api.getEvents', error }, 'Failed to get events');
      res.status(500).json({ error: 'Failed to get events' });
    }
  });

  let server: Server;

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dashboard/dist'));
  } else {
    trySetupVite(app, deps).catch(() => {
      logger.warn({ fn: 'setupExpress' }, 'Vite dev server not available (dashboard directory may not exist yet)');
    });
  }

  server = app.listen(port, () => {
    logger.info({ fn: 'setupExpress', port }, 'Dashboard API server started');
  });

  return {
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
};

const trySetupVite = async (app: ReturnType<typeof createExpressApp>, deps: ExpressDeps): Promise<void> => {
  const { logger, port } = deps;
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: 'dashboard',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
  logger.info({ fn: 'setupExpress', port }, 'Dashboard running with Vite HMR');
};
