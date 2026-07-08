import type { SystemStateRepository } from '../../src/db/systemStateRepository.js';
import { createExpressApp } from '../../src/external-deps/couimet/express-tools/createExpressApp.js';
import { createSetPausedHandler } from '../../src/routes/setPaused.js';
import { createMockLogger, createMockSystemStateRepository } from '../helpers/index.js';
import { postJson } from '../helpers/postJson.js';

import type { Logger } from '@couimet/logger-contract';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import type { Server } from 'http';
import { StatusCodes } from 'http-status-codes';

describe('setPaused', () => {
  let logger: Logger;
  let server: Server;

  afterEach(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  const startServer = (systemStateRepoOver: Partial<jest.Mocked<SystemStateRepository>> = {}) => {
    logger = createMockLogger();
    const app = createExpressApp({ logger });
    app.use(express.json());
    app.post('/api/pause', createSetPausedHandler(createMockSystemStateRepository(systemStateRepoOver), logger));
    server = app.listen(0);
  };

  it('sets paused to true', async () => {
    const pauseScheduler = jest.fn<any>();
    startServer({ pauseScheduler });

    const res = await postJson(server, '/api/pause', { paused: true });
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({ paused: true });
    expect(pauseScheduler).toHaveBeenCalledWith();
  });

  it('sets paused to false', async () => {
    const resumeScheduler = jest.fn<any>();
    startServer({ resumeScheduler });

    const res = await postJson(server, '/api/pause', { paused: false });
    expect(res.status).toBe(StatusCodes.OK);
    expect(await res.json()).toStrictEqual({ paused: false });
    expect(resumeScheduler).toHaveBeenCalledWith();
  });

  it('returns 400 for non-boolean paused (string)', async () => {
    startServer();

    const res = await postJson(server, '/api/pause', { paused: 'yes' });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'paused must be a boolean' });
  });

  it('returns 400 for non-boolean paused (number)', async () => {
    startServer();

    const res = await postJson(server, '/api/pause', { paused: 1 });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'paused must be a boolean' });
  });

  it('returns 400 for missing paused', async () => {
    startServer();

    const res = await postJson(server, '/api/pause', {});
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'paused must be a boolean' });
  });

  it('returns 400 for null paused', async () => {
    startServer();

    const res = await postJson(server, '/api/pause', { paused: null });
    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(await res.json()).toStrictEqual({ error: 'paused must be a boolean' });
  });

  it('returns 500 and logs error on pauseScheduler rejection', async () => {
    const repoError = new Error('DB down');
    const pauseScheduler = jest.fn<any>().mockRejectedValue(repoError);
    startServer({ pauseScheduler });

    const res = await postJson(server, '/api/pause', { paused: true });
    expect(res.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(await res.json()).toStrictEqual({ error: 'Failed to set pause state' });
    expect(logger.error as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'api.pause', error: repoError }, 'Failed to set pause state');
  });
});
