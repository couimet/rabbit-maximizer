import type { QueueRepository } from './db/queueRepository.js';
import { RabbitMaximizerError } from './errors/RabbitMaximizerError.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { TYPES } from './inversify-types.js';
import type { PruneEvaluator } from './PruneEvaluator.js';

import type { Logger } from '@couimet/logger-contract';
import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export interface Pruner {
  prune(): Promise<void>;
}

@injectable()
export class PrunerImpl implements Pruner {
  /* c8 ignore start */
  constructor(
    @inject(TYPES.QueueRepository) private readonly queue: QueueRepository,
    @inject(TYPES.PruneEvaluator) private readonly pruneEvaluator: PruneEvaluator,
    @inject(TYPES.ProbeFactory) private readonly probeFactory: ProbeFactory,
    @inject(TYPES.PrismaClient) private readonly prisma: PrismaClient,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async prune(): Promise<void> {
    const probe = this.probeFactory.createPrunerProbe();
    const pending = await this.queue.getPendingQueue();
    const enriched = await this.pruneEvaluator.evaluate(pending);
    if (enriched.length === 0) {
      probe.noItemsToPrune();
      return;
    }
    for (const e of enriched) {
      probe.withItem(e.item);
      try {
        await this.prisma.$transaction(async (tx) => {
          switch (e.outcome) {
            case 'merged':
              await this.queue.markReviewed(e.item.id, tx);
              await probe.prMerged(tx);
              break;
            case 'closed-without-merge':
              await this.queue.markFailed(e.item.id, tx);
              await probe.prClosedWithoutMerge(tx);
              break;
            default:
              throw RabbitMaximizerError.forUnexpectedSwitchDefault('prune outcome', e.outcome, 'PrunerImpl.prune');
          }
        });
      } catch (err: unknown) {
        probe.caughtError(err);
      }
    }
  }
}
