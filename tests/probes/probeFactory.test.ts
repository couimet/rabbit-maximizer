import { type EventRepository, EventRepositoryImpl, type PullRequestRepository, type QueueRepository } from '../../src/db/index.js';
import { TYPES } from '../../src/domain.js';
import {
  DetectedProbe,
  DirectCommentCheckProbe,
  EnqueueProbe,
  MarkQueueItemReviewedProbe,
  ProbeFactory,
  PrScannerProbe,
  PrunerProbe,
  ReviewDetectorProbe,
  ReviewRetriggerProbe,
  SchedulerProbe,
} from '../../src/probes/index.js';
import type { QueueItem } from '../../src/types/index.js';
import { createMockEventRepo, createMockPrismaClient, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';
import { Container } from 'inversify';

const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 3_600_000;
const MAX_RETRIGGER_ATTEMPTS = 10;

describe('ProbeFactory', () => {
  const makeMocks = () => {
    const eventRepository = createMockEventRepo();
    const logger = createMockLogger();
    return { eventRepository, logger };
  };

  it('creates a DetectedProbe with the provided observation context', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const ref = generateReviewRef();
    const probe = factory.createDetectedProbe({
      repo_full_name: ref.repoFullName,
      pr_number: ref.prNumber,
      source_ts: getUniqueDate(),
      source_comment_url: ref.commentUrl,
      coderabbit_run_id: getUuid(),
    });
    expect(probe).toBeInstanceOf(DetectedProbe);
  });

  it('creates a MarkQueueItemReviewedProbe with the current observation context', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createMarkQueueItemReviewedProbe('test-uuid');
    expect(probe).toBeInstanceOf(MarkQueueItemReviewedProbe);
  });

  it('creates an EnqueueProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createEnqueueProbe({} as Prisma.TransactionClient);
    expect(probe).toBeInstanceOf(EnqueueProbe);
  });

  it('creates a SchedulerProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createSchedulerProbe({ baseBackoff: BASE_BACKOFF_MS, maxBackoff: MAX_BACKOFF_MS, maxRetriggerAttempts: MAX_RETRIGGER_ATTEMPTS });
    expect(probe).toBeInstanceOf(SchedulerProbe);
  });

  it('creates a PrunerProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createPrunerProbe();
    expect(probe).toBeInstanceOf(PrunerProbe);
  });

  it('creates a PrScannerProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createPrScannerProbe();
    expect(probe).toBeInstanceOf(PrScannerProbe);
    probe.scanStarted();
    expect(logger.info).toHaveBeenCalledWith({ fn: 'PrScannerProbe.scanStarted' }, 'PR scan started');
  });

  it('creates a ReviewDetectorProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createReviewDetectorProbe();
    expect(probe).toBeInstanceOf(ReviewDetectorProbe);
  });

  it('creates a DirectCommentCheckProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const probe = factory.createDirectCommentCheckProbe();
    expect(probe).toBeInstanceOf(DirectCommentCheckProbe);
  });

  it('creates a ReviewRetriggerProbe', () => {
    const { eventRepository, logger } = makeMocks();
    const factory = new ProbeFactory(eventRepository, logger);
    const ref = generateReviewRef();
    const probe = factory.createReviewRetriggerProbe({
      id: getUniqueInt(),
      repo_full_name: ref.repoFullName,
      pr_number: ref.prNumber,
    } as QueueItem);
    expect(probe).toBeInstanceOf(ReviewRetriggerProbe);
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
      container.bind<PullRequestRepository>(TYPES.PullRequestRepository).toConstantValue({} as unknown as PullRequestRepository);
      container.bind<ProbeFactory>(TYPES.ProbeFactory).to(ProbeFactory);
      const factory = container.get<ProbeFactory>(TYPES.ProbeFactory);
      expect(factory).toBeInstanceOf(ProbeFactory);
    });
  });
});
