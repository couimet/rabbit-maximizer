import { ObservationContext } from '../../src/observability/index.js';
import { EnqueueProbe } from '../../src/probes/EnqueueProbe.js';
import { createMockTx } from '../external-deps/couimet/prisma-testing/index.js';
import { createMockEventRepo, generateObservationContextHydrationData } from '../helpers/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

describe('EnqueueProbe', () => {
  let events: ReturnType<typeof createMockEventRepo>;
  let logger: ReturnType<typeof createMockLogger>;
  let observation: ObservationContext;

  beforeEach(() => {
    events = createMockEventRepo();
    logger = createMockLogger();
    observation = generateObservationContextHydrationData();
  });

  const createProbe = (tx: Prisma.TransactionClient) => new EnqueueProbe(events, observation, tx, logger);

  describe('recentlyRetriggered', () => {
    it('logs debug when PR was recently retriggered', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const probe = createProbe(createMockTx());
      probe.recentlyRetriggered(repo, pr);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'EnqueueProbe.recentlyRetriggered', repo, pr }, 'PR was recently retriggered; skipping');
    });
  });

  describe('enqueued', () => {
    const eventUuid = getUuid();
    it('records enqueued event and logs info with event uuid', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const newWait = getUniqueInt();
      const tx = createMockTx();
      const probe = createProbe(tx);
      (events.record as jest.Mock<any>).mockResolvedValue({ uuid: eventUuid });
      await probe.enqueued({ repo, pr, newWait: newWait });
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'enqueued',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { new_wait: newWait },
        },
        tx,
      );
      expect(logger.info).toHaveBeenCalledWith({ fn: 'EnqueueProbe.enqueued', repo, pr, eventUuid: eventUuid }, 'Queue item enqueued');
    });
  });

  describe('alreadyQueued', () => {
    it('logs debug when PR is already queued', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const status = getUniqueString({ prefix: 'status-' });
      const probe = createProbe(createMockTx());
      probe.alreadyQueued(repo, pr, status);
      expect(logger.debug).toHaveBeenCalledWith({ fn: 'EnqueueProbe.alreadyQueued', repo, pr, status: status }, 'Already queued; returning existing row');
    });
  });
});
