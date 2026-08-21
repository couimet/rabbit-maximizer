import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { RequestHandler } from 'express';
import type { Server } from 'node:http';

const { createMockLogger } = await import('@couimet/logger-contract-testing');

const mockLogger = createMockLogger();

jest.unstable_mockModule('@couimet/logger-contract', () => ({
  getLogger: () => mockLogger,
  NoOpLogger: jest.fn(),
  setLogger: jest.fn(),
  pingLog: jest.fn(),
}));

const { createExpressApp, buildDefaultMiddlewares } = await import('../../src/external-deps/couimet/express-tools/createExpressApp.js');

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

const assertNoMiddlewareApplied = (logger: Logger) => {
  const middlewareApplyCalls = (logger.info as ReturnType<typeof jest.fn>).mock.calls.filter((call: unknown[]) => {
    const attrs = call[0] as Record<string, unknown>;
    return attrs?.middleware !== undefined || attrs?.middlewareIndex !== undefined;
  });
  expect(middlewareApplyCalls).toHaveLength(0);
};

const closeServer = (s: Server): Promise<void> => new Promise<void>((resolve) => s.close(() => resolve()));

describe('createExpressApp', () => {
  let server: Server;

  afterEach(async () => {
    if (server) {
      await closeServer(server);
    }
  });

  it('returns a working Express app that routes requests and sends responses', async () => {
    const app = createExpressApp({ logger: mockLogger });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const body = await getBody(server, '/smoke');
    expect(body).toBe('ok');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp' }, 'Express app created');

    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('still routes requests when helmet is disabled', async () => {
    const app = createExpressApp({ logger: mockLogger, helmet: false });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    server = app.listen(0);
    const body = await getBody(server, '/smoke');
    expect(body).toBe('ok');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp' }, 'Express app created');

    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-content-type-options')).toBeNull();
  });

  it('works with no options and with explicit undefined values', async () => {
    const app1 = createExpressApp();
    const app2 = createExpressApp({ logger: mockLogger, helmet: undefined });
    app1.get('/smoke', (_req, res) => res.send('a'));
    app2.get('/smoke', (_req, res) => res.send('b'));

    const s1 = app1.listen(0);
    const s2 = app2.listen(0);
    try {
      expect(await getBody(s1, '/smoke')).toBe('a');
      expect(await getBody(s2, '/smoke')).toBe('b');
      expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp' }, 'Express app created');
    } finally {
      await closeServer(s1);
      await closeServer(s2);
    }
  });

  it('applies default middlewares when no middlewares option is provided', async () => {
    const app = createExpressApp({ logger: mockLogger, helmet: false });
    app.get('/smoke', (_req, res) => res.send('ok'));

    server = app.listen(0);
    const body = await getBody(server, '/smoke');
    expect(body).toBe('ok');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { fn: 'inboundRequestLogger', method: 'GET', originalUrl: '/smoke', url: '/smoke' },
      'Request started: GET /smoke',
    );
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/smoke 200 \d+\.\d+ ms$/));
  });

  it('replaces default middlewares entirely when a custom middlewares array is provided', async () => {
    const customHandler: RequestHandler = (_req, res, next) => {
      res.setHeader('x-custom', 'present');
      next();
    };

    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      middlewares: [{ label: 'custom', handler: customHandler }],
    });
    app.get('/smoke', (_req, res) => res.send('ok'));

    server = app.listen(0);
    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-custom')).toBe('present');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middleware: 'custom', middlewareIndex: 0 }, 'Applying middleware');
    const morganApplyCalls = (mockLogger.info as ReturnType<typeof jest.fn>).mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>)?.middleware === 'morgan',
    );
    expect(morganApplyCalls).toHaveLength(0);
  });

  it('applies no middleware when middlewares is explicitly undefined', async () => {
    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      middlewares: undefined,
    });
    app.get('/smoke', (_req, res) => res.send('ok'));

    server = app.listen(0);
    const body = await getBody(server, '/smoke');
    expect(body).toBe('ok');
    assertNoMiddlewareApplied(mockLogger);
  });

  it('applies middleware before routes so middleware runs on every request', async () => {
    const order: string[] = [];
    const trackingMiddleware: RequestHandler = (_req, _res, next) => {
      order.push('middleware');
      next();
    };

    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      middlewares: [trackingMiddleware],
    });
    app.get('/smoke', (_req, res) => {
      order.push('route');
      res.send('ok');
    });

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(order).toStrictEqual(['middleware', 'route']);
  });

  it('runs beforeMiddlewares before helmet and the middlewares array', async () => {
    const order: string[] = [];
    const beforeMiddleware: RequestHandler = (_req, _res, next) => {
      order.push('before');
      next();
    };
    const mapMiddleware: RequestHandler = (_req, _res, next) => {
      order.push('map');
      next();
    };

    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      beforeMiddlewares: [beforeMiddleware],
      middlewares: [mapMiddleware],
    });
    app.get('/smoke', (_req, res) => {
      order.push('route');
      res.send('ok');
    });

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(order).toStrictEqual(['before', 'map', 'route']);
  });

  it('buildDefaultMiddlewares returns labeled entries for the inbound logger and morgan', () => {
    const middlewares = buildDefaultMiddlewares({ logger: mockLogger });
    expect(middlewares.map((m) => ('label' in m ? m.label : undefined))).toStrictEqual(['inbound-request-logger', 'morgan']);
    expect(middlewares.every((m) => 'label' in m && typeof m.handler === 'function')).toBe(true);
  });

  it('registers middlewares in array order and logs unlabeled entries with their index', async () => {
    const order: string[] = [];
    const first: RequestHandler = (_req, _res, next) => {
      order.push('first');
      next();
    };
    const second: RequestHandler = (_req, _res, next) => {
      order.push('second');
      next();
    };

    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      middlewares: [first, second],
    });
    app.get('/smoke', (_req, res) => res.send('ok'));

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(order).toStrictEqual(['first', 'second']);
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middlewareIndex: 0 }, 'Applying middleware without a name (index 0)');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middlewareIndex: 1 }, 'Applying middleware without a name (index 1)');
  });

  it('logs labeled beforeMiddlewares entries at registration', async () => {
    const beforeMiddleware: RequestHandler = (_req, _res, next) => next();

    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      beforeMiddlewares: [{ label: 'prime', handler: beforeMiddleware }],
    });
    app.get('/smoke', (_req, res) => res.send('ok'));

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'createExpressApp', middleware: 'prime', middlewareIndex: 0 }, 'Applying middleware');
  });
});
