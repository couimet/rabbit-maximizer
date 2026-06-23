import type { Logger } from '@couimet/logger-contract';
import express, { type Application } from 'express';
import helmet from 'helmet';

export interface CreateExpressOptions {
  logger: Logger;
}

export const createExpressApp = (options: CreateExpressOptions): Application => {
  const app = express();
  app.use(helmet());
  return app;
};
