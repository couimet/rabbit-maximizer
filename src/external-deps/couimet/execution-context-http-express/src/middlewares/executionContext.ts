import { CorrelationId, ExecutionContext, RequestId } from '../../../execution-context/src/index.js';
import { HttpHeaders } from '../../../execution-context-http/src/index.js';
import type { LabeledMiddleware } from '../../../express-tools/index.js';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Must be the first middleware on the app so every subsequent middleware and
 * handler runs inside a primed context. Header values are trusted (internal
 * boundary) and echoed back in the response; blank or missing headers fall
 * back to generated ids. The ids are pre-resolved so the echoed headers carry
 * exactly the values the store holds and a blank header cannot crash the
 * handler.
 */
export const executionContext = (): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = CorrelationId.fromStringOrCreate(req.header(HttpHeaders.CorrelationId)).toString();
    const requestId = RequestId.fromStringOrCreate(req.header(HttpHeaders.RequestId)).toString();

    ExecutionContext.run({ correlationId, requestId, attributes: ExecutionContext.getAttributes() }, () => {
      res.setHeader(HttpHeaders.CorrelationId, correlationId);
      res.setHeader(HttpHeaders.RequestId, requestId);

      next();
    });
  };
};

/**
 * Labeled variant of {@link executionContext} for the ordered middleware
 * arrays of `createExpressApp`, so the registration log carries a meaningful
 * name for the context middleware.
 */
export const labeledExecutionContext = (): LabeledMiddleware => ({
  label: 'execution-context',
  handler: executionContext(),
});
