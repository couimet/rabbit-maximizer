import { EXECUTION_CONTEXT_ATTRIBUTES } from '../domain.js';
import { getAttribute } from '../external-deps/couimet/execution-context/src/index.js';
import type { EventTraceAttributes } from '../types/index.js';

import { ExecutionContext } from '@couimet/execution-context';

export const getEventTraceAttributes = (): EventTraceAttributes => ({
  correlation_id: ExecutionContext.correlationId.toString(),
  request_id: ExecutionContext.requestId.toString(),
  version: getAttribute(EXECUTION_CONTEXT_ATTRIBUTES.version),
});
