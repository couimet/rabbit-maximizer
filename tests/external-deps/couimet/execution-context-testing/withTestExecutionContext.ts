import { getUniqueString } from '@couimet/dynamic-testing';
import { ExecutionContext, type RunParams } from '@couimet/execution-context';

/**
 * Runs `fn` inside a fresh execution context.
 *
 * Pass `undefined` to let the helper generate the trace ids. Pass a `RunParams` to pin the
 * ids a test asserts against. Any id the caller omits is generated, so a test that only
 * cares about the attributes passes `undefined` and never asserts a fixed pair.
 */
export const withTestExecutionContext = <T>(params: RunParams | undefined, fn: () => T): T =>
  ExecutionContext.run(
    {
      correlationId: params?.correlationId ?? getUniqueString({ prefix: 'correlation-' }),
      requestId: params?.requestId ?? getUniqueString({ prefix: 'request-' }),
      attributes: params?.attributes ?? {},
    },
    fn,
  );
