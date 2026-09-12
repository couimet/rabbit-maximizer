import { withAttributes } from '../src/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { type ContextAttributes, ExecutionContext } from '@couimet/execution-context';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('withAttributes', () => {
  let correlationId: string;
  let requestId: string;

  beforeEach(() => {
    correlationId = getUniqueString();
    requestId = getUniqueString();
  });

  it('layers the attributes over the active context and removes them afterwards', () => {
    const version = getUniqueString();
    const runId = getUniqueString();

    ExecutionContext.run({ correlationId, requestId, attributes: { version } }, () => {
      const seen = withAttributes({ run_id: runId }, () => ExecutionContext.getAttributes());

      expect(seen).toStrictEqual({ version, run_id: runId });
      expect(ExecutionContext.getAttributes()).toStrictEqual({ version });
      expect(ExecutionContext.correlationId.toString()).toBe(correlationId);
      expect(ExecutionContext.requestId.toString()).toBe(requestId);
    });
  });

  it('keeps the layered attributes across an await inside the callback', async () => {
    const version = getUniqueString();
    const runId = getUniqueString();

    await ExecutionContext.run({ correlationId, requestId, attributes: { version } }, async () => {
      const seen = await withAttributes({ run_id: runId }, async () => {
        await Promise.resolve();

        return ExecutionContext.getAttributes();
      });

      expect(seen).toStrictEqual({ version, run_id: runId });
      expect(ExecutionContext.getAttributes()).toStrictEqual({ version });
    });
  });

  it('discards an attribute the callback sets itself, including one colliding with a layered key', () => {
    const runId = getUniqueString();

    ExecutionContext.run({ correlationId, requestId, attributes: { foo: 7 } }, () => {
      withAttributes({ foo: 42, run_id: runId }, () => {
        ExecutionContext.addAttributes({ extra: 'added-inside', foo: 99 });

        expect(ExecutionContext.getAttributes()).toStrictEqual({ extra: 'added-inside', foo: 99, run_id: runId });
      });

      expect(ExecutionContext.getAttributes()).toStrictEqual({ foo: 7 });
    });
  });

  it('removes the layered attributes when the callback throws', () => {
    const version = getUniqueString();

    ExecutionContext.run({ correlationId, requestId, attributes: { version } }, () => {
      expect(() =>
        withAttributes({ run_id: getUniqueString() }, () => {
          throw new Error('callback failed');
        }),
      ).toThrow('callback failed');

      expect(ExecutionContext.getAttributes()).toStrictEqual({ version });
    });
  });

  it('throws outside any run', () => {
    expect(() => withAttributes({ run_id: getUniqueString() }, () => undefined)).toThrowDetailedError('NO_ACTIVE_CONTEXT', {
      message: 'execution context is not active',
      functionName: 'ExecutionContext.requireStore',
      details: {},
    });
  });

  it('throws when the attributes are not a record', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: {} }, () => {
      expect(() => withAttributes(['not', 'a', 'record'] as unknown as ContextAttributes, () => undefined)).toThrowDetailedError('INVALID_CONTEXT_ATTRIBUTES', {
        message: 'attributes must be a record of string keys to unknown values',
        functionName: 'ExecutionContext.addAttributes',
        details: {},
      });
    });
  });
});
