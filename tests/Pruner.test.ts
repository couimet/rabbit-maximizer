import type { QueueRepository } from '../src/db/queueRepository.js';
import type { ObservationContextProvider } from '../src/observability/observationContext.js';
import type { ProbeFactory } from '../src/probes/ProbeFactory.js';
import type { PruneEvaluator } from '../src/PruneEvaluator.js';
import { PrunerImpl } from '../src/Pruner.js';
import type { QueueItem } from '../src/types/index.js';

import { makeUniqueRepoName } from './helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

const makeItem = (): QueueItem => ({ id: getUniqueInt(), repo_full_name: makeUniqueRepoName().fullName, pr_number: getUniqueInt() }) as unknown as QueueItem;

describe('Pruner', () => {
  let queue: QueueRepository;
  let pruneEvaluator: PruneEvaluator;
  let probeFactory: ProbeFactory;
  let observation: ObservationContextProvider;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let mockProbe: { processMergedBeforeRetrigger: jest.Mock; processClosedBeforeRetrigger: jest.Mock };

  beforeEach(() => {
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
        correlationId: getUniqueString({ prefix: 'corr-' }),
        requestId: getUniqueString({ prefix: 'req-' }),
        version: '1.0.0',
      }),
    } as unknown as ObservationContextProvider;

    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<(fn: (client: Prisma.TransactionClient) => unknown) => unknown>().mockImplementation((fn) => fn(tx)),
    } as unknown as PrismaClient;
  });

  const createPruner = () => new PrunerImpl(queue, pruneEvaluator, probeFactory, observation, prisma);

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
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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
  });
});
