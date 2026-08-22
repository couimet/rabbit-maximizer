import type { RequestHandler } from 'express';

/**
 * Pairs a middleware handler with the label used in registration logs, so
 * middlewares in the ordered arrays of `createExpressApp` can keep a
 * meaningful name while registration order stays explicit.
 */
export interface LabeledMiddleware {
  readonly label: string;
  readonly handler: RequestHandler;
}
