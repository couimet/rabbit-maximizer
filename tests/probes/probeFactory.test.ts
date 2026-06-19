import { describe, it, expect, jest } from "@jest/globals";
import { Container } from "inversify";
import type { Logger } from "@couimet/logger-contract";
import type { PrismaClient } from "@prisma/client";
import { ProbeFactory } from "../../src/probes/ProbeFactory.js";
import { DetectedProbe } from "../../src/probes/DetectedProbe.js";
import {
  EventRepositoryImpl,
  type EventRepository,
} from "../../src/db/eventRepository.js";
import {
  UuidObservationContextProvider,
  type ObservationContext,
  type ObservationContextProvider,
} from "../../src/observability/observationContext.js";
import { TYPES } from "../../src/inversify-types.js";
import {
  createMockLogger,
  createMockPrismaClient,
  makeUniqueRepoName,
} from "../helpers/index.js";
import { getUniqueInt, getUniqueString } from "@couimet/dynamic-testing";

describe("ProbeFactory", () => {
  it("creates a DetectedProbe wired with the current observation context", () => {
    const observation: ObservationContext = {
      correlationId: getUniqueString(),
      requestId: getUniqueString(),
      version: getUniqueString(),
    };
    const current = jest.fn<() => ObservationContext>(() => observation);
    const provider = { current } as ObservationContextProvider;
    const eventRepository = {
      record: jest.fn<any>(),
      listForPr: jest.fn<any>(),
    } as unknown as EventRepository;
    const logger = createMockLogger();

    const factory = new ProbeFactory(eventRepository, provider, logger);
    const probe = factory.createDetectedProbe({
      repo_full_name: makeUniqueRepoName().fullName,
      pr_number: getUniqueInt(),
    });

    expect(probe).toBeInstanceOf(DetectedProbe);
    expect(current).toHaveBeenCalledWith();
  });

  describe("container binding", () => {
    it("resolves ProbeFactory from the container", () => {
      const { prisma } = createMockPrismaClient();
      const logger = createMockLogger();
      const container = new Container();

      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container
        .bind<EventRepository>(TYPES.EventRepository)
        .to(EventRepositoryImpl);
      container
        .bind<ObservationContextProvider>(TYPES.ObservationContextProvider)
        .to(UuidObservationContextProvider);
      container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory);

      const factory = container.get<ProbeFactory>(TYPES.ProbeFactory);
      expect(factory).toBeInstanceOf(ProbeFactory);
    });
  });
});
