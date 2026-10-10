import {
  CoderabbitCommentRepository,
  createPrismaClient,
  EventRepository,
  PullRequestRepository,
  QueueOrderRepository,
  QueueRepository,
  SystemStateRepository,
} from './db/index.js';
import { softDeleteExtension } from './external-deps/couimet/prisma-extension-soft-delete/src/index.js';
import { CoderabbitGitHubClient, PRStateFetcher } from './github/index.js';
import {
  EventCountsMapper,
  EventEntryMapper,
  QueueItemMapper,
  ReviewQueueToActivityListItemMapper,
  ReviewQueueToQueueItemMapper,
  TrackedPrMapper,
} from './mappers/index.js';
import { ProbeFactory } from './probes/index.js';
import type { OnDetectedCallback } from './types/index.js';
import { MS_PER_SECOND } from './utils/index.js';
import { type Config, config } from './config.js';
import { DirectCommentChecker } from './DirectCommentChecker.js';
import { EditDetector } from './EditDetector.js';
import { TYPES } from './server-domain.js';
import {
  EnqueueService,
  PollDetector,
  PrScanner,
  PruneEvaluator,
  Pruner,
  QueueItemEnricher,
  ReviewDetector,
  ReviewTrigger,
  RunIdGenerator,
  Scheduler,
  StalePrRecoverer,
} from './services.js';

import 'reflect-metadata';
import { getLogger, type Logger } from '@couimet/logger-contract';
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

const container = new Container();

container.bind<Config>(TYPES.Config).toConstantValue(config);

container
  .bind<Octokit>(TYPES.Octokit)
  .toDynamicValue(() => new Octokit({ auth: config.GITHUB_PAT, request: { timeout: config.GITHUB_API_TIMEOUT_SEC * MS_PER_SECOND } }))
  .inSingletonScope();

container
  .bind<Logger>(TYPES.Logger)
  .toDynamicValue(() => getLogger())
  .inSingletonScope();

container
  .bind<PrismaClient>(TYPES.PrismaClient)
  .toDynamicValue(() => createPrismaClient().$extends(softDeleteExtension({ models: { CoderabbitComment: true } })) as unknown as PrismaClient)
  .inSingletonScope();

container.bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient).to(CoderabbitGitHubClient).inSingletonScope();

container.bind<ReviewDetector>(TYPES.ReviewDetector).to(ReviewDetector).inSingletonScope();

container.bind<PRStateFetcher>(TYPES.PRStateFetcher).to(PRStateFetcher).inSingletonScope();

container.bind<EventRepository>(TYPES.EventRepository).to(EventRepository).inSingletonScope();

container.bind<QueueOrderRepository>(TYPES.QueueOrderRepository).to(QueueOrderRepository).inSingletonScope();

container.bind<QueueRepository>(TYPES.QueueRepository).to(QueueRepository).inSingletonScope();

container.bind<SystemStateRepository>(TYPES.SystemStateRepository).to(SystemStateRepository).inSingletonScope();

container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory).inSingletonScope();

container.bind<CoderabbitCommentRepository>(TYPES.CoderabbitCommentRepository).to(CoderabbitCommentRepository).inSingletonScope();

container.bind<PullRequestRepository>(TYPES.PullRequestRepository).to(PullRequestRepository).inSingletonScope();

container.bind<PruneEvaluator>(TYPES.PruneEvaluator).to(PruneEvaluator).inSingletonScope();

container.bind<Pruner>(TYPES.Pruner).to(Pruner).inSingletonScope();

container.bind<PrScanner>(TYPES.PrScanner).to(PrScanner).inSingletonScope();

container.bind<StalePrRecoverer>(TYPES.StalePrRecoverer).to(StalePrRecoverer).inSingletonScope();

container.bind<DirectCommentChecker>(TYPES.DirectCommentChecker).to(DirectCommentChecker).inSingletonScope();

container.bind<EditDetector>(TYPES.EditDetector).to(EditDetector).inSingletonScope();

container.bind<EnqueueService>(TYPES.EnqueueService).to(EnqueueService).inSingletonScope();

container
  .bind<OnDetectedCallback>(TYPES.OnDetectedCallback)
  .toDynamicValue(() => container.get<EnqueueService>(TYPES.EnqueueService).handle)
  .inSingletonScope();

container.bind<PollDetector>(TYPES.PollDetector).to(PollDetector).inSingletonScope();

container.bind<RunIdGenerator>(TYPES.RunIdGenerator).to(RunIdGenerator).inSingletonScope();

container.bind<ReviewTrigger>(TYPES.ReviewTrigger).to(ReviewTrigger).inSingletonScope();
container.bind<Scheduler>(TYPES.Scheduler).to(Scheduler).inSingletonScope();

container.bind<EventCountsMapper>(TYPES.EventCountsMapper).to(EventCountsMapper).inSingletonScope();
container.bind<EventEntryMapper>(TYPES.EventEntryMapper).to(EventEntryMapper).inSingletonScope();
container.bind<QueueItemEnricher>(TYPES.QueueItemEnricher).to(QueueItemEnricher).inSingletonScope();
container.bind<QueueItemMapper>(TYPES.QueueItemMapper).to(QueueItemMapper).inSingletonScope();
container.bind<ReviewQueueToActivityListItemMapper>(TYPES.ReviewQueueToActivityListItemMapper).to(ReviewQueueToActivityListItemMapper).inSingletonScope();
container.bind<ReviewQueueToQueueItemMapper>(TYPES.ReviewQueueToQueueItemMapper).to(ReviewQueueToQueueItemMapper).inSingletonScope();
container.bind<TrackedPrMapper>(TYPES.TrackedPrMapper).to(TrackedPrMapper).inSingletonScope();

export { container };
