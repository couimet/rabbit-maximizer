import "reflect-metadata";
import { Container } from "inversify";
import { Octokit } from "@octokit/rest";
import { PrismaClient } from "@prisma/client";
import { getLogger, type Logger } from "@couimet/logger-contract";
import { config } from "./config.js";
import { TYPES } from "./inversify-types.js";
import { CoderabbitGitHubClientImpl } from "./github/index.js";
import type { CoderabbitGitHubClient } from "./github/index.js";
import { createPrismaClient } from "./db/prismaClientFactory.js";
import {
  EventRepositoryImpl,
  type EventRepository,
} from "./db/eventRepository.js";
import {
  QueueRepositoryImpl,
  type QueueRepository,
} from "./db/queueRepository.js";
import {
  UuidObservationContextProvider,
  type ObservationContextProvider,
} from "./observability/observationContext.js";
import { ProbeFactory } from "./probes/ProbeFactory.js";

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

container
  .bind<CoderabbitGitHubClient>(TYPES.CoderabbitGitHubClient)
  .to(CoderabbitGitHubClientImpl)
  .inSingletonScope();

container
  .bind<EventRepository>(TYPES.EventRepository)
  .to(EventRepositoryImpl)
  .inSingletonScope();

container
  .bind<QueueRepository>(TYPES.QueueRepository)
  .to(QueueRepositoryImpl)
  .inSingletonScope();

container
  .bind<ObservationContextProvider>(TYPES.ObservationContextProvider)
  .to(UuidObservationContextProvider)
  .inSingletonScope();

container
  .bind<ProbeFactory>(TYPES.ProbeFactory)
  .to(ProbeFactory)
  .inSingletonScope();

export { container };

/** Convenience helper for non-decorator contexts (e.g. main.ts). */
export const getService = <T>(identifier: symbol): T =>
  container.get<T>(identifier);
