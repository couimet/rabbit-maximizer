import type { EventRepository, PullRequestRepository, QueueOrderRepository, QueueRepository, SystemStateRepository } from './db/index.js';
import {
  type EventCountsMapper,
  type EventEntryMapper,
  type QueueItemMapper,
  ReviewQueueToActivityListItemMapper,
  type TrackedPrMapper,
} from './mappers/index.js';
import { describeDatabaseUrl } from './utils/index.js';
import { config, describeRepoFilter } from './config.js';
import { container } from './container.js';
import { TYPES } from './domain.js';
import { setupExpress } from './express.js';
import { createGracefulShutdown } from './gracefulShutdown.js';
import { initLogger } from './logger.js';
import { type PollDetector, type ReviewDetector, ReviewTrigger, type Scheduler } from './services.js';
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
const { stop: stopDetector } = await detector.start();

const reviewDetector = container.get<ReviewDetector>(TYPES.ReviewDetector);
const { stop: stopReviewDetector } = await reviewDetector.start();

const scheduler = container.get<Scheduler>(TYPES.Scheduler);
log.info({ fn: 'main' }, 'Starting Scheduler (cooldown state ready)');
const { stop: stopScheduler } = await scheduler.start();

const queueRepo = container.get<QueueRepository>(TYPES.QueueRepository);
const queueOrderRepo = container.get<QueueOrderRepository>(TYPES.QueueOrderRepository);
const eventRepo = container.get<EventRepository>(TYPES.EventRepository);
const systemStateRepo = container.get<SystemStateRepository>(TYPES.SystemStateRepository);
const pullRequestRepo = container.get<PullRequestRepository>(TYPES.PullRequestRepository);
const reviewTrigger = container.get<ReviewTrigger>(TYPES.ReviewTrigger);
const eventCountsMapper = container.get<EventCountsMapper>(TYPES.EventCountsMapper);
const eventEntryMapper = container.get<EventEntryMapper>(TYPES.EventEntryMapper);
const activityListMapper = container.get<ReviewQueueToActivityListItemMapper>(TYPES.ReviewQueueToActivityListItemMapper);
const queueItemMapper = container.get<QueueItemMapper>(TYPES.QueueItemMapper);
const trackedPrMapper = container.get<TrackedPrMapper>(TYPES.TrackedPrMapper);
const appLogger = container.get<Logger>(TYPES.Logger);

const { stop: stopServer } = await setupExpress({
  activityListMapper,
  config,
  eventCountsMapper,
  eventEntryMapper,
  eventRepo,
  prisma,
  pullRequestRepo,
  queueItemMapper,
  queueOrderRepo,
  queueRepo,
  reviewTrigger,
  systemStateRepo,
  trackedPrMapper,
  logger: appLogger,
  port: config.WEB_PORT,
});

log.info({ fn: 'main', port: config.WEB_PORT }, 'Dashboard API server started');

const gracefulShutdown = createGracefulShutdown({ stopDetector, stopReviewDetector, stopScheduler, stopServer, prisma, log });

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
