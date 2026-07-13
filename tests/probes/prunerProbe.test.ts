import type { EventRepository } from '../../src/db/eventRepository.js';
import type { ObservationContext } from '../../src/observability/observationContext.js';
import { PrunerProbe } from '../../src/probes/PrunerProbe.js';
import type { QueueItem } from '../../src/types/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';

const makeTx = (): Prisma.TransactionClient => ({}) as Prisma.TransactionClient;
const makeItem = (repo: string, pr: number): QueueItem =>
  ({ id: getUniqueInt(), repo_full_name: repo, pr_number: pr, source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }) }) as unknown as QueueItem;

describe('PrunerProbe', () => {
  let events: EventRepository;
  let logger: Logger;
  let observation: ObservationContext;

  beforeEach(() => {
    events = { record: jest.fn<any>() } as unknown as EventRepository;
    logger = createMockLogger();
    observation = { correlationId: getUuid(), requestId: getUuid(), version: '1.0.0' };
  });

  const createProbe = () => new PrunerProbe(events, observation, logger);

  describe('noItemsToPrune', () => {
    it('logs info when no items to prune', () => {
      const probe = createProbe();
      probe.noItemsToPrune();
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith({ fn: 'PrunerProbe.noItemsToPrune' }, 'No items to prune');
    });
  });

  describe('prMerged', () => {
    it('records bypassed event and logs', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tx = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      probe.withTx(tx);
      await probe.prMerged();
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'bypassed',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { reason: 'prMerged' },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'PrunerProbe.prMerged', repo, pr, queueId: item.id },
        'Merged before retrigger; marked reviewed',
      );
    });
  });

  describe('prClosedWithoutMerge', () => {
    it('records bypassed event and logs', async () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tx = makeTx();
      const probe = createProbe();
      probe.withItem(item);
      probe.withTx(tx);
      await probe.prClosedWithoutMerge();
      expect(events.record as jest.Mock<any>).toHaveBeenCalledWith(
        {
          type: 'bypassed',
          repo_full_name: repo,
          pr_number: pr,
          correlation_id: observation.correlationId,
          request_id: observation.requestId,
          version: observation.version,
          payload: { reason: 'prClosedWithoutMerge' },
        },
        tx,
      );
      expect(logger.info as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'PrunerProbe.prClosedWithoutMerge', repo, pr, queueId: item.id },
        'PR closed before retrigger; marked failed',
      );
    });
  });

  describe('caughtError', () => {
    it('logs warn with item context and error', () => {
      const { fullName: repo } = getUniqueGitHubRepoRef();
      const pr = getUniqueInt();
      const item = makeItem(repo, pr);
      const tickError = new Error('prune failure');
      const probe = createProbe();
      probe.withItem(item);
      probe.caughtError(tickError);
      expect(logger.warn as jest.Mock<any>).toHaveBeenCalledWith(
        { fn: 'PrunerProbe.caughtError', repo, pr, queueId: item.id, error: tickError },
        'Failed to prune item; continuing',
      );
    });
  });
});
