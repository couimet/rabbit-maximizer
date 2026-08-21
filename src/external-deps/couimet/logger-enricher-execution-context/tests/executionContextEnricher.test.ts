import { ExecutionContext } from '../../execution-context/src/index.js';
import { executionContextEnricher } from '../src/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import type { LoggingContext } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('executionContextEnricher', () => {
  let addedAttributes: Record<string, string>;
  let callerContext: LoggingContext;
  let callerCorrelationId: string;
  let callerRequestId: string;
  let callerVersion: string;
  let correlationId: string;
  let idLikeAttributes: Record<string, string>;
  let requestId: string;
  let storedAttributes: Record<string, string>;

  beforeEach(() => {
    addedAttributes = { feature: getUniqueString({ prefix: 'feature' }) };
    callerContext = { fn: getUniqueString({ prefix: 'fn' }) };
    callerCorrelationId = getUniqueString({ prefix: 'caller-correlation' });
    callerRequestId = getUniqueString({ prefix: 'caller-request' });
    callerVersion = getUniqueString({ prefix: '0.9.' });
    correlationId = getUniqueString({ prefix: 'correlation' });
    idLikeAttributes = {
      correlation_id: getUniqueString({ prefix: 'id-correlation' }),
      request_id: getUniqueString({ prefix: 'id-request' }),
    };
    requestId = getUniqueString({ prefix: 'request' });
    storedAttributes = { version: getUniqueString({ prefix: '1.0.' }) };
  });

  it('merges stored attributes, caller context, and the ids in order', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: storedAttributes }, () => {
      expect(executionContextEnricher.enrich(callerContext)).toStrictEqual({
        ...storedAttributes,
        ...callerContext,
        correlation_id: correlationId,
        request_id: requestId,
      });
    });
  });

  it('lets the ids win over caller-provided values', () => {
    ExecutionContext.run({ correlationId, requestId }, () => {
      const enriched = executionContextEnricher.enrich({
        ...callerContext,
        correlation_id: callerCorrelationId,
        request_id: callerRequestId,
      });

      expect(enriched).toStrictEqual({
        ...callerContext,
        correlation_id: correlationId,
        request_id: requestId,
      });
    });
  });

  it('ignores attributes named like the ids', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: idLikeAttributes }, () => {
      expect(executionContextEnricher.enrich(callerContext)).toStrictEqual({
        ...callerContext,
        correlation_id: correlationId,
        request_id: requestId,
      });
    });
  });

  it('lets the caller context win over stored attributes', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: storedAttributes }, () => {
      const enriched = executionContextEnricher.enrich({ ...callerContext, version: callerVersion });

      expect(enriched).toStrictEqual({
        ...callerContext,
        version: callerVersion,
        correlation_id: correlationId,
        request_id: requestId,
      });
    });
  });

  it('includes attributes added to the context after it started', () => {
    ExecutionContext.run({ correlationId, requestId, attributes: storedAttributes }, () => {
      ExecutionContext.addAttributes(addedAttributes);

      expect(executionContextEnricher.enrich(callerContext)).toStrictEqual({
        ...storedAttributes,
        ...addedAttributes,
        ...callerContext,
        correlation_id: correlationId,
        request_id: requestId,
      });
    });
  });

  it('passes the caller context through unchanged outside any run', () => {
    const context: LoggingContext = {
      ...callerContext,
      correlation_id: callerCorrelationId,
      request_id: callerRequestId,
    };

    expect(executionContextEnricher.enrich(context)).toStrictEqual(context);
  });

  it('adds no id keys outside any run', () => {
    expect(executionContextEnricher.enrich(callerContext)).toStrictEqual(callerContext);
  });
});
