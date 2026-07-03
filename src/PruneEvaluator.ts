import type { PRStateFetcher } from './github/PRStateFetcher.js';
import { isPRClosedWithoutMerge, isPRMerged } from './github/prStateUtils.js';
import type { EnrichedItem, QueueItem } from './types/index.js';
import { TYPES } from './inversify-types.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

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
    for (const item of items) {
      const prState = await this.fetcher.fetch(item.repo_full_name, item.pr_number, 'PruneEvaluator.evaluate');
      if (prState === undefined) continue;

      if (isPRMerged(prState)) {
        results.push({ item, outcome: 'merged' });
      } else if (isPRClosedWithoutMerge(prState)) {
        results.push({ item, outcome: 'closed-without-merge' });
      } else {
        this.log.debug({ fn: 'PruneEvaluator.evaluate', repo: item.repo_full_name, pr: item.pr_number, queueId: item.id }, 'PR still open; skipping');
      }
    }
    return results;
  }
}
