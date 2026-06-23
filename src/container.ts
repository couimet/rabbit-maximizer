import { type EventRepository, EventRepositoryImpl } from './db/eventRepository.js';
import { createPrismaClient } from './db/prismaClientFactory.js';
import { type QueueRepository, QueueRepositoryImpl } from './db/queueRepository.js';
import type { CoderabbitGitHubClient } from './github/index.js';
import { CoderabbitGitHubClientImpl } from './github/index.js';
import { type ObservationContextProvider, UuidObservationContextProvider } from './observability/observationContext.js';
import { ProbeFactory } from './probes/ProbeFactory.js';
import type { OnDetectedCallback } from './types/index.js';
import { config } from './config.js';
import { PollDetector } from './detectorPoll.js';
import { EnqueueService } from './EnqueueService.js';
import { TYPES } from './inversify-types.js';
import { Scheduler } from './scheduler.js';

import 'reflect-metadata';
import { getLogger, type Logger } from '@couimet/logger-contract';
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

const container = new Container();

container
  .bind<Octokit>(TYPES.Octokit)
  .toDynamicValue(() => new Octokit({ auth: config.GITHUB_PAT }))
  .inSingletonScope();

container
  .bind<Logger>(TYPES.Logger)
  .toDynamicValue(() => getLogger())
  .inSingletonScope();

container
  .bind<PrismaClient>(TYPES.PrismaClient)
  .toDynamicValue(() => createPrismaClient())
  .inSingletonScope();

container.bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient).to(CoderabbitGitHubClientImpl).inSingletonScope();

container.bind<EventRepository>(TYPES.EventRepository).to(EventRepositoryImpl).inSingletonScope();

container.bind<QueueRepository>(TYPES.QueueRepository).to(QueueRepositoryImpl).inSingletonScope();

container.bind<ObservationContextProvider>(TYPES.ObservationContextProvider).to(UuidObservationContextProvider).inSingletonScope();

container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory).inSingletonScope();

container.bind<EnqueueService>(TYPES.EnqueueService).to(EnqueueService).inSingletonScope();

container
  .bind<OnDetectedCallback>(TYPES.OnDetectedCallback)
  .toDynamicValue(() => container.get<EnqueueService>(TYPES.EnqueueService).handle)
  .inSingletonScope();

container.bind<PollDetector>(TYPES.PollDetector).to(PollDetector).inSingletonScope();

container.bind<Scheduler>(TYPES.Scheduler).to(Scheduler).inSingletonScope();

export { container };

/** Convenience helper for non-decorator contexts (e.g. main.ts). */
export const getService = <T>(identifier: symbol): T => container.get<T>(identifier);
