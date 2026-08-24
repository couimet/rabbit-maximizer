import { RabbitMaximizerError, RabbitMaximizerErrorCodes } from '../errors/index.js';
import { ExecutionContext } from '../external-deps/couimet/execution-context/src/index.js';
import type { EventTraceAttributes } from '../types/index.js';

export const getEventTraceAttributes = (): EventTraceAttributes => {
  const correlationId = ExecutionContext.correlationId.toString();
  const requestId = ExecutionContext.requestId.toString();

  const version = ExecutionContext.getAttribute('version');
  if (typeof version !== 'string') {
    throw new RabbitMaximizerError({
      code: RabbitMaximizerErrorCodes.MISSING_VERSION_ATTRIBUTE,
      message: 'Active execution context is missing the "version" attribute',
      functionName: 'getEventTraceAttributes',
      details: { version },
    });
  }

  return {
    correlation_id: correlationId,
    request_id: requestId,
    version,
  };
};
