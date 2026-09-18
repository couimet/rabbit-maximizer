import { getEventTraceAttributes } from '../../src/probes/index.js';
import { withTestExecutionContext } from '../external-deps/couimet/execution-context-testing/index.js';

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
    withTestExecutionContext({ correlationId, requestId, attributes: { version } }, () => {
      expect(getEventTraceAttributes()).toStrictEqual({
        correlation_id: correlationId,
        request_id: requestId,
        version,
      });
    });
  });

  it('throws when the active context has no version attribute', () => {
    withTestExecutionContext({ correlationId, requestId, attributes: {} }, () => {
      expect(() => getEventTraceAttributes()).toThrowDetailedError('MISSING_CONTEXT_ATTRIBUTE', {
        message: 'Active execution context is missing the attribute',
        functionName: 'getAttribute',
        details: { key: 'version' },
      });
    });
  });

  it('throws when the version attribute is blank', () => {
    const blankVersion = '   ';

    withTestExecutionContext({ correlationId, requestId, attributes: { version: blankVersion } }, () => {
      expect(() => getEventTraceAttributes()).toThrowDetailedError('INVALID_ATTRIBUTE_VALUE', {
        message: 'Attribute value failed its validation rule',
        functionName: 'getAttribute',
        details: { key: 'version', value: blankVersion },
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
