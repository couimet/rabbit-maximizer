import type { PullRequestRepository } from '../db/index.js';
import type { PrState } from '../domain.js';
import { TYPES } from '../inversify-types.js';
import type { EnrichedQueueItem, QueueItem } from '../types/index.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

const EMPTY_ENRICHMENT = { prState: undefined, lastCoderabbitAcknowledgedAt: undefined };

@injectable()
export class QueueItemEnricher {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.PullRequestRepository) private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async enrich(items: QueueItem[]): Promise<EnrichedQueueItem[]> {
    if (items.length === 0) return items as EnrichedQueueItem[];

    const nullIdCount = items.reduce((count, item) => count + (item.pull_request_id == null ? 1 : 0), 0);

    if (nullIdCount > 0) {
      this.log.warn(
        { fn: 'QueueItemEnricher.enrich', nullCount: nullIdCount, totalItemCount: items.length },
        'Skipping enrichment for items with null pull_request_id',
      );
    }

    const validIds = [...new Set(items.map((item) => item.pull_request_id).filter((id): id is number => id != null))];

    if (validIds.length === 0) {
      this.log.debug({ fn: 'QueueItemEnricher.enrich', itemCount: items.length }, 'All items have null pull_request_id; enrichment skipped entirely');
      return items.map((item) => ({ ...item, ...EMPTY_ENRICHMENT }));
    }

    const { pr_state: prStateMap, last_coderabbit_acknowledged_at: ackMap } = await this.pullRequests.getColumnMaps(validIds, [
      'pr_state',
      'last_coderabbit_acknowledged_at',
    ]);

    return items.map((item) => {
      const pid = item.pull_request_id;
      if (pid == null) {
        return { ...item, ...EMPTY_ENRICHMENT };
      }
      const prState = prStateMap.get(pid) as PrState | undefined;
      const ackValue = ackMap.get(pid) ?? undefined;
      return { ...item, prState, lastCoderabbitAcknowledgedAt: ackValue };
    });
  }
}
