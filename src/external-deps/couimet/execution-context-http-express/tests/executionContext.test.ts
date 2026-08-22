import { ExecutionContext } from '../../execution-context/src/index.js';
import { BLANK_VALUE, UUID_V4_PATTERN, WHITESPACE_VALUE } from '../../execution-context/tests/idTestValues.js';
import { HttpHeaders } from '../../execution-context-http/src/index.js';
import { executionContext, useExecutionContext } from '../src/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Application, NextFunction, Request, RequestHandler, Response } from 'express';

const createReqResNext = () => {
  const headerSpy = jest.fn<(name: string) => string | undefined>();
  const setHeaderSpy = jest.fn<(name: string, value: string) => void>();
  const nextSpy = jest.fn<() => void>();

  return {
    headerSpy,
    next: nextSpy as unknown as NextFunction,
    nextSpy,
    req: { header: headerSpy } as unknown as Request,
    res: { setHeader: setHeaderSpy } as unknown as Response,
    setHeaderSpy,
  };
};

describe('executionContext middleware', () => {
  let incomingCorrelationId: string;
  let incomingRequestId: string;
  let outerCorrelationId: string;
  let outerRequestId: string;
  let outerVersion: string;

  beforeEach(() => {
    incomingCorrelationId = getUniqueString({ prefix: 'incoming-correlation' });
    incomingRequestId = getUniqueString({ prefix: 'incoming-request' });
    outerCorrelationId = getUniqueString({ prefix: 'outer-correlation' });
    outerRequestId = getUniqueString({ prefix: 'outer-request' });
    outerVersion = getUniqueString({ prefix: '1.2.' });
  });

  it('uses the incoming header values and echoes them in the response', () => {
    const { headerSpy, nextSpy, setHeaderSpy, req, res, next } = createReqResNext();
    let capturedCorrelationId: string | undefined;
    let capturedRequestId: string | undefined;
    nextSpy.mockImplementation(() => {
      capturedCorrelationId = ExecutionContext.correlationId.toString();
      capturedRequestId = ExecutionContext.requestId.toString();
    });
    headerSpy.mockImplementation((name: string) => (name === HttpHeaders.CorrelationId ? incomingCorrelationId : incomingRequestId));

    executionContext()(req, res, next);

    expect(capturedCorrelationId).toBe(incomingCorrelationId);
    expect(capturedRequestId).toBe(incomingRequestId);
    expect(setHeaderSpy).toHaveBeenCalledWith(HttpHeaders.CorrelationId, incomingCorrelationId);
    expect(setHeaderSpy).toHaveBeenCalledWith(HttpHeaders.RequestId, incomingRequestId);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('generates ids when no headers are present and echoes the stored values', () => {
    const { headerSpy, nextSpy, setHeaderSpy, req, res, next } = createReqResNext();
    let capturedCorrelationId: string | undefined;
    let capturedRequestId: string | undefined;
    nextSpy.mockImplementation(() => {
      capturedCorrelationId = ExecutionContext.correlationId.toString();
      capturedRequestId = ExecutionContext.requestId.toString();
    });
    headerSpy.mockReturnValue(undefined);

    executionContext()(req, res, next);

    expect(capturedCorrelationId).toMatch(UUID_V4_PATTERN);
    expect(capturedRequestId).toMatch(UUID_V4_PATTERN);
    expect(setHeaderSpy).toHaveBeenCalledWith(HttpHeaders.CorrelationId, capturedCorrelationId);
    expect(setHeaderSpy).toHaveBeenCalledWith(HttpHeaders.RequestId, capturedRequestId);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('generates ids when the headers are blank', () => {
    const { headerSpy, nextSpy, req, res, next } = createReqResNext();
    let capturedCorrelationId: string | undefined;
    let capturedRequestId: string | undefined;
    nextSpy.mockImplementation(() => {
      capturedCorrelationId = ExecutionContext.correlationId.toString();
      capturedRequestId = ExecutionContext.requestId.toString();
    });
    headerSpy.mockImplementation((name: string) => (name === HttpHeaders.CorrelationId ? BLANK_VALUE : WHITESPACE_VALUE));

    executionContext()(req, res, next);

    expect(capturedCorrelationId).toMatch(UUID_V4_PATTERN);
    expect(capturedRequestId).toMatch(UUID_V4_PATTERN);
  });

  it('inherits outer attributes while the request ids replace the outer ids', () => {
    const { headerSpy, nextSpy, setHeaderSpy, req, res, next } = createReqResNext();
    let capturedCorrelationId: string | undefined;
    let capturedRequestId: string | undefined;
    let capturedVersion: unknown;
    nextSpy.mockImplementation(() => {
      capturedCorrelationId = ExecutionContext.correlationId.toString();
      capturedRequestId = ExecutionContext.requestId.toString();
      capturedVersion = ExecutionContext.getAttribute('version');
    });
    headerSpy.mockImplementation((name: string) => (name === HttpHeaders.CorrelationId ? incomingCorrelationId : incomingRequestId));

    ExecutionContext.run({ correlationId: outerCorrelationId, requestId: outerRequestId, attributes: { version: outerVersion } }, () => {
      executionContext()(req, res, next);
    });

    expect(capturedCorrelationId).toBe(incomingCorrelationId);
    expect(capturedRequestId).toBe(incomingRequestId);
    expect(capturedVersion).toBe(outerVersion);
    expect(setHeaderSpy).toHaveBeenCalledWith(HttpHeaders.CorrelationId, incomingCorrelationId);
    expect(setHeaderSpy).toHaveBeenCalledWith(HttpHeaders.RequestId, incomingRequestId);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('useExecutionContext registers the middleware on the app', () => {
    const useSpy = jest.fn<(handler: RequestHandler) => void>();
    const app = { use: useSpy } as unknown as Application;

    useExecutionContext(app);

    expect(useSpy).toHaveBeenCalledTimes(1);
  });
});
