import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { RequestHandler } from 'express';
import type { Server } from 'http';

const { createMockLogger } = await import('../helpers/index.js');

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
  const middlewareApplyCalls = (logger.info as ReturnType<typeof jest.fn>).mock.calls.filter(
    (call: unknown[]) => (call[0] as Record<string, unknown>)?.middleware !== undefined,
  );
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
    expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/smoke 200 \d+\.\d+ ms$/));
  });

  it('replaces default middlewares entirely when a custom middlewares option is provided', async () => {
    const customHandler: RequestHandler = (_req, res, next) => {
      res.setHeader('x-custom', 'present');
      next();
    };

    const app = createExpressApp({
      logger: mockLogger,
      helmet: false,
      middlewares: { custom: customHandler },
    });
    app.get('/smoke', (_req, res) => res.send('ok'));

    server = app.listen(0);
    const headers = await getHeaders(server, '/smoke');
    expect(headers.get('x-custom')).toBe('present');
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
      middlewares: { tracking: trackingMiddleware },
    });
    app.get('/smoke', (_req, res) => {
      order.push('route');
      res.send('ok');
    });

    server = app.listen(0);
    await getBody(server, '/smoke');
    expect(order).toStrictEqual(['middleware', 'route']);
  });

  it('buildDefaultMiddlewares returns a map with the morgan entry', () => {
    const middlewares = buildDefaultMiddlewares({ logger: mockLogger });
    expect(middlewares).toHaveProperty('morgan');
    expect(typeof middlewares.morgan).toBe('function');
  });
});
