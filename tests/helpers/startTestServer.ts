import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';

import type { Logger } from '@couimet/logger-contract';
import type { Application } from 'express';
import type { Server } from 'http';

export interface TestServer {
  server: Server;
  port: number;
}

export const startTestServer = (logger: Logger, register: (app: Application) => void): TestServer => {
  const app = createExpressApp({ logger });
  register(app);
  const server = app.listen(0);
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Server not listening');
  return { server, port: addr.port };
};
