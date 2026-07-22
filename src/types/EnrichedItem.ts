import type { PruneOutcome, QueueItem } from './index.js';

export interface EnrichedItem {
  readonly item: QueueItem;
  readonly outcome: PruneOutcome;
}
