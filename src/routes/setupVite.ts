import { createExpressApp } from '../external-deps/couimet/express-tools/createExpressApp.js';

import type { Logger } from '@couimet/logger-contract';
import type { Application } from 'express';

export const setupVite = async (app: Application, logger: Logger, port: number): Promise<void> => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: 'dashboard',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
  logger.info({ fn: 'setupExpress', port }, 'Dashboard running with Vite HMR');
};

export const trySetupVite = (app: ReturnType<typeof createExpressApp>, logger: Logger, port: number): void => {
  setupVite(app, logger, port).catch(() => {
    logger.warn({ fn: 'setupExpress' }, 'Vite dev server not available (dashboard directory may not exist yet)');
  });
};
