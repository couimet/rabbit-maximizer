import type { PruneOutcome } from './PruneOutcome.js';
import type { QueueItem } from './QueueItem.js';

export interface EnrichedItem {
  readonly item: QueueItem;
  readonly outcome: PruneOutcome;
}
