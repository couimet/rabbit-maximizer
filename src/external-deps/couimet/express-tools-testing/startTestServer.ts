import { createExpressApp } from '../express-tools/index.js';

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
  /* v8 ignore next — unreachable: listen(0) on TCP socket always returns AddressInfo */
  if (!addr || typeof addr === 'string') throw new Error('Server not listening');
  return { server, port: addr.port };
};
