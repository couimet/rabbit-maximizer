import { isPRClosedWithoutMerge, isPRMerged, type PRStateFetcher } from './github/index.js';
import type { EnrichedItem, QueueItem } from './types/index.js';
import { TYPES } from './domain.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const MAX_CONCURRENT_FETCHES = 5;

export interface PruneEvaluator {
  evaluate(items: readonly QueueItem[]): Promise<EnrichedItem[]>;
}

@injectable()
export class PruneEvaluatorImpl implements PruneEvaluator {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PRStateFetcher)
    private readonly fetcher: PRStateFetcher,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async evaluate(items: readonly QueueItem[]): Promise<EnrichedItem[]> {
    const results: EnrichedItem[] = [];

    for (let i = 0; i < items.length; i += MAX_CONCURRENT_FETCHES) {
      const batch = items.slice(i, i + MAX_CONCURRENT_FETCHES);
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          const prState = await this.fetcher.fetch(item.repo_full_name, item.pr_number, 'PruneEvaluator.evaluate');
          if (prState === undefined) return;

          if (isPRMerged(prState)) {
            return { item, outcome: 'merged' as const };
          }
          if (isPRClosedWithoutMerge(prState)) {
            return { item, outcome: 'closed-without-merge' as const };
          }
          this.log.debug({ fn: 'PruneEvaluator.evaluate', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id }, 'PR still open; skipping');
          return;
        }),
      );

      for (const r of batchResults) {
        if (r !== undefined) results.push(r);
      }
    }

    return results;
  }
}
