import { createGracefulShutdown } from '../src/gracefulShutdown.js';

import { createMockLogger } from './helpers/index.js';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';

describe('createGracefulShutdown', () => {
  const exit = process.exit;

  beforeEach(() => {
    process.exit = jest.fn<typeof process.exit>() as any;
  });

  afterEach(() => {
    process.exit = exit;
  });

  it('logs shutdown and stops all services in order', async () => {
    const order: string[] = [];
    const deps = {
      stopDetector: jest.fn<any>().mockImplementation(() => {
        order.push('detector');
        return Promise.resolve();
      }),
      stopScheduler: jest.fn<any>().mockImplementation(() => {
        order.push('scheduler');
        return Promise.resolve();
      }),
      stopServer: jest.fn<any>().mockImplementation(() => {
        order.push('server');
        return Promise.resolve();
      }),
      prisma: {
        $disconnect: jest.fn<any>().mockImplementation(() => {
          order.push('prisma');
          return Promise.resolve();
        }),
      } as unknown as PrismaClient,
      log: createMockLogger(),
    };

    const shutdown = createGracefulShutdown(deps);
    shutdown();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.log.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'gracefulShutdown' }, 'Shutting down');
    expect(order).toStrictEqual(['detector', 'scheduler', 'server', 'prisma']);
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('logs warning when stopDetector fails and continues chain', async () => {
    const err = new Error('detector crash');
    const deps = {
      stopDetector: jest.fn<any>().mockRejectedValue(err),
      stopScheduler: jest.fn<any>().mockResolvedValue(undefined),
      stopServer: jest.fn<any>().mockResolvedValue(undefined),
      prisma: { $disconnect: jest.fn<any>().mockResolvedValue(undefined) } as unknown as PrismaClient,
      log: createMockLogger(),
    };

    const shutdown = createGracefulShutdown(deps);
    shutdown();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.log.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'gracefulShutdown', error: err }, 'stopDetector failed during shutdown');
    expect(deps.stopScheduler).toHaveBeenCalled();
    expect(deps.prisma.$disconnect).toHaveBeenCalled();
  });

  it('logs warning when stopScheduler fails and continues chain', async () => {
    const err = new Error('scheduler crash');
    const deps = {
      stopDetector: jest.fn<any>().mockResolvedValue(undefined),
      stopScheduler: jest.fn<any>().mockRejectedValue(err),
      stopServer: jest.fn<any>().mockResolvedValue(undefined),
      prisma: { $disconnect: jest.fn<any>().mockResolvedValue(undefined) } as unknown as PrismaClient,
      log: createMockLogger(),
    };

    const shutdown = createGracefulShutdown(deps);
    shutdown();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.log.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'gracefulShutdown', error: err }, 'stopScheduler failed during shutdown');
    expect(deps.prisma.$disconnect).toHaveBeenCalled();
  });

  it('skips stopServer when undefined', async () => {
    const deps = {
      stopDetector: jest.fn<any>().mockResolvedValue(undefined),
      stopScheduler: jest.fn<any>().mockResolvedValue(undefined),
      prisma: { $disconnect: jest.fn<any>().mockResolvedValue(undefined) } as unknown as PrismaClient,
      log: createMockLogger(),
    };

    const shutdown = createGracefulShutdown(deps);
    shutdown();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.prisma.$disconnect).toHaveBeenCalled();
  });

  it('logs warning when stopServer fails and continues', async () => {
    const err = new Error('server crash');
    const deps = {
      stopDetector: jest.fn<any>().mockResolvedValue(undefined),
      stopScheduler: jest.fn<any>().mockResolvedValue(undefined),
      stopServer: jest.fn<any>().mockRejectedValue(err),
      prisma: { $disconnect: jest.fn<any>().mockResolvedValue(undefined) } as unknown as PrismaClient,
      log: createMockLogger(),
    };

    const shutdown = createGracefulShutdown(deps);
    shutdown();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.log.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'gracefulShutdown', error: err }, 'stopServer failed during shutdown');
    expect(deps.prisma.$disconnect).toHaveBeenCalled();
  });

  it('logs warning when prisma.$disconnect fails', async () => {
    const err = new Error('prisma crash');
    const deps = {
      stopDetector: jest.fn<any>().mockResolvedValue(undefined),
      stopScheduler: jest.fn<any>().mockResolvedValue(undefined),
      prisma: { $disconnect: jest.fn<any>().mockRejectedValue(err) } as unknown as PrismaClient,
      log: createMockLogger(),
    };

    const shutdown = createGracefulShutdown(deps);
    shutdown();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(deps.log.warn as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'gracefulShutdown', error: err }, 'prisma.$disconnect failed during shutdown');
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
