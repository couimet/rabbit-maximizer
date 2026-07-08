import { describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';

const { createMockLogger } = await import('@couimet/logger-contract-testing');

const mockLogger = createMockLogger();

jest.unstable_mockModule('@couimet/logger-contract', () => ({
  getLogger: () => mockLogger,
}));

const { createMorganMiddleware, MORGAN_DEFAULT_FORMAT } = await import('../../src/external-deps/couimet/express-tools/createMorganMiddleware.js');

const { MiddlewareIdentifier } = await import('../../src/external-deps/couimet/express-tools/middlewareIdentifiers.js');

const { default: express } = await import('express');

const fetchStatus = (server: Server, path: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      reject(new Error('Server not listening'));
      return;
    }
    fetch(`http://[::1]:${addr.port}${path}`)
      .then((res) => resolve(res.status))
      .catch(reject);
  });

describe('createMorganMiddleware', () => {
  const startWithMiddleware = (middleware: ReturnType<typeof createMorganMiddleware>) => {
    const app = express();
    app.use(middleware);
    app.get('/test', (_req: any, res: any) => res.send('ok'));
    const server = app.listen(0);
    return server;
  };

  it('has the expected middleware identifier value for MORGAN', () => {
    expect(MiddlewareIdentifier.MORGAN).toBe('morgan');
  });

  it('has the expected default format', () => {
    expect(MORGAN_DEFAULT_FORMAT).toBe(':method :url :status :response-time ms');
  });

  it('logs requests with the default format', async () => {
    const logger = createMockLogger();
    const middleware = createMorganMiddleware({ logger });
    const server = startWithMiddleware(middleware);
    try {
      await fetchStatus(server, '/test');
      expect(logger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/test 200 \d+\.\d+ ms$/));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('uses a custom format when provided', async () => {
    const logger = createMockLogger();
    const middleware = createMorganMiddleware({ format: ':method :url', logger });
    const server = startWithMiddleware(middleware);
    try {
      await fetchStatus(server, '/test');
      expect(logger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/test$/));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('uses all defaults when called with no arguments', async () => {
    const middleware = createMorganMiddleware();
    const server = startWithMiddleware(middleware);
    try {
      await fetchStatus(server, '/test');
      expect(mockLogger.info).toHaveBeenCalledWith({ fn: 'http.request' }, expect.stringMatching(/^GET \/test 200 \d+\.\d+ ms$/));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
