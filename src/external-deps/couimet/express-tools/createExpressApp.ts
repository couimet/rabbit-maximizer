import { inboundRequestLogger } from './middlewares/inboundRequestLogger.js';
import { createMorganMiddleware, MiddlewareIdentifier } from './index.js';
import type { LabeledMiddleware } from './labeledMiddleware.js';

import { getLogger, type Logger } from '@couimet/logger-contract';
import express, { type Application, type RequestHandler } from 'express';
import helmet from 'helmet';

export type MiddlewareEntry = RequestHandler | LabeledMiddleware;

export interface CreateExpressOptions {
  /** Whether to add Helmet security headers. Defaults to true. */
  helmet: boolean;
  logger: Logger;
  /**
   * Middleware entries registered immediately after app creation, before helmet
   * and the middlewares array. Used for middleware that must prime state every
   * other middleware and handler depends on (e.g. a context-priming middleware).
   * There are no default entries: an omitted or empty array registers nothing,
   * unlike `middlewares` which falls back to the inbound logger and morgan.
   */
  beforeMiddlewares: MiddlewareEntry[];
  /**
   * Middleware entries applied after helmet, before the app is returned to the
   * caller. Defaults are built from {@link buildDefaultMiddlewares} using the
   * resolved logger. When provided, it replaces the defaults entirely: no merge
   * and no per-entry override, so pass an empty array to register none.
   * Registration order is the array order; labeled entries log their label,
   * unlabeled entries log without a name.
   */
  middlewares: MiddlewareEntry[];
}

export interface BuildDefaultMiddlewaresOptions {
  logger: Logger;
}

/**
 * Builds the default middleware entries using the given logger so middleware
 * that depends on a logger (e.g. morgan) receives the caller's logger rather
 * than the module-load-time {@link getLogger} result.
 */
export const buildDefaultMiddlewares = (options: BuildDefaultMiddlewaresOptions): MiddlewareEntry[] => [
  { label: MiddlewareIdentifier.InboundRequestLogger, handler: inboundRequestLogger(options.logger) },
  { label: MiddlewareIdentifier.Morgan, handler: createMorganMiddleware({ logger: options.logger }) },
];

const isLabeledMiddleware = (entry: MiddlewareEntry): entry is LabeledMiddleware => 'label' in entry;

const applyMiddleware = (logger: Logger, app: Application, entry: MiddlewareEntry, index: number): void => {
  if (isLabeledMiddleware(entry)) {
    logger.info({ fn: 'createExpressApp', middleware: entry.label, middlewareIndex: index }, 'Applying middleware');
    app.use(entry.handler);
  } else {
    logger.info({ fn: 'createExpressApp', middlewareIndex: index }, `Applying middleware without a name (index ${index})`);
    app.use(entry);
  }
};

const BASE_DEFAULTS: Omit<CreateExpressOptions, 'middlewares'> = {
  helmet: true,
  logger: getLogger(),
  beforeMiddlewares: [],
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
    middlewares: middlewaresProvided ? (options.middlewares ?? []) : buildDefaultMiddlewares({ logger: baseOpts.logger }),
  };

  const app = express();

  for (const [index, entry] of opts.beforeMiddlewares.entries()) {
    applyMiddleware(opts.logger, app, entry, index);
  }

  if (opts.helmet) {
    app.use(helmet());
  }

  for (const [index, entry] of opts.middlewares.entries()) {
    applyMiddleware(opts.logger, app, entry, index);
  }

  opts.logger.info({ fn: 'createExpressApp' }, 'Express app created');

  return app;
};
