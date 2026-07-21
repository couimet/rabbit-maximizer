import type { QueueRepository } from '../src/db/queueRepository.js';
import { RabbitMaximizerError } from '../src/errors/RabbitMaximizerError.js';
import type { PruneEvaluator } from '../src/PruneEvaluator.js';
import { PrunerImpl } from '../src/Pruner.js';

import { createMockProbeFactory, createMockPrunerProbe, generateQueueItemHydrationData } from './helpers/index.js';

import type { Logger } from '@couimet/logger-contract';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

describe('Pruner', () => {
  let log: Logger;
  let queue: QueueRepository;
  let pruneEvaluator: PruneEvaluator;
  let probeFactory: ReturnType<typeof createMockProbeFactory>;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let mockProbe: ReturnType<typeof createMockPrunerProbe>;

  beforeEach(() => {
    log = createMockLogger();
    queue = { getPendingQueue: jest.fn<any>(), markReviewed: jest.fn<any>(), markFailed: jest.fn<any>() } as unknown as QueueRepository;
    pruneEvaluator = { evaluate: jest.fn<any>().mockResolvedValue([]) } as unknown as PruneEvaluator;
    mockProbe = createMockPrunerProbe();
    probeFactory = createMockProbeFactory({ createPrunerProbe: jest.fn<any>().mockReturnValue(mockProbe) });
    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<(fn: (client: Prisma.TransactionClient) => unknown) => unknown>().mockImplementation((fn) => fn(tx)),
    } as unknown as PrismaClient;
  });

  const createPruner = () => new PrunerImpl(queue, pruneEvaluator, probeFactory, prisma, log);

  describe('prune', () => {
    it('evaluates pending items and applies prune decisions in a transaction', async () => {
      const mergedItem = generateQueueItemHydrationData();
      const closedItem = generateQueueItemHydrationData();
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([mergedItem, closedItem]);
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([
        { item: mergedItem, outcome: 'merged' },
        { item: closedItem, outcome: 'closed-without-merge' },
      ]);
      await createPruner().prune();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockProbe.withItem).toHaveBeenCalledWith(mergedItem);
      expect(queue.markReviewed).toHaveBeenCalledWith(mergedItem.id, tx);
      expect(mockProbe.prMerged).toHaveBeenCalledWith(tx);
      expect(mockProbe.withItem).toHaveBeenCalledWith(closedItem);
      expect(queue.markFailed).toHaveBeenCalledWith(closedItem.id, tx);
      expect(mockProbe.prClosedWithoutMerge).toHaveBeenCalledWith(tx);
    });

    it('delegates to probe when there are no pending items', async () => {
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([]);
      await createPruner().prune();
      expect(mockProbe.noItemsToPrune).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('delegates to probe when evaluate returns no enriched items', async () => {
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([generateQueueItemHydrationData()]);
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([]);
      await createPruner().prune();
      expect(mockProbe.noItemsToPrune).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('delegates caught errors to probe and continues with remaining items', async () => {
      const item1 = generateQueueItemHydrationData();
      const item2 = generateQueueItemHydrationData();
      const pruneError = new Error('probe failure');
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([item1, item2]);
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([
        { item: item1, outcome: 'merged' },
        { item: item2, outcome: 'closed-without-merge' },
      ]);
      (mockProbe.prMerged as jest.Mock<any>).mockRejectedValueOnce(pruneError);
      await createPruner().prune();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockProbe.caughtError).toHaveBeenCalledTimes(1);
      expect(mockProbe.caughtError).toHaveBeenCalledWith(pruneError);
    });

    it('throws for an unexpected prune outcome', async () => {
      const item = generateQueueItemHydrationData();
      (queue.getPendingQueue as jest.Mock<any>).mockResolvedValue([item]);
      (pruneEvaluator.evaluate as jest.Mock<any>).mockResolvedValue([{ item, outcome: 'bad' as any }]);
      await createPruner().prune();
      expect(mockProbe.caughtError).toHaveBeenCalledTimes(1);
      expect(mockProbe.caughtError).toHaveBeenCalledWith(RabbitMaximizerError.forUnexpectedSwitchDefault('prune outcome', 'bad', 'PrunerImpl.prune'));
    });
  });
});
