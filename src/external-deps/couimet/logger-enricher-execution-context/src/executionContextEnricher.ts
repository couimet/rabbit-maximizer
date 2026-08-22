import { ExecutionContext } from '../../execution-context/src/index.js';
import type { LoggerEnricher } from '../../logger-enricher-contract/src/index.js';

import type { LoggingContext } from '@couimet/logger-contract';

const CORRELATION_ID_KEY = 'correlation_id';
const REQUEST_ID_KEY = 'request_id';

/**
 * Execution-context attributes, then the caller's context, then the ids
 * override both.
 */
export const executionContextEnricher: LoggerEnricher = {
  enrich(context: LoggingContext): LoggingContext {
    if (!ExecutionContext.isActive()) return context;

    return {
      ...ExecutionContext.getAttributes(),
      ...context,
      [CORRELATION_ID_KEY]: ExecutionContext.correlationId.toString(),
      [REQUEST_ID_KEY]: ExecutionContext.requestId.toString(),
    };
  },
};
