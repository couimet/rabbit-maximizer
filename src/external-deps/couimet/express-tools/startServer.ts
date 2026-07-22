import { ExpressToolsErrorCodes } from './ExpressToolsErrorCodes.js';

import { DetailedError } from '@couimet/detailed-error';
import type { Application } from 'express';
import type { Server } from 'node:http';
import { createServer } from 'node:http';

export interface StartServerResult {
  port: number;
  server: Server;
}

/** Starts listening on the given port. Resolves when the server is bound; rejects on EADDRINUSE or other errors. */
export const startServer = (app: Application, port: number): Promise<StartServerResult> =>
  new Promise((resolve, reject) => {
    const server = createServer(app);

    server.on('error', (err: NodeJS.ErrnoException) => {
      reject(
        new DetailedError({
          code: ExpressToolsErrorCodes.SERVER_LISTEN_FAILED,
          message: `Failed to start server on port ${port}`,
          functionName: 'startServer',
          details: { port, originalCode: err.code },
          cause: err,
        }),
      );
    });

    server.on('listening', () => {
      resolve({ port: (server.address() as { port: number }).port, server });
    });

    try {
      server.listen(port);
    } catch (err: unknown) {
      const originalCode = typeof err === 'object' && err !== null && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;

      reject(
        new DetailedError({
          code: ExpressToolsErrorCodes.SERVER_LISTEN_FAILED,
          message: `Failed to start server on port ${port}`,
          functionName: 'startServer',
          details: { port, originalCode },
          cause: err,
        }),
      );
    }
  });
