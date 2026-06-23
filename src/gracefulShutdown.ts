import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';

interface ShutdownDeps {
  stopDetector(): Promise<void>;
  stopScheduler(): Promise<void>;
  prisma: PrismaClient;
  log: Logger;
}

const createGracefulShutdown =
  ({ stopDetector, stopScheduler, prisma, log }: ShutdownDeps) =>
  () => {
    log.info({ fn: 'gracefulShutdown' }, 'Shutting down');
    void stopDetector()
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', err }, 'stopDetector failed during shutdown');
      })
      .then(() => stopScheduler())
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', err }, 'stopScheduler failed during shutdown');
      })
      .then(() => prisma.$disconnect())
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', err }, 'prisma.$disconnect failed during shutdown');
      })
      .finally(() => {
        process.exit(0);
      });
  };

export { createGracefulShutdown };
