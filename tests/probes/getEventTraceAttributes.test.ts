import { ExecutionContext } from '../../src/external-deps/couimet/execution-context/src/index.js';
import { getEventTraceAttributes } from '../../src/probes/index.js';

import { getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('getEventTraceAttributes', () => {
  let correlationId: string;
  let requestId: string;
  let version: string;

  beforeEach(() => {
    correlationId = getUuid();
    requestId = getUuid();
    version = getUniqueString();
  });

  it('returns the ids and version from the active context', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: { version } }, () => {
      expect(getEventTraceAttributes()).toStrictEqual({
        correlation_id: correlationId,
        request_id: requestId,
        version,
      });
    });
  });

  it('throws when the active context has no version attribute', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: {} }, () => {
      expect(() => getEventTraceAttributes()).toThrowDetailedError('MISSING_VERSION_ATTRIBUTE', {
        message: 'Active execution context is missing the "version" attribute',
        functionName: 'getEventTraceAttributes',
        details: { version: undefined },
      });
    });
  });

  it('throws outside any run', () => {
    expect(() => getEventTraceAttributes()).toThrowDetailedError('NO_ACTIVE_CONTEXT', {
      message: 'execution context is not active',
      functionName: 'ExecutionContext.requireStore',
      details: {},
    });
  });
});
