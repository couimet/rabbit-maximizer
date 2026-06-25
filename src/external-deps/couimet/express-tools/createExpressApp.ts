import type { Logger } from '@couimet/logger-contract';
import { getLogger } from '@couimet/logger-contract';
import express, { type Application } from 'express';
import helmet from 'helmet';

export interface CreateExpressOptions {
  /** Whether to add Helmet security headers. Defaults to true. */
  helmet: boolean;
  logger: Logger;
}

const DEFAULT_OPTIONS: CreateExpressOptions = {
  helmet: true,
  logger: getLogger(),
};

/**
 * Creates a pre-configured Express application.
 *
 * All options are enabled by default. Callers opt out by passing `false` for
 * the relevant option. The merge filters out `undefined` values so a partial
 * options object can be passed without unspecified fields overriding defaults.
 */
export const createExpressApp = (options?: Partial<CreateExpressOptions>): Application => {
  const opts: CreateExpressOptions = {
    ...DEFAULT_OPTIONS,
    // Filters out undefined values so callers can pass a partial override
    ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined)),
  };

  const app = express();

  if (opts.helmet) {
    app.use(helmet());
  }

  opts.logger.info({ fn: 'createExpressApp' }, 'Express app created');

  return app;
};
