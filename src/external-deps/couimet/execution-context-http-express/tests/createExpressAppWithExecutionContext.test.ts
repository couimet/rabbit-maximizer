import { ExecutionContext } from '../../execution-context/src/index.js';
import { createExpressAppWithExecutionContext } from '../src/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { RequestHandler } from 'express';
import type { Server } from 'node:http';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mockLogger = createMockLogger();

const getBody = (server: Server, path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      reject(new Error('Server not listening'));
      return;
    }
    fetch(`http://[::1]:${addr.port}${path}`)
      .then((res) => res.text())
      .then(resolve)
      .catch(reject);
  });

const getHeaders = (server: Server, path: string): Promise<Headers> =>
  new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      reject(new Error('Server not listening'));
      return;
    }
    fetch(`http://[::1]:${addr.port}${path}`)
      .then((res) => resolve(res.headers))
      .catch(reject);
  });

const getHeadersWith = (server: Server, path: string, requestHeaders: Record<string, string>): Promise<Headers> =>
  new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      reject(new Error('Server not listening'));
      return;
    }
    fetch(`http://[::1]:${addr.port}${path}`, { headers: requestHeaders })
      .then((res) => resolve(res.headers))
      .catch(reject);
  });

const closeServer = (s: Server): Promise<void> => new Promise<void>((resolve) => s.close(() => resolve()));

describe('createExpressAppWithExecutionContext', () => {
  let incomingCorrelationId: string;
  let server: Server;

  beforeEach(() => {
    incomingCorrelationId = getUniqueString({ prefix: 'incoming-correlation' });
  });

  afterEach(async () => {
    if (server) {
      await closeServer(server);
    }
  });

  it('carries correlation and request ids on every response', async () => {
    const app = createExpressAppWithExecutionContext({ logger: mockLogger, helmet: false });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-correlation-id')).not.toBeNull();
    expect(headers.get('x-request-id')).not.toBeNull();
  });

  it('echoes an incoming x-correlation-id header on the response', async () => {
    const app = createExpressAppWithExecutionContext({ logger: mockLogger, helmet: false });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const headers = await getHeadersWith(server, '/smoke', { 'x-correlation-id': incomingCorrelationId });
    expect(headers.get('x-correlation-id')).toBe(incomingCorrelationId);
    expect(headers.get('x-request-id')).not.toBeNull();
  });

  it('gives each request a distinct request id', async () => {
    const app = createExpressAppWithExecutionContext({ logger: mockLogger, helmet: false });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const first = await getHeaders(server, '/smoke');
    const second = await getHeaders(server, '/smoke');
    expect(first.get('x-request-id')).not.toBeNull();
    expect(second.get('x-request-id')).not.toBeNull();
    expect(first.get('x-request-id')).not.toBe(second.get('x-request-id'));
  });

  it('works without options and still primes requests', async () => {
    const app = createExpressAppWithExecutionContext(undefined);
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-correlation-id')).not.toBeNull();
    expect(headers.get('x-request-id')).not.toBeNull();
  });

  it('runs the execution-context middleware before caller-provided beforeMiddlewares and the middlewares array', async () => {
    const order: string[] = [];
    let capturedCorrelationId: string | undefined;
    const customBefore: RequestHandler = (_req, _res, next) => {
      capturedCorrelationId = ExecutionContext.correlationId.toString();
      order.push('before');
      next();
    };
    const arrayMiddleware: RequestHandler = (_req, _res, next) => {
      order.push('array');
      next();
    };

    const app = createExpressAppWithExecutionContext({
      logger: mockLogger,
      helmet: false,
      beforeMiddlewares: [customBefore],
      middlewares: [arrayMiddleware],
    });
    app.get('/smoke', (_req, res) => {
      order.push('route');
      res.send('ok');
    });

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(order).toStrictEqual(['before', 'array', 'route']);
    expect(capturedCorrelationId).toMatch(UUID_V4_PATTERN);
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middleware: 'execution-context', middlewareIndex: 0 }, 'Applying middleware');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middlewareIndex: 1 }, 'Applying middleware without a name (index 1)');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middlewareIndex: 0 }, 'Applying middleware without a name (index 0)');
  });

  it('keeps the context middleware when the middlewares array is replaced', async () => {
    const customHandler: RequestHandler = (_req, res, next) => {
      res.setHeader('x-custom', 'present');
      next();
    };

    const app = createExpressAppWithExecutionContext({
      logger: mockLogger,
      helmet: false,
      middlewares: [customHandler],
    });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-custom')).toBe('present');
    expect(headers.get('x-correlation-id')).not.toBeNull();
    expect(headers.get('x-request-id')).not.toBeNull();
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middleware: 'execution-context', middlewareIndex: 0 }, 'Applying middleware');
  });

  it('applies the default middlewares so the request trace is logged', async () => {
    const app = createExpressAppWithExecutionContext({ logger: mockLogger, helmet: false });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { fn: 'inboundRequestLogger', method: 'GET', originalUrl: '/smoke', url: '/smoke' },
      'Request started: GET /smoke',
    );
  });
});
