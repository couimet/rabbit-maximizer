import { ExpressToolsErrorCodes } from './ExpressToolsErrorCodes.js';

import { DetailedError } from '@couimet/detailed-error';
import type { Application } from 'express';
import { createServer, type Server } from 'node:http';

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
      const originalCode = (err as NodeJS.ErrnoException).code;

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
