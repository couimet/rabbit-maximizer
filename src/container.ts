import {
  type CoderabbitCommentRepository,
  CoderabbitCommentRepositoryImpl,
  createPrismaClient,
  type EventRepository,
  EventRepositoryImpl,
  type PullRequestRepository,
  PullRequestRepositoryImpl,
  type QueueOrderRepository,
  QueueOrderRepositoryImpl,
  type QueueRepository,
  QueueRepositoryImpl,
  type SystemStateRepository,
  SystemStateRepositoryImpl,
} from './db/index.js';
import { softDeleteExtension } from './external-deps/couimet/prisma-extension-soft-delete/src/index.js';
import { type CoderabbitGitHubClient, CoderabbitGitHubClientImpl, type PRStateFetcher, PRStateFetcherImpl } from './github/index.js';
import { EventCountsMapper, EventEntryMapper, QueueItemMapper, ReviewQueueToQueueItemMapper } from './mappers/index.js';
import { type ObservationContextProvider, UuidObservationContextProvider } from './observability/index.js';
import { ProbeFactory } from './probes/index.js';
import type { OnDetectedCallback } from './types/index.js';
import { MS_PER_SECOND, QueueItemEnricher } from './utils/index.js';
import { type Config, config } from './config.js';
import { TYPES } from './domain.js';
import {
  EnqueueService,
  PollDetector,
  type PrScanner,
  PrScannerImpl,
  type PruneEvaluator,
  PruneEvaluatorImpl,
  type Pruner,
  PrunerImpl,
  ReviewDetector,
  ReviewTrigger,
  Scheduler,
  type StalePrRecoverer,
  StalePrRecovererImpl,
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

container.bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient).to(CoderabbitGitHubClientImpl).inSingletonScope();

container.bind<ReviewDetector>(TYPES.ReviewDetector).to(ReviewDetector).inSingletonScope();

container.bind<PRStateFetcher>(TYPES.PRStateFetcher).to(PRStateFetcherImpl).inSingletonScope();

container.bind<EventRepository>(TYPES.EventRepository).to(EventRepositoryImpl).inSingletonScope();

container.bind<QueueOrderRepository>(TYPES.QueueOrderRepository).to(QueueOrderRepositoryImpl).inSingletonScope();

container.bind<QueueRepository>(TYPES.QueueRepository).to(QueueRepositoryImpl).inSingletonScope();

container.bind<SystemStateRepository>(TYPES.SystemStateRepository).to(SystemStateRepositoryImpl).inSingletonScope();

container.bind<ObservationContextProvider>(TYPES.ObservationContextProvider).to(UuidObservationContextProvider).inSingletonScope();

container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory).inSingletonScope();

container.bind<CoderabbitCommentRepository>(TYPES.CoderabbitCommentRepository).to(CoderabbitCommentRepositoryImpl).inSingletonScope();

container.bind<PullRequestRepository>(TYPES.PullRequestRepository).to(PullRequestRepositoryImpl).inSingletonScope();

container.bind<PruneEvaluator>(TYPES.PruneEvaluator).to(PruneEvaluatorImpl).inSingletonScope();

container.bind<Pruner>(TYPES.Pruner).to(PrunerImpl).inSingletonScope();

container.bind<PrScanner>(TYPES.PrScanner).to(PrScannerImpl).inSingletonScope();

container.bind<StalePrRecoverer>(TYPES.StalePrRecoverer).to(StalePrRecovererImpl).inSingletonScope();

container.bind<EnqueueService>(TYPES.EnqueueService).to(EnqueueService).inSingletonScope();

container
  .bind<OnDetectedCallback>(TYPES.OnDetectedCallback)
  .toDynamicValue(() => container.get<EnqueueService>(TYPES.EnqueueService).handle)
  .inSingletonScope();

container.bind<PollDetector>(TYPES.PollDetector).to(PollDetector).inSingletonScope();

container.bind<ReviewTrigger>(TYPES.ReviewTrigger).to(ReviewTrigger).inSingletonScope();
container.bind<Scheduler>(TYPES.Scheduler).to(Scheduler).inSingletonScope();

container.bind<EventCountsMapper>(TYPES.EventCountsMapper).to(EventCountsMapper).inSingletonScope();
container.bind<EventEntryMapper>(TYPES.EventEntryMapper).to(EventEntryMapper).inSingletonScope();
container.bind<QueueItemEnricher>(TYPES.QueueItemEnricher).to(QueueItemEnricher).inSingletonScope();
container.bind<QueueItemMapper>(TYPES.QueueItemMapper).to(QueueItemMapper).inSingletonScope();
container.bind<ReviewQueueToQueueItemMapper>(TYPES.ReviewQueueToQueueItemMapper).to(ReviewQueueToQueueItemMapper).inSingletonScope();

export { container };
