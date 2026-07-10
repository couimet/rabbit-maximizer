import type { QueueRepository } from '../src/db/queueRepository.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';
import type { PruneEvaluator } from '../src/PruneEvaluator.js';
import { PrunerImpl } from '../src/Pruner.js';
import type { QueueItem } from '../src/types/index.js';

import { getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import type { Logger } from '@couimet/logger-contract';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

const makeItem = (): QueueItem =>
  ({ id: getUniqueInt(), repo_full_name: getUniqueGitHubRepoRef().fullName, pr_number: getUniqueInt() }) as unknown as QueueItem;

describe('Pruner', () => {
  let log: Logger;
  let queue: QueueRepository;
  let pruneEvaluator: PruneEvaluator;
  let probeFactory: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let mockProbe: { processMergedBeforeRetrigger: jest.Mock; processClosedBeforeRetrigger: jest.Mock };

  beforeEach(() => {
    log = {
      warn: jest.fn<any>(),
    } as unknown as Logger;

    queue = {
      getPendingQueue: jest.fn<any>(),
    } as unknown as QueueRepository;

    pruneEvaluator = {
      evaluate: jest.fn<any>().mockResolvedValue([]),
    } as unknown as PruneEvaluator;

    mockProbe = {
      processMergedBeforeRetrigger: jest.fn<any>().mockResolvedValue(undefined),
      processClosedBeforeRetrigger: jest.fn<any>().mockResolvedValue(undefined),
    };

    probeFactory = {
      createQueueItemProbe: jest.fn<any>().mockReturnValue(mockProbe),
    } as unknown as ProbeFactory;

    observation = {
      current: jest.fn().mockReturnValue({
        correlationId: getUuid(),
        requestId: getUuid(),
        version: '1.0.0',
      }),
    } as unknown as ObservationContextProvider;

    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<(fn: (client: Prisma.TransactionClient) => unknown) => unknown>().mockImplementation((fn) => fn(tx)),
    } as unknown as PrismaClient;
  });

  const createPruner = () => new PrunerImpl(queue, pruneEvaluator, probeFactory, observation, prisma, log);

  describe('prune', () => {
    it('evaluates pending items and applies prune decisions in a transaction', async () => {
      const mergedItem = makeItem();
      const closedItem = makeItem();
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([mergedItem, closedItem]);
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([
        { item: mergedItem, outcome: 'merged' },
        { item: closedItem, outcome: 'closed-without-merge' },
      ]);

      const pruner = createPruner();
      await pruner.prune();

      expect(queue.getPendingQueue).toHaveBeenCalled();
      expect(pruneEvaluator.evaluate).toHaveBeenCalledWith([mergedItem, closedItem]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockProbe.processMergedBeforeRetrigger).toHaveBeenCalledWith(tx);
      expect(mockProbe.processClosedBeforeRetrigger).toHaveBeenCalledWith(tx);
    });

    it('skips the transaction when there are no pending items', async () => {
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([]);

      const pruner = createPruner();
      await pruner.prune();

      expect(pruneEvaluator.evaluate).toHaveBeenCalledWith([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('skips the transaction when evaluate returns no enriched items', async () => {
      const openItem = makeItem();
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([openItem]);
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([]);

      const pruner = createPruner();
      await pruner.prune();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('continues with remaining items when one transaction fails', async () => {
      const item1 = makeItem();
      const item2 = makeItem();
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([item1, item2]);
      const failingProbe = {
        processMergedBeforeRetrigger: jest.fn<any>().mockRejectedValue(new Error('probe failure')),
        processClosedBeforeRetrigger: jest.fn<any>().mockRejectedValue(new Error('probe failure')),
      };
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([
        { item: item1, outcome: 'merged' },
        { item: item2, outcome: 'closed-without-merge' },
      ]);
      (probeFactory.createQueueItemProbe as jest.Mock<any>).mockReturnValue(failingProbe);

      const pruner = createPruner();
      await pruner.prune();

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(log.warn).toHaveBeenCalledTimes(2);
      expect(log.warn).toHaveBeenCalledWith(
        { fn: 'Pruner.prune', repo: item1.repo_full_name, pr: item1.pr_number, queueId: item1.id, error: expect.any(Error) },
        'Failed to prune item; continuing',
      );
    });
  });
});
