import { RabbitMaximizerError } from '../src/errors/index.js';
import { PrunerImpl } from '../src/services.js';

import {
  createMockProbeFactory,
  createMockPruneEvaluator,
  createMockPrunerProbe,
  createMockQueueRepo,
  generateQueueItemHydrationData,
} from './helpers/index.js';

import { createMockLogger } from '@couimet/logger-contract-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

describe('Pruner', () => {
  let log: ReturnType<typeof createMockLogger>;
  let queue: ReturnType<typeof createMockQueueRepo>;
  let pruneEvaluator: ReturnType<typeof createMockPruneEvaluator>;
  let prisma: PrismaClient;
  let tx: Prisma.TransactionClient;
  let mockProbe: ReturnType<typeof createMockPrunerProbe>;
  let probeFactory: ReturnType<typeof createMockProbeFactory>;

  beforeEach(() => {
    log = createMockLogger();
    queue = createMockQueueRepo();
    pruneEvaluator = createMockPruneEvaluator();
    tx = {} as Prisma.TransactionClient;
    prisma = {
      $transaction: jest.fn<any>().mockImplementation((fn: (client: Prisma.TransactionClient) => unknown) => fn(tx)),
    } as unknown as PrismaClient;
    mockProbe = createMockPrunerProbe();
    probeFactory = createMockProbeFactory({ createPrunerProbe: jest.fn<any>().mockReturnValue(mockProbe) });
  });

  const createPruner = () => new PrunerImpl(queue, pruneEvaluator, probeFactory, prisma, log);

  describe('prune', () => {
    it('evaluates active items and applies prune decisions in a transaction', async () => {
      const mergedItem = generateQueueItemHydrationData();
      const closedItem = generateQueueItemHydrationData();
      queue.getActiveQueue.mockResolvedValue([mergedItem, closedItem]);
      pruneEvaluator.evaluate.mockResolvedValue([
        { item: mergedItem, outcome: 'merged' },
        { item: closedItem, outcome: 'closed-without-merge' },
      ]);
      await createPruner().prune();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockProbe.withItem).toHaveBeenCalledWith(mergedItem);
      expect(queue.markResolved).toHaveBeenCalledWith(mergedItem.id, 'pr_merged', tx);
      expect(mockProbe.prMerged).toHaveBeenCalledWith(tx);
      expect(mockProbe.withItem).toHaveBeenCalledWith(closedItem);
      expect(queue.markResolved).toHaveBeenCalledWith(closedItem.id, 'pr_closed_without_merge', tx);
      expect(mockProbe.prClosedWithoutMerge).toHaveBeenCalledWith(tx);
    });

    it('delegates to probe when there are no active items', async () => {
      queue.getActiveQueue.mockResolvedValue([]);
      await createPruner().prune();
      expect(mockProbe.noItemsToPrune).toHaveBeenCalled();
      expect(pruneEvaluator.evaluate).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('delegates to probe when evaluate returns no enriched items', async () => {
      queue.getActiveQueue.mockResolvedValue([generateQueueItemHydrationData()]);
      pruneEvaluator.evaluate.mockResolvedValue([]);
      await createPruner().prune();
      expect(mockProbe.noItemsToPrune).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('evaluates all active items via a single getActiveQueue call', async () => {
      const pendingItem = generateQueueItemHydrationData();
      const retriggeredItem = generateQueueItemHydrationData();
      queue.getActiveQueue.mockResolvedValue([pendingItem, retriggeredItem]);
      pruneEvaluator.evaluate.mockResolvedValue([
        { item: pendingItem, outcome: 'merged' },
        { item: retriggeredItem, outcome: 'closed-without-merge' },
      ]);
      await createPruner().prune();
      expect(queue.getActiveQueue).toHaveBeenCalledTimes(1);
      expect(pruneEvaluator.evaluate).toHaveBeenCalledWith([pendingItem, retriggeredItem]);
      expect(queue.markResolved).toHaveBeenCalledWith(pendingItem.id, 'pr_merged', tx);
      expect(queue.markResolved).toHaveBeenCalledWith(retriggeredItem.id, 'pr_closed_without_merge', tx);
    });

    it('delegates caught errors to probe and continues with remaining items', async () => {
      const item1 = generateQueueItemHydrationData();
      const item2 = generateQueueItemHydrationData();
      const pruneError = new Error('probe failure');
      queue.getActiveQueue.mockResolvedValue([item1, item2]);
      pruneEvaluator.evaluate.mockResolvedValue([
        { item: item1, outcome: 'merged' },
        { item: item2, outcome: 'closed-without-merge' },
      ]);
      mockProbe.prMerged.mockRejectedValueOnce(pruneError);
      await createPruner().prune();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockProbe.caughtError).toHaveBeenCalledTimes(1);
      expect(mockProbe.caughtError).toHaveBeenCalledWith(pruneError);
    });

    it('throws for an unexpected prune outcome', async () => {
      const item = generateQueueItemHydrationData();
      queue.getActiveQueue.mockResolvedValue([item]);
      pruneEvaluator.evaluate.mockResolvedValue([{ item, outcome: 'bad' as any }]);
      await createPruner().prune();
      expect(mockProbe.caughtError).toHaveBeenCalledTimes(1);
      expect(mockProbe.caughtError).toHaveBeenCalledWith(RabbitMaximizerError.forUnexpectedSwitchDefault('prune outcome', 'bad', 'PrunerImpl.prune'));
    });
  });
});
