import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createMockLogger } from '../helpers/index.js';
import { describe, expect, it } from '@jest/globals';
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
  it('returns a working Express app that routes requests and sends responses', async () => {
    const app = createExpressApp({ logger: createMockLogger() });
    app.get('/smoke', (_req, res) => {
      res.send('ok');
    });

    const server = app.listen(0);
    try {
      const body = await getBody(server, '/smoke');
      expect(body).toBe('ok');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
