import type { PrState } from '../domain.js';

import type { QueueItem } from './QueueItem.js';

export interface EnrichedQueueItem extends QueueItem {
  readonly prState: PrState | undefined;
  readonly lastCoderabbitAcknowledgedAt: Date | undefined;
}
