import { config, describeRepoFilter } from './config.js';
import { container } from './container.js';
import type { PollDetector } from './detectorPoll.js';
import { TYPES } from './inversify-types.js';
import { initLogger } from './logger.js';
import type { Scheduler } from './scheduler.js';

import type { PrismaClient } from '@prisma/client';
import 'reflect-metadata';
import { getLogger } from '@couimet/logger-contract';

initLogger();
const log = getLogger();

log.info({ fn: 'main' }, `rabbit-maximizer starting — DETECTION_MODE=${config.DETECTION_MODE}`);
log.info({ fn: 'main' }, `Watching repos: ${describeRepoFilter(config.REPO_FILTER)}`);
log.info({ fn: 'main' }, `Poll interval: ${config.POLL_INTERVAL}s`);

const prisma = container.get<PrismaClient>(TYPES.PrismaClient);
log.info({ fn: 'main' }, `Connected to ${config.DATABASE_URL}`);

const detector = container.get<PollDetector>(TYPES.PollDetector);
const { stop: stopDetector } = detector.start();

const scheduler = container.get<Scheduler>(TYPES.Scheduler);
const { stop: stopScheduler } = scheduler.start();

const gracefulShutdown = () => {
  log.info({ fn: 'main' }, 'Shutting down');
  void stopDetector()
    .then(() => stopScheduler())
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0));
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
