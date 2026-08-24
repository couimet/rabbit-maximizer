import { inboundRequestLogger } from './middlewares/inboundRequestLogger.js';
import { createMorganMiddleware, MORGAN_DEFAULT_FORMAT } from './createMorganMiddleware.js';
import { MiddlewareIdentifier } from './index.js';
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
   * caller. An `undefined` value (including an omitted option) falls back to
   * the defaults built from {@link buildDefaultMiddlewares}. A provided array
   * replaces the defaults entirely: no merge and no per-entry override, so
   * pass an empty array to register none. Registration order is the array
   * order; labeled entries log their label, unlabeled entries log without a
   * name.
   */
  middlewares: MiddlewareEntry[];
  /**
   * Morgan log format used by the default morgan middleware built from
   * {@link buildDefaultMiddlewares}. Ignored when a custom `middlewares`
   * array replaces the defaults. Defaults to {@link MORGAN_DEFAULT_FORMAT}.
   */
  morganFormat: string;
}

export interface BuildDefaultMiddlewaresOptions {
  logger: Logger;
  format: string;
}

/**
 * Builds the default middleware entries using the given logger so middleware
 * that depends on a logger (e.g. morgan) receives the caller's logger rather
 * than the module-load-time {@link getLogger} result.
 */
export const buildDefaultMiddlewares = (options: BuildDefaultMiddlewaresOptions): MiddlewareEntry[] => [
  { label: MiddlewareIdentifier.InboundRequestLogger, handler: inboundRequestLogger(options.logger) },
  { label: MiddlewareIdentifier.Morgan, handler: createMorganMiddleware({ format: options.format, logger: options.logger }) },
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
  morganFormat: MORGAN_DEFAULT_FORMAT,
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

  const opts: CreateExpressOptions = {
    ...baseOpts,
    middlewares: options?.middlewares ?? buildDefaultMiddlewares({ logger: baseOpts.logger, format: baseOpts.morganFormat }),
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
