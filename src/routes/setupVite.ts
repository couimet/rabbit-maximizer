import type { Logger } from '@couimet/logger-contract';
import type { Application } from 'express';

export const setupVite = async (app: Application, logger: Logger, port: number): Promise<void> => {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: 'dashboard',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
  logger.info({ fn: 'setupVite', port }, 'Dashboard running with Vite HMR');
};

export const trySetupVite = (app: Application, logger: Logger, port: number): void => {
  setupVite(app, logger, port).catch((error) => {
    logger.warn({ fn: 'trySetupVite', error }, 'Vite dev server not available (dashboard directory may not exist yet)');
  });
};
