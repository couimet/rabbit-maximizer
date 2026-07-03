import { type EventRepository, EventRepositoryImpl } from '../../src/db/eventRepository.js';
import type { QueueRepository } from '../../src/db/queueRepository.js';
import { TYPES } from '../../src/inversify-types.js';
import type { ObservationContext, ObservationContextProvider } from '../../src/observability/observationContext.js';
import { UuidObservationContextProvider } from '../../src/observability/observationContext.js';
import { DetectedProbe } from '../../src/probes/DetectedProbe.js';
import { ProbeFactory } from '../../src/probes/ProbeFactory.js';
import { QueueItemProbe } from '../../src/probes/QueueItemProbe.js';
import type { QueueItem } from '../../src/types/index.js';
import { createMockLogger, createMockPrismaClient, makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { describe, expect, it, jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

describe('ProbeFactory', () => {
  const makeMocks = () => {
    const eventRepository = {
      record: jest.fn<any>(),
      listForPr: jest.fn<any>(),
    } as unknown as EventRepository;
    const queueRepository = {
      markCompleted: jest.fn<any>(),
      markFailed: jest.fn<any>(),
      markPosted: jest.fn<any>(),
    } as unknown as QueueRepository;
    const logger = createMockLogger();

    return { eventRepository, queueRepository, logger };
  };

  const makeObservation = (): ObservationContext => ({
    correlationId: getUniqueString({ prefix: 'corr-' }),
    requestId: getUniqueString({ prefix: 'req-' }),
    version: '1.0.0',
  });

  it('creates a DetectedProbe with the provided observation context', () => {
    const observation: ObservationContext = {
      correlationId: getUniqueString(),
      requestId: getUniqueString(),
      version: getUniqueString(),
    };
    const { eventRepository, queueRepository, logger } = makeMocks();

    const factory = new ProbeFactory(eventRepository, queueRepository, logger);
    const probe = factory.createDetectedProbe({ repo_full_name: makeUniqueRepoName().fullName, pr_number: getUniqueInt() }, observation);

    expect(probe).toBeInstanceOf(DetectedProbe);
  });

  it('creates a QueueItemProbe', () => {
    const { eventRepository, queueRepository, logger } = makeMocks();
    const observation = makeObservation();

    const factory = new ProbeFactory(eventRepository, queueRepository, logger);
    const probe = factory.createQueueItemProbe(
      { id: getUniqueInt(), repo_full_name: makeUniqueRepoName().fullName, pr_number: getUniqueInt() } as QueueItem,
      observation,
    );

    expect(probe).toBeInstanceOf(QueueItemProbe);
  });

  describe('container binding', () => {
    it('resolves ProbeFactory from the container', () => {
      const { prisma } = createMockPrismaClient();
      const logger = createMockLogger();
      const container = new Container();

      container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(prisma);
      container.bind<Logger>(TYPES.Logger).toConstantValue(logger);
      container.bind<EventRepository>(TYPES.EventRepository).to(EventRepositoryImpl);
      container.bind<QueueRepository>(TYPES.QueueRepository).toConstantValue({} as unknown as QueueRepository);
      container.bind<ObservationContextProvider>(TYPES.ObservationContextProvider).to(UuidObservationContextProvider);
      container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory);

      const factory = container.get<ProbeFactory>(TYPES.ProbeFactory);
      expect(factory).toBeInstanceOf(ProbeFactory);
    });
  });
});
