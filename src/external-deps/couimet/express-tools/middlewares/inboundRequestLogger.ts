import type { Logger } from '@couimet/logger-contract';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Logs the start of each request; morgan logs completion. Registered after
 * the execution-context middleware so both halves of the trace share the
 * request ids and a hanging request stays visible while in flight.
 */
export const inboundRequestLogger = (logger: Logger): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    logger.info(
      { fn: 'inboundRequestLogger', method: req.method, originalUrl: req.originalUrl, url: req.url },
      `Request started: ${req.method} ${req.originalUrl ?? req.url}`,
    );
    next();
  };
};
