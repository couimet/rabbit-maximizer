import { createGracefulShutdown } from '../src/gracefulShutdown.js';

import { createMockLogger, drainMicrotasks } from './helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const SHUTDOWN_CHAIN_TICKS = 12;

describe('createGracefulShutdown', () => {
  let stopDetector: jest.Mock<() => Promise<void>>;
  let stopScheduler: jest.Mock<() => Promise<void>>;
  let $disconnect: jest.Mock<() => Promise<void>>;
  let prisma: PrismaClient;
  let logger: Logger;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(() => {
    stopDetector = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    stopScheduler = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    $disconnect = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    prisma = { $disconnect } as unknown as PrismaClient;
    logger = createMockLogger();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  it('chains stopDetector → stopScheduler → prisma.$disconnect → process.exit(0)', async () => {
    const shutdown = createGracefulShutdown({ stopDetector, stopScheduler, prisma, log: logger });
    shutdown();

    await drainMicrotasks(SHUTDOWN_CHAIN_TICKS);

    expect(logger.info).toHaveBeenCalledWith({ fn: 'gracefulShutdown' }, 'Shutting down');
    expect(stopDetector).toHaveBeenCalledTimes(1);
    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect($disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs warning when stopDetector fails and continues the chain', async () => {
    const error = new Error('detector crashed');
    stopDetector.mockRejectedValue(error);

    const shutdown = createGracefulShutdown({ stopDetector, stopScheduler, prisma, log: logger });
    shutdown();

    await drainMicrotasks(SHUTDOWN_CHAIN_TICKS);

    expect(logger.warn).toHaveBeenCalledWith({ fn: 'gracefulShutdown', err: error }, 'stopDetector failed during shutdown');
    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect($disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs warning when stopScheduler fails and continues the chain', async () => {
    const error = new Error('scheduler crashed');
    stopScheduler.mockRejectedValue(error);

    const shutdown = createGracefulShutdown({ stopDetector, stopScheduler, prisma, log: logger });
    shutdown();

    await drainMicrotasks(SHUTDOWN_CHAIN_TICKS);

    expect(logger.warn).toHaveBeenCalledWith({ fn: 'gracefulShutdown', err: error }, 'stopScheduler failed during shutdown');
    expect(stopDetector).toHaveBeenCalledTimes(1);
    expect($disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs warning when prisma.$disconnect fails and still calls process.exit(0)', async () => {
    const error = new Error('disconnect failed');
    $disconnect.mockRejectedValue(error);

    const shutdown = createGracefulShutdown({ stopDetector, stopScheduler, prisma, log: logger });
    shutdown();

    await drainMicrotasks(SHUTDOWN_CHAIN_TICKS);

    expect(logger.warn).toHaveBeenCalledWith({ fn: 'gracefulShutdown', err: error }, 'prisma.$disconnect failed during shutdown');
    expect(stopDetector).toHaveBeenCalledTimes(1);
    expect(stopScheduler).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
