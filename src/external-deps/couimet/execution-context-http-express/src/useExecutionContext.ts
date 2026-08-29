import { executionContext } from './middlewares/executionContext.js';

import type { Application } from 'express';

/**
 * Registers the execution-context middleware on an existing app. Use this when
 * building an app by hand instead of `createExpressAppWithExecutionContext`;
 * the middleware must be registered first so every other middleware and
 * handler runs inside a primed context.
 */
export const useExecutionContext = (app: Application): void => {
  app.use(executionContext());
};
