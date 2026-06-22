import { describeDatabaseUrl } from './utils/describeDatabaseUrl.js';
import { config, describeRepoFilter } from './config.js';
import { container } from './container.js';
import type { EventRepository } from './db/eventRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { PollDetector } from './detectorPoll.js';
import { setupExpress } from './express.js';
import { createGracefulShutdown } from './gracefulShutdown.js';
import { TYPES } from './inversify-types.js';
import { initLogger } from './logger.js';
import type { Scheduler } from './scheduler.js';

import { getLogger, type Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import 'reflect-metadata';

initLogger();
const log = getLogger();

log.info({ fn: 'main' }, `rabbit-maximizer starting — DETECTION_MODE=${config.DETECTION_MODE}`);
log.info({ fn: 'main' }, `Watching repos: ${describeRepoFilter(config.REPO_FILTER)}`);
log.info({ fn: 'main' }, `Poll interval: ${config.POLL_INTERVAL}s`);

const prisma = container.get<PrismaClient>(TYPES.PrismaClient);
log.info({ fn: 'main' }, `Connected to ${describeDatabaseUrl(config.DATABASE_URL)}`);

const detector = container.get<PollDetector>(TYPES.PollDetector);
const { stop: stopDetector } = detector.start();

const scheduler = container.get<Scheduler>(TYPES.Scheduler);
const { stop: stopScheduler } = scheduler.start();

const queueRepo = container.get<QueueRepository>(TYPES.QueueRepository);
const eventRepo = container.get<EventRepository>(TYPES.EventRepository);
const appLogger = container.get<Logger>(TYPES.Logger);

const { stop: stopServer } = setupExpress({
  queueRepo,
  eventRepo,
  logger: appLogger,
  port: config.WEB_PORT,
});

const gracefulShutdown = createGracefulShutdown({ stopDetector, stopScheduler, stopServer, prisma, log });

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
