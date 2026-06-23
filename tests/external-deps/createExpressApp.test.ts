import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createMockLogger } from '../helpers/index.js';

import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Logger } from '@couimet/logger-contract';
import type { Server } from 'http';

const getBody = (server: Server, path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      reject(new Error('Server not listening'));
      return;
    }
    const url = `http://[::1]:${addr.port}${path}`;
    fetch(url)
      .then((res) => res.text())
      .then(resolve)
      .catch(reject);
  });

describe('createExpressApp', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('returns a working Express app that routes requests and sends responses', async () => {
    const app = createExpressApp({ logger });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    const server = app.listen(0);
    try {
      const body = await getBody(server, '/smoke');
      expect(body).toBe('ok');
      expect(logger.info).toHaveBeenCalledWith({ fn: 'createExpressApp' }, 'Express app created');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('still routes requests when helmet is disabled', async () => {
    const app = createExpressApp({ logger, helmet: false });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    const server = app.listen(0);
    try {
      const body = await getBody(server, '/smoke');
      expect(body).toBe('ok');
      expect(logger.info).toHaveBeenCalledWith({ fn: 'createExpressApp' }, 'Express app created');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('works with no options and with explicit undefined values', async () => {
    const app1 = createExpressApp();
    const app2 = createExpressApp({ logger, helmet: undefined });
    // Both default to helmet: true and route requests
    app1.get('/smoke', (_req, res) => res.send('a'));
    app2.get('/smoke', (_req, res) => res.send('b'));

    const s1 = app1.listen(0);
    const s2 = app2.listen(0);
    try {
      expect(await getBody(s1, '/smoke')).toBe('a');
      expect(await getBody(s2, '/smoke')).toBe('b');
      expect(logger.info).toHaveBeenCalledWith({ fn: 'createExpressApp' }, 'Express app created');
    } finally {
      await new Promise<void>((resolve) => s1.close(() => resolve()));
      await new Promise<void>((resolve) => s2.close(() => resolve()));
    }
  });
});
