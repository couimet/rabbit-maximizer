import { type CoderabbitCommentRepository, CoderabbitCommentRepositoryImpl } from './db/coderabbitCommentRepository.js';
import { type EventRepository, EventRepositoryImpl } from './db/eventRepository.js';
import { createPrismaClient } from './db/prismaClientFactory.js';
import { type PullRequestRepository, PullRequestRepositoryImpl } from './db/pullRequestRepository.js';
import { type QueueOrderRepository, QueueOrderRepositoryImpl } from './db/queueOrderRepository.js';
import { type QueueRepository, QueueRepositoryImpl } from './db/queueRepository.js';
import { type SystemStateRepository, SystemStateRepositoryImpl } from './db/systemStateRepository.js';
import { softDeleteExtension } from './external-deps/couimet/prisma-extension-soft-delete/src/softDeleteExtension.js';
import type { CoderabbitGitHubClient } from './github/index.js';
import { CoderabbitGitHubClientImpl } from './github/index.js';
import { type PRStateFetcher, PRStateFetcherImpl } from './github/index.js';
import { EventCountsMapper, EventEntryMapper, QueueItemMapper } from './mappers/index.js';
import { type ObservationContextProvider, UuidObservationContextProvider } from './observability/observationContext.js';
import { ProbeFactory } from './probes/ProbeFactory.js';
import type { OnDetectedCallback } from './types/index.js';
import { MS_PER_SECOND } from './utils/durations.js';
import { type Config, config } from './config.js';
import { PollDetector } from './detectorPoll.js';
import { EnqueueService } from './EnqueueService.js';
import { TYPES } from './inversify-types.js';
import { type PruneEvaluator, PruneEvaluatorImpl } from './PruneEvaluator.js';
import { type Pruner, PrunerImpl } from './Pruner.js';
import { ReviewDetector } from './ReviewDetector.js';
import { ReviewTrigger } from './ReviewTrigger.js';
import { Scheduler } from './scheduler.js';

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
container.bind<QueueItemMapper>(TYPES.QueueItemMapper).to(QueueItemMapper).inSingletonScope();

export { container };
