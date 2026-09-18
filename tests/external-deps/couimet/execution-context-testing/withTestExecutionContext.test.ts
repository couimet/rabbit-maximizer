import { withTestExecutionContext } from './index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { ExecutionContext } from '@couimet/execution-context';
import { describe, expect, it } from '@jest/globals';

describe('withTestExecutionContext', () => {
  it('primes the context with the given attributes', () => {
    const attributeValue = getUniqueString();

    const observed = withTestExecutionContext({ attributes: { run_id: attributeValue }, correlationId: undefined, requestId: undefined }, () =>
      ExecutionContext.getAttributes(),
    );

    expect(observed).toStrictEqual({ run_id: attributeValue });
  });

  it('returns the callback result', () => {
    const result = withTestExecutionContext(undefined, () => getUniqueString());

    expect(typeof result).toBe('string');
  });

  it('generates the ids per call when the caller omits them', () => {
    const first = withTestExecutionContext(undefined, () => ExecutionContext.correlationId.toString());
    const second = withTestExecutionContext(undefined, () => ExecutionContext.correlationId.toString());

    expect(first).not.toBe(second);
  });

  it('pins the ids the caller supplies', () => {
    const correlationId = getUniqueString({ prefix: 'correlation-' });
    const requestId = getUniqueString({ prefix: 'request-' });

    const observed = withTestExecutionContext({ attributes: {}, correlationId, requestId }, () => ({
      correlationId: ExecutionContext.correlationId.toString(),
      requestId: ExecutionContext.requestId.toString(),
    }));

    expect(observed).toStrictEqual({ correlationId, requestId });
  });

  it('leaves no active context once the callback settles', () => {
    withTestExecutionContext(undefined, () => undefined);

    expect(ExecutionContext.isActive()).toBe(false);
  });
});
