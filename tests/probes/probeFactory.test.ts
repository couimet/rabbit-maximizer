import { type EventRepository, EventRepositoryImpl } from '../../src/db/eventRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import type { ObservationContext, ObservationContextProvider } from '../../src/observability/observationContext.js';
import { UuidObservationContextProvider } from '../../src/observability/observationContext.js';
import { DetectedProbe } from '../../src/probes/DetectedProbe.js';
import { ProbeFactory } from '../../src/probes/ProbeFactory.js';
import { createMockLogger, createMockPrismaClient, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

describe('ProbeFactory', () => {
  it('creates a DetectedProbe with the provided observation context', () => {
    const observation: ObservationContext = {
      correlationId: getUniqueString(),
      requestId: getUniqueString(),
      version: getUniqueString(),
    };
    const eventRepository = {
      record: jest.fn<any>(),
      listForPr: jest.fn<any>(),
    } as unknown as EventRepository;
    const logger = createMockLogger();

    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createDetectedProbe({ repo_full_name: makeUniqueRepoName().fullName, pr_number: getUniqueInt() }, observation);

    expect(probe).toBeInstanceOf(DetectedProbe);
  });

  describe('container binding', () => {
    it('resolves ProbeFactory from the container', () => {
      const { prisma } = createMockPrismaClient();
      const logger = createMockLogger();
      const container = new Container();

      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<EventRepository>(TYPES.EventRepository).to(EventRepositoryImpl);
      container.bind<ObservationContextProvider>(TYPES.ObservationContextProvider).to(UuidObservationContextProvider);
      container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory);

      const factory = container.get<ProbeFactory>(TYPES.ProbeFactory);
      expect(factory).toBeInstanceOf(ProbeFactory);
    });
  });
});
