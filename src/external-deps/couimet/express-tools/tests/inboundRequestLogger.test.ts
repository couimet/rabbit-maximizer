import { inboundRequestLogger } from '../middlewares/inboundRequestLogger.js';
import { useInboundRequestLogger } from '../useInboundRequestLogger.js';

import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it, jest } from '@jest/globals';
import type { Application, NextFunction, Request, RequestHandler, Response } from 'express';

const METHOD = 'GET';
const ORIGINAL_URL = '/api/summary?duration=24h';
const URL_VALUE = '/api/summary?duration=24h';
const LOG_MESSAGE = `Request started: ${METHOD} ${ORIGINAL_URL}`;

const createReqResNext = (originalUrl: string | undefined, url: string) => {
  const nextSpy = jest.fn<() => void>();

  return {
    next: nextSpy as unknown as NextFunction,
    nextSpy,
    req: { method: METHOD, originalUrl, url } as unknown as Request,
    res: {} as unknown as Response,
  };
};

describe('inboundRequestLogger', () => {
  it('logs the request start with method and urls, then calls next', () => {
    const log = createMockLogger();
    const { nextSpy, req, res, next } = createReqResNext(ORIGINAL_URL, URL_VALUE);

    inboundRequestLogger(log)(req, res, next);

    expect(log.info).toHaveBeenCalledWith({ fn: 'inboundRequestLogger', method: METHOD, originalUrl: ORIGINAL_URL, url: URL_VALUE }, LOG_MESSAGE);
    expect(nextSpy).toHaveBeenCalled();
  });

  it('falls back to url in the message when originalUrl is absent', () => {
    const log = createMockLogger();
    const { nextSpy, req, res, next } = createReqResNext(undefined, URL_VALUE);

    inboundRequestLogger(log)(req, res, next);

    expect(log.info).toHaveBeenCalledWith(
      { fn: 'inboundRequestLogger', method: METHOD, originalUrl: undefined, url: URL_VALUE },
      `Request started: ${METHOD} ${URL_VALUE}`,
    );
    expect(nextSpy).toHaveBeenCalled();
  });

  it('registers the middleware on the app', () => {
    const useSpy = jest.fn<(handler: RequestHandler) => void>();
    const app = { use: useSpy } as unknown as Application;
    const log = createMockLogger();

    useInboundRequestLogger(app, log as unknown as Logger);

    expect(useSpy).toHaveBeenCalledTimes(1);
  });
});
