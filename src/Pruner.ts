import type { QueueRepository } from './db/queueRepository.js';
import type { ObservationContextProvider } from './observability/observationContext.js';
import type { ProbeFactory } from './probes/ProbeFactory.js';
import { TYPES } from './inversify-types.js';
import type { PruneEvaluator } from './PruneEvaluator.js';

import type { PrismaClient } from '@prisma/client';
import { inject, injectable } from 'inversify';

export interface Pruner {
  prune(): Promise<void>;
}

@injectable()
export class PrunerImpl implements Pruner {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.PruneEvaluator)
    private readonly pruneEvaluator: PruneEvaluator,
    @inject(TYPES.ProbeFactory)
    private readonly probeFactory: ProbeFactory,
    @inject(TYPES.ObservationContextProvider)
    private readonly observation: ObservationContextProvider,
    @inject(TYPES.PrismaClient)
    private readonly prisma: PrismaClient,
  ) {}
  /* c8 ignore stop */

  async prune(): Promise<void> {
    const pending = await this.queue.getPendingQueue();
    const enriched = await this.pruneEvaluator.evaluate(pending);

    if (enriched.length === 0) return;

    const obs = this.observation.current();
    await this.prisma.$transaction(async (tx) => {
      for (const e of enriched) {
        const probe = this.probeFactory.createQueueItemProbe(e.item, obs);
        if (e.outcome === 'merged') {
          await probe.processMergedBeforeRetrigger(tx);
        } else {
          await probe.processClosedBeforeRetrigger(tx);
        }
      }
    });
  }
}
