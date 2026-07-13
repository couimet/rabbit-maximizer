import type { EventRepository } from '../../src/db/eventRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { EnqueueProbe } from '../../src/probes/EnqueueProbe.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;

describe('EnqueueProbe', () => {
  let events: EventRepository;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    events = { record: jest.fn<any>() } as unknown as EventRepository;
    logger = createMockLogger();
    observation = { correlationId: getUuid(), requestId: getUuid(), version: '1.0.0' };
  });

  const createProbe = () => new EnqueueProbe(events, observation, {} as Prisma.TransactionClient, logger);

  describe('recentlyRetriggered', () => {
    it('logs debug when PR was recently retriggered', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const probe = createProbe();
      probe.recentlyRetriggered(repo, pr);
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.recentlyRetriggered', repo, pr },
        'PR was recently retriggered; skipping',
      );
    });
  });

  describe('enqueued', () => {
    it('records enqueued event and logs debug', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const NOT_BEFORE = getUniqueDate();
      const NEW_WAIT = getUniqueInt();
      const tx = makeTx();
      const probe = createProbe();
      await probe.enqueued({ repo, pr, notBefore: NOT_BEFORE, newWait: NEW_WAIT });
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'enqueued',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { not_before: NOT_BEFORE, new_wait: NEW_WAIT },
        },
        tx,
      );
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'EnqueueProbe.enqueued', repo, pr }, 'Enqueued event recorded');
    });
  });

  describe('alreadyQueued', () => {
    it('logs debug when PR is already queued', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const STATUS = getUniqueString({ prefix: 'status-' });
      const probe = createProbe();
      probe.alreadyQueued(repo, pr, STATUS);
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.alreadyQueued', repo, pr, status: STATUS },
        'Already queued; returning existing row',
      );
    });
  });

  describe('alreadyQueuedRescheduled', () => {
    it('logs debug when already queued PR is rescheduled', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const OLD_NOT_BEFORE = getUniqueDate();
      const NEW_NOT_BEFORE = getUniqueDate();
      const probe = createProbe();
      probe.alreadyQueuedRescheduled(repo, pr, OLD_NOT_BEFORE, NEW_NOT_BEFORE);
      expect(logger.debug as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'EnqueueProbe.alreadyQueuedRescheduled', repo, pr, oldNotBefore: OLD_NOT_BEFORE, newNotBefore: NEW_NOT_BEFORE },
        'Already queued; schedule updated on re-detection',
      );
    });
  });
});
