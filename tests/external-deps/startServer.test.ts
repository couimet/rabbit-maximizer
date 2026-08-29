import { startServer } from '../../src/external-deps/couimet/express-tools/index.js';

import { DetailedError } from '@couimet/detailed-error';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';

describe('startServer', () => {
  let stop: () => Promise<void>;

  beforeEach(() => {
    stop = async () => {};
  });

  afterEach(async () => {
    await stop();
  });

  it('resolves with the bound port and server', async () => {
    const app = express();
    const result = await startServer(app, 0);

    stop = () => new Promise<void>((resolve, reject) => result.server.close((err) => (err ? reject(err) : resolve())));

    expect(result.port).toBeGreaterThan(0);
    expect(result.server.listening).toBe(true);
  });

  it('rejects with SERVER_LISTEN_FAILED when port is already taken', async () => {
    const app1 = express();
    const result1 = await startServer(app1, 0);
    stop = () => new Promise<void>((resolve, reject) => result1.server.close((err) => (err ? reject(err) : resolve())));

    const app2 = express();
    const error = (await startServer(app2, result1.port).catch((e: unknown) => e)) as DetailedError<string>;

    expect(error).toBeDetailedError('SERVER_LISTEN_FAILED', {
      message: `Failed to start server on port ${result1.port}`,
      functionName: 'startServer',
      details: { port: result1.port, originalCode: 'EADDRINUSE' },
      cause: expect.any(Object),
    });
    expect((error.cause as NodeJS.ErrnoException).code).toBe('EADDRINUSE');
  });

  it('rejects with SERVER_LISTEN_FAILED when port is invalid', async () => {
    const app = express();
    const error = (await startServer(app, -1).catch((e: unknown) => e)) as DetailedError<string>;

    expect(error).toBeDetailedError('SERVER_LISTEN_FAILED', {
      message: 'Failed to start server on port -1',
      functionName: 'startServer',
      details: { port: -1, originalCode: 'ERR_SOCKET_BAD_PORT' },
      cause: expect.any(Object),
    });
    expect((error.cause as NodeJS.ErrnoException).code).toBe('ERR_SOCKET_BAD_PORT');
  });
});
