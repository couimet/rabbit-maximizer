import { createExpressApp, type CreateExpressOptions } from '../../express-tools/index.js';

import { labeledExecutionContext } from './middlewares/executionContext.js';

import type { Application } from 'express';

/**
 * Creates the express app with the execution-context middleware registered
 * first, so every subsequent middleware and handler runs inside a primed
 * context. Caller-provided beforeMiddlewares run after the context middleware.
 */
export const createExpressAppWithExecutionContext = (options: Partial<CreateExpressOptions> | undefined): Application =>
  createExpressApp({
    ...options,
    beforeMiddlewares: [labeledExecutionContext(), ...(options?.beforeMiddlewares ?? [])],
  });
