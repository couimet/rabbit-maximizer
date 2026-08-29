import { getLogger, type Logger } from '@couimet/logger-contract';
import type { RequestHandler } from 'express';
import morgan from 'morgan';

export const MORGAN_DEFAULT_FORMAT = ':method :url :status :response-time ms';

export interface CreateMorganOptions {
  format: string;
  logger: Logger;
}

const DEFAULT_OPTIONS: CreateMorganOptions = {
  format: MORGAN_DEFAULT_FORMAT,
  logger: getLogger(),
};

/**
 * Creates a morgan request-logging middleware wired to the given logger.
 *
 * All options have defaults. The merge filters out `undefined` values so a
 * partial options object can be passed without unspecified fields overriding
 * defaults.
 */
export const createMorganMiddleware = (options?: Partial<CreateMorganOptions>): RequestHandler => {
  const opts: CreateMorganOptions = {
    ...DEFAULT_OPTIONS,
    ...Object.fromEntries(Object.entries(options ?? {}).filter(([, v]) => v !== undefined)),
  };

  return morgan(opts.format, {
    stream: {
      write: (message: string) => {
        opts.logger.info({ fn: 'http.request' }, message.trim());
      },
    },
  });
};
