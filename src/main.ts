import type { EventRepository } from './db/eventRepository.js';
import type { PullRequestRepository } from './db/pullRequestRepository.js';
import type { QueueOrderRepository } from './db/queueOrderRepository.js';
import type { QueueRepository } from './db/queueRepository.js';
import type { SystemStateRepository } from './db/systemStateRepository.js';
import type { EventCountsMapper } from './mappers/index.js';
import type { EventEntryMapper } from './mappers/index.js';
import type { QueueItemMapper } from './mappers/index.js';
import { describeDatabaseUrl } from './utils/describeDatabaseUrl.js';
import { config, describeRepoFilter } from './config.js';
import { container } from './container.js';
import type { PollDetector } from './detectorPoll.js';
import { setupExpress } from './express.js';
import { createGracefulShutdown } from './gracefulShutdown.js';
import { TYPES } from './inversify-types.js';
import { initLogger } from './logger.js';
import type { ReviewDetector } from './ReviewDetector.js';
import { ReviewTrigger } from './ReviewTrigger.js';
import type { Scheduler } from './scheduler.js';
import { validateGitHubToken } from './validateGitHubToken.js';

import 'reflect-metadata';
import { getLogger, type Logger } from '@couimet/logger-contract';
import type { Octokit } from '@octokit/rest';
import type { PrismaClient } from '@prisma/client';

initLogger();
const log = getLogger();

log.info({ fn: 'main' }, `rabbit-maximizer starting — DETECTION_MODE=${config.DETECTION_MODE}`);
log.info({ fn: 'main' }, `Watching repos: ${describeRepoFilter(config.REPO_FILTER)}`);
log.info({ fn: 'main' }, `Poll interval: ${config.POLL_INTERVAL_SEC}s`);

const octokit = container.get<Octokit>(TYPES.Octokit);
try {
  await validateGitHubToken({ octokit, repoFilter: config.REPO_FILTER, log });
} catch (err) {
  log.warn(
    {
      fn: 'main',
      error: err,
    },
    'GitHub token validation failed — the app will start but posting retrigger comments may fail with 403',
  );
}

const prisma = container.get<PrismaClient>(TYPES.PrismaClient);
log.info({ fn: 'main' }, `Connected to ${describeDatabaseUrl(config.DATABASE_URL)}`);

const detector = container.get<PollDetector>(TYPES.PollDetector);
const { stop: stopDetector } = detector.start();

const reviewDetector = container.get<ReviewDetector>(TYPES.ReviewDetector);
const { stop: stopReviewDetector } = reviewDetector.start();

const scheduler = container.get<Scheduler>(TYPES.Scheduler);
const { stop: stopScheduler } = scheduler.start();

const queueRepo = container.get<QueueRepository>(TYPES.QueueRepository);
const queueOrderRepo = container.get<QueueOrderRepository>(TYPES.QueueOrderRepository);
const eventRepo = container.get<EventRepository>(TYPES.EventRepository);
const pullRequestRepo = container.get<PullRequestRepository>(TYPES.PullRequestRepository);
const systemStateRepo = container.get<SystemStateRepository>(TYPES.SystemStateRepository);
const reviewTrigger = container.get<ReviewTrigger>(TYPES.ReviewTrigger);
const eventCountsMapper = container.get<EventCountsMapper>(TYPES.EventCountsMapper);
const eventEntryMapper = container.get<EventEntryMapper>(TYPES.EventEntryMapper);
const queueItemMapper = container.get<QueueItemMapper>(TYPES.QueueItemMapper);
const appLogger = container.get<Logger>(TYPES.Logger);

const { stop: stopServer } = setupExpress({
  config,
  eventCountsMapper,
  eventEntryMapper,
  eventRepo,
  pullRequestRepo,
  prisma,
  queueItemMapper,
  queueOrderRepo,
  queueRepo,
  reviewTrigger,
  systemStateRepo,
  logger: appLogger,
  port: config.WEB_PORT,
});

log.info({ fn: 'main', port: config.WEB_PORT }, 'Dashboard API server started');

const gracefulShutdown = createGracefulShutdown({ stopDetector, stopReviewDetector, stopScheduler, stopServer, prisma, log });

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
