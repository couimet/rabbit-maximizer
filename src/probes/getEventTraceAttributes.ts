import { ExecutionContext } from '../external-deps/couimet/execution-context/src/index.js';
import type { EventTraceAttributes } from '../types/index.js';

export const getEventTraceAttributes = (): EventTraceAttributes => ({
  correlation_id: ExecutionContext.correlationId.toString(),
  request_id: ExecutionContext.requestId.toString(),
  version: ExecutionContext.getAttribute('version') as string,
});
