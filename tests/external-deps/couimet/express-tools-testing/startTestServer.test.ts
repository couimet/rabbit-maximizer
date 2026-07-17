import { startTestServer } from '../../../../src/external-deps/couimet/express-tools-testing/startTestServer.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'http';

describe('startTestServer', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  });

  it('creates an Express app, calls register, and returns the server and port', () => {
    const logger = createMockLogger();
    const register = jest.fn();

    const { server, port } = startTestServer(logger, register);
    servers.push(server);

    expect(register).toHaveBeenCalledWith(expect.any(Function));
    expect(port).toEqual(expect.any(Number));
    expect(port).toBeGreaterThan(0);
  });
});
