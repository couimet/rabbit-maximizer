import type { Logger } from '@couimet/logger-contract';
import express, { type Application } from 'express';

export interface CreateExpressOptions {
  logger: Logger;
}

export const createExpressApp = (options: CreateExpressOptions): Application => {
  const app = express();
  // Future middleware registration points go here (request ID, logging, healthcheck, etc.)
  return app;
};
