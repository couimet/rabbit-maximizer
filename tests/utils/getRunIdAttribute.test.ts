import { getRunIdAttribute } from '../../src/utils/index.js';
import { withTestExecutionContext } from '../external-deps/couimet/execution-context-testing/index.js';

import { getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

let correlationId: string;
let requestId: string;
let runId: string;

describe('getRunIdAttribute', () => {
  beforeEach(() => {
    correlationId = getUuid();
    requestId = getUuid();
    runId = getUuid();
  });

  it('returns the run id from the active context', () => {
    withTestExecutionContext({ correlationId, requestId, attributes: { run_id: runId } }, () => {
      expect(getRunIdAttribute()).toBe(runId);
    });
  });

  it('throws when the active context has no run_id attribute', () => {
    withTestExecutionContext({ correlationId, requestId, attributes: {} }, () => {
      expect(() => getRunIdAttribute()).toThrowDetailedError('MISSING_CONTEXT_ATTRIBUTE', {
        message: 'Active execution context is missing the attribute',
        functionName: 'getAttribute',
        details: { key: 'run_id' },
      });
    });
  });

  it('throws when the run_id attribute is blank', () => {
    const blankRunId = '   ';

    withTestExecutionContext({ correlationId, requestId, attributes: { run_id: blankRunId } }, () => {
      expect(() => getRunIdAttribute()).toThrowDetailedError('INVALID_ATTRIBUTE_VALUE', {
        message: 'Attribute value failed its validation rule',
        functionName: 'getAttribute',
        details: { key: 'run_id', value: blankRunId },
      });
    });
  });

  it('throws when the run_id attribute is not a string', () => {
    const nonStringRunId = getUniqueInt();

    withTestExecutionContext({ correlationId, requestId, attributes: { run_id: nonStringRunId } }, () => {
      expect(() => getRunIdAttribute()).toThrowDetailedError('INVALID_ATTRIBUTE_VALUE', {
        message: 'Attribute value failed its validation rule',
        functionName: 'getAttribute',
        details: { key: 'run_id', value: nonStringRunId },
      });
    });
  });

  it('throws outside any run', () => {
    expect(() => getRunIdAttribute()).toThrowDetailedError('MISSING_CONTEXT_ATTRIBUTE', {
      message: 'Active execution context is missing the attribute',
      functionName: 'getAttribute',
      details: { key: 'run_id' },
    });
  });
});
