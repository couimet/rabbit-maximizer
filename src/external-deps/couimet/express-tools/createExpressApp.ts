import { createMorganMiddleware, MiddlewareIdentifier } from './index.js';

import { getLogger, type Logger } from '@couimet/logger-contract';
import express, { type Application, type RequestHandler } from 'express';
import helmet from 'helmet';

/**
 * A map of middleware identifiers to their handlers.
 * Known keys ({@link MiddlewareIdentifier}) get autocomplete; callers can also
 * add custom string keys for project-specific middleware.
 */
export type MiddlewareMap = { [K in MiddlewareIdentifier]?: RequestHandler } & { [key: string]: RequestHandler };

export interface CreateExpressOptions {
  /** Whether to add Helmet security headers. Defaults to true. */
  helmet: boolean;
  logger: Logger;
  /**
   * Request handlers applied after helmet, before the app is returned to the caller.
   * Defaults are built from {@link buildDefaultMiddlewares} using the resolved logger.
   * When provided, it replaces the defaults entirely — no merge.
   * Set a key to a different handler to override a specific middleware,
   * or omit a key to skip that middleware.
   */
  middlewares: MiddlewareMap;
}

export interface BuildDefaultMiddlewaresOptions {
  logger: Logger;
}

/**
 * Builds the default middleware map using the given logger so middleware that
 * depends on a logger (e.g. morgan) receives the caller's logger rather than the
 * module-load-time {@link getLogger} result.
 */
export const buildDefaultMiddlewares = (options: BuildDefaultMiddlewaresOptions): MiddlewareMap => ({
  [MiddlewareIdentifier.MORGAN]: createMorganMiddleware({ logger: options.logger }),
});

const BASE_DEFAULTS: Omit<CreateExpressOptions, 'middlewares'> = {
  helmet: true,
  logger: getLogger(),
};

/**
 * Creates a pre-configured Express application.
 *
 * All options have defaults. The merge filters out `undefined` values so a
 * partial options object can be passed without unspecified fields overriding
 * defaults.
 */
export const createExpressApp = (options?: Partial<CreateExpressOptions>): Application => {
  const baseOpts: Omit<CreateExpressOptions, 'middlewares'> = {
    ...BASE_DEFAULTS,
    // Filters out undefined values so callers can pass a partial override
    ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined)),
  };

  const middlewaresProvided = options !== undefined && 'middlewares' in options;

  const opts: CreateExpressOptions = {
    ...baseOpts,
    middlewares: middlewaresProvided ? (options.middlewares ?? {}) : buildDefaultMiddlewares({ logger: baseOpts.logger }),
  };

  const app = express();

  if (opts.helmet) {
    app.use(helmet());
  }

  for (const [identifier, handler] of Object.entries(opts.middlewares)) {
    opts.logger.info({ fn: 'createExpressApp', middleware: identifier }, 'Applying middleware');
    app.use(handler);
  }

  opts.logger.info({ fn: 'createExpressApp' }, 'Express app created');

  return app;
};
