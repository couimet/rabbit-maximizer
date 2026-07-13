import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';

interface ShutdownDeps {
  stopDetector(): Promise<void>;
  stopReviewDetector(): Promise<void>;
  stopScheduler(): Promise<void>;
  stopServer?(): Promise<void>;
  prisma: PrismaClient;
  log: Logger;
}

const createGracefulShutdown =
  ({ stopDetector, stopReviewDetector, stopScheduler, stopServer, prisma, log }: ShutdownDeps) =>
  () => {
    log.info({ fn: 'gracefulShutdown' }, 'Shutting down');
    void stopDetector()
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', error: err }, 'stopDetector failed during shutdown');
      })
      .then(() => stopReviewDetector())
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', error: err }, 'stopReviewDetector failed during shutdown');
      })
      .then(() => stopScheduler())
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', error: err }, 'stopScheduler failed during shutdown');
      })
      .then(() => stopServer?.())
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', error: err }, 'stopServer failed during shutdown');
      })
      .then(() => prisma.$disconnect())
      .catch((err) => {
        log.warn({ fn: 'gracefulShutdown', error: err }, 'prisma.$disconnect failed during shutdown');
      })
      .finally(() => {
        process.exit(0);
      });
  };

export { createGracefulShutdown };
